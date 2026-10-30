import { fetchAuthSession } from 'aws-amplify/auth';
import { CLIENT_VERSION, CLIENT_VERSION_HEADER } from './client-version';

type SseEventCallback<T = unknown> = (data: T) => void;

export type SseConnectionState = 'connecting' | 'open' | 'reconnecting' | 'closed';

interface SseConnection {
  close: () => void;
}

interface SseConnectionOptions<T = unknown> {
  initialRetryMs?: number;
  maxRetryMs?: number;
  /**
   * Only frames whose SSE `event` field names this event reach the callback.
   * The Service interleaves `event: heartbeat` frames (`data: {}`) with the
   * `event: status` frames that carry state, and a heartbeat must never replace
   * cached state.
   */
  eventName?: string;
  /**
   * A dispatched payload after which no reconnect can change the resource. The
   * connection closes without retrying, so a terminal frame does not reopen the
   * stream that produced it.
   */
  isTerminal?: (data: T) => boolean;
  onError?: (error: unknown) => void;
  onStateChange?: (state: SseConnectionState) => void;
}

interface SseFrame {
  event: string;
  data: string;
}

/**
 * The Service rejected this Client's version identity. No reconnect can fix a
 * version mismatch, so this error ends the stream instead of retrying.
 */
export class ClientVersionUnsupportedError extends Error {
  constructor() {
    super('CLIENT_VERSION_UNSUPPORTED: the Service rejected this Client version');
    this.name = 'ClientVersionUnsupportedError';
  }
}

/** Whether `response` is the terminal Client-version rejection. */
async function isClientVersionUnsupported(response: Response): Promise<boolean> {
  if (response.status !== 400) return false;
  try {
    const body: unknown = await response.json();
    return typeof body === 'object'
      && body !== null
      && (body as { error?: unknown }).error === 'CLIENT_VERSION_UNSUPPORTED';
  } catch {
    return false;
  }
}

function parseEventFrame(frame: string): SseFrame | null {
  let event = 'message';
  const dataLines: string[] = [];

  for (const line of frame.split('\n')) {
    if (line.startsWith('event:')) {
      event = line.slice('event:'.length).replace(/^ /, '');
    } else if (line.startsWith('data:')) {
      dataLines.push(line.slice('data:'.length).replace(/^ /, ''));
    }
  }

  if (dataLines.length === 0) return null;
  return { event, data: dataLines.join('\n') };
}

/** Dispatches one frame; returns whether it was the caller's terminal payload. */
function dispatchFrame<T>(
  frame: string,
  onEvent: SseEventCallback<T>,
  eventName: string | undefined,
  isTerminal: ((data: T) => boolean) | undefined,
): boolean {
  const parsed = parseEventFrame(frame);
  if (!parsed) return false;
  if (eventName !== undefined && parsed.event !== eventName) return false;

  let data: T;
  try {
    data = JSON.parse(parsed.data) as T;
  } catch {
    // Malformed events are ignored; the stream remains usable.
    return false;
  }

  onEvent(data);
  return isTerminal?.(data) === true;
}

/** Resolves to `true` when a terminal payload was dispatched. */
async function consumeEventStream<T>(
  response: Response,
  signal: AbortSignal,
  onEvent: SseEventCallback<T>,
  options: SseConnectionOptions<T>,
): Promise<boolean> {
  if (!response.body) throw new Error('SSE response has no body');

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';
  let trailingCr = false;

  while (!signal.aborted) {
    const { done, value } = await reader.read();
    if (signal.aborted) return false;

    // A trailing CR may be the first half of a CRLF split across chunks.
    let chunk: string = (trailingCr ? '\r' : '') + decoder.decode(value, { stream: !done });
    trailingCr = !done && chunk.endsWith('\r');
    if (trailingCr) chunk = chunk.slice(0, -1);
    buffer += chunk.replace(/\r\n?/g, '\n');
    let boundary = buffer.indexOf('\n\n');
    while (!signal.aborted && boundary >= 0) {
      const frame = buffer.slice(0, boundary);
      buffer = buffer.slice(boundary + 2);
      if (dispatchFrame(frame, onEvent, options.eventName, options.isTerminal)) return true;
      boundary = buffer.indexOf('\n\n');
    }
    if (done) return false;
  }

  return false;
}

/**
 * Opens an authenticated, reconnecting SSE connection to the API.
 */
export function connectSse<T = unknown>(
  path: string,
  onEvent: SseEventCallback<T>,
  options: SseConnectionOptions<T> = {},
): SseConnection {
  const initialRetryMs = options.initialRetryMs ?? 1_000;
  const maxRetryMs = options.maxRetryMs ?? 30_000;
  let closed = false;
  let retryAttempt = 0;
  let retryTimer: ReturnType<typeof setTimeout> | null = null;
  let activeController: AbortController | null = null;

  const setState = (state: SseConnectionState) => options.onStateChange?.(state);

  /** Ends the connection without a reconnect. Returns false when already closed. */
  const closeConnection = (): boolean => {
    if (closed) return false;
    closed = true;
    if (retryTimer) clearTimeout(retryTimer);
    retryTimer = null;
    activeController?.abort();
    activeController = null;
    setState('closed');
    return true;
  };

  const scheduleReconnect = (): void => {
    if (closed || retryTimer) return;

    setState('reconnecting');
    const exponentialDelay = Math.min(initialRetryMs * (2 ** retryAttempt), maxRetryMs);
    const jitteredDelay = Math.round(exponentialDelay * (0.8 + Math.random() * 0.4));
    retryAttempt += 1;
    retryTimer = setTimeout(() => {
      retryTimer = null;
      void run(false);
    }, jitteredDelay);
  };

  /** Ends the connection without a reconnect: no retry can change the response. */
  const closeTerminally = (error: unknown): void => {
    if (closeConnection()) options.onError?.(error);
  };

  const run = async (forceRefresh: boolean): Promise<void> => {
    if (closed) return;

    setState(retryAttempt === 0 ? 'connecting' : 'reconnecting');
    const controller = new AbortController();
    activeController = controller;

    try {
      const session = forceRefresh
        ? await fetchAuthSession({ forceRefresh: true })
        : await fetchAuthSession();
      const token = session.tokens?.accessToken?.toString();
      if (!token) throw new Error('No access token is available for SSE');
      if (closed) return;

      const baseUrl = (import.meta.env.VITE_API_BASE_URL || 'http://localhost:3000').replace(/\/$/, '');
      const normalizedPath = path.startsWith('/') ? path : `/${path}`;
      const response = await fetch(`${baseUrl}${normalizedPath}`, {
        headers: {
          Accept: 'text/event-stream',
          Authorization: `Bearer ${token}`,
          [CLIENT_VERSION_HEADER]: String(CLIENT_VERSION),
        },
        signal: controller.signal,
      });

      if (await isClientVersionUnsupported(response)) {
        throw new ClientVersionUnsupportedError();
      }
      if ((response.status === 401 || response.status === 403) && !forceRefresh) {
        await run(true);
        return;
      }
      if (!response.ok) throw new Error(`SSE connection failed with status ${response.status}`);

      retryAttempt = 0;
      setState('open');
      const terminal = await consumeEventStream(response, controller.signal, onEvent, options);
      if (terminal) closeConnection();
      else scheduleReconnect();
    } catch (error) {
      if (closed || (error instanceof Error && error.name === 'AbortError')) return;
      if (error instanceof ClientVersionUnsupportedError) {
        closeTerminally(error);
        return;
      }
      options.onError?.(error);
      scheduleReconnect();
    } finally {
      if (activeController === controller) activeController = null;
    }
  };

  void run(false);

  return {
    close: () => {
      closeConnection();
    },
  };
}
