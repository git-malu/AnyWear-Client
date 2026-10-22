import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fetchAuthSession } from 'aws-amplify/auth';
import { ClientVersionUnsupportedError, connectSse } from './sse';
import { CLIENT_VERSION } from './client-version';

vi.mock('aws-amplify/auth', () => ({
  fetchAuthSession: vi.fn(),
}));

const encoder = new TextEncoder();

function eventStream(chunks: string[]): Response {
  return new Response(new ReadableStream({
    start(controller) {
      chunks.forEach((chunk) => controller.enqueue(encoder.encode(chunk)));
      controller.close();
    },
  }), { status: 200, headers: { 'content-type': 'text/event-stream' } });
}

describe('connectSse', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    vi.clearAllMocks();
    vi.unstubAllGlobals();
    vi.mocked(fetchAuthSession).mockResolvedValue({
      tokens: { accessToken: { toString: () => 'access-token' } },
    } as Awaited<ReturnType<typeof fetchAuthSession>>);
  });

  it('parses framed and multi-line JSON events across chunks', async () => {
    const onEvent = vi.fn();
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(eventStream([
      ': heartbeat\r\n\r\ndata: not-json\r\n\r\ndata: {"status":\r\n',
      'data: "Complete"}\r\n\r\n',
    ])));

    const connection = connectSse('/events', (event) => {
      onEvent(event);
      connection.close();
    }, { initialRetryMs: 60_000 });

    await vi.waitFor(() => expect(onEvent).toHaveBeenCalledWith({ status: 'Complete' }));
  });

  it('refreshes authentication immediately after an unauthorized response', async () => {
    const onEvent = vi.fn();
    vi.stubGlobal('fetch', vi.fn()
      .mockResolvedValueOnce(new Response(null, { status: 401 }))
      .mockResolvedValueOnce(eventStream(['data: {"status":"ready"}\n\n'])));

    const connection = connectSse('/events', (event) => {
      onEvent(event);
      connection.close();
    }, { initialRetryMs: 60_000 });

    await vi.waitFor(() => expect(onEvent).toHaveBeenCalledWith({ status: 'ready' }));
    expect(fetchAuthSession).toHaveBeenNthCalledWith(2, { forceRefresh: true });
  });

  it('sends the Client version header on the stream request', async () => {
    const fetchMock = vi.fn().mockResolvedValue(eventStream(['data: {"status":"Complete"}\n\n']));
    vi.stubGlobal('fetch', fetchMock);

    const connection = connectSse('/events', () => connection.close(), { initialRetryMs: 60_000 });
    try {
      await vi.waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));
      expect(fetchMock.mock.calls[0][1]).toMatchObject({
        headers: {
          Accept: 'text/event-stream',
          'X-AnyWear-Client-Version': String(CLIENT_VERSION),
        },
      });
    } finally {
      connection.close();
    }
  });

  it('reconnects after a transient response failure', async () => {
    const onEvent = vi.fn();
    vi.spyOn(Math, 'random').mockReturnValue(0.5);
    vi.stubGlobal('fetch', vi.fn()
      .mockResolvedValueOnce(new Response(null, { status: 503 }))
      .mockResolvedValueOnce(eventStream(['data: {"status":"Processing"}\n\n'])));

    const connection = connectSse('/events', (event) => {
      onEvent(event);
      connection.close();
    }, { initialRetryMs: 1, maxRetryMs: 1 });

    await vi.waitFor(() => expect(onEvent).toHaveBeenCalledWith({ status: 'Processing' }));
    expect(fetch).toHaveBeenCalledTimes(2);
  });

  it('treats a CLIENT_VERSION_UNSUPPORTED 400 as terminal', async () => {
    const onEvent = vi.fn();
    const onError = vi.fn();
    const onStateChange = vi.fn();
    vi.spyOn(Math, 'random').mockReturnValue(0.5);
    const fetchMock = vi.fn().mockResolvedValue(new Response(
      JSON.stringify({ error: 'CLIENT_VERSION_UNSUPPORTED' }),
      { status: 400, headers: { 'content-type': 'application/json' } },
    ));
    vi.stubGlobal('fetch', fetchMock);

    connectSse('/events', onEvent, {
      initialRetryMs: 1,
      maxRetryMs: 1,
      onError,
      onStateChange,
    });

    await vi.waitFor(() => expect(onError).toHaveBeenCalledTimes(1));
    const error = onError.mock.calls[0][0];
    expect(error).toBeInstanceOf(ClientVersionUnsupportedError);
    expect(String(error)).toContain('CLIENT_VERSION_UNSUPPORTED');

    // A retry would be scheduled within a couple of milliseconds; wait longer
    // than that and prove the connection stayed closed.
    await new Promise((resolve) => setTimeout(resolve, 25));
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(onStateChange).toHaveBeenCalledWith('closed');
    expect(onStateChange).not.toHaveBeenCalledWith('reconnecting');
    expect(onEvent).not.toHaveBeenCalled();
  });

  it('reconnects after a 400 that is not a Client version rejection', async () => {
    const onEvent = vi.fn();
    vi.spyOn(Math, 'random').mockReturnValue(0.5);
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(new Response(
        JSON.stringify({ error: 'SOMETHING_ELSE' }),
        { status: 400, headers: { 'content-type': 'application/json' } },
      ))
      .mockResolvedValueOnce(eventStream(['data: {"status":"Complete"}\n\n']));
    vi.stubGlobal('fetch', fetchMock);

    const connection = connectSse('/events', (event) => {
      onEvent(event);
      connection.close();
    }, { initialRetryMs: 1, maxRetryMs: 1 });

    try {
      await vi.waitFor(() => expect(onEvent).toHaveBeenCalledWith({ status: 'Complete' }));
      expect(fetchMock).toHaveBeenCalledTimes(2);
    } finally {
      connection.close();
    }
  });

  it('reconnects after the server disconnects an open stream', async () => {
    const receivedStatuses: string[] = [];
    vi.spyOn(Math, 'random').mockReturnValue(0.5);
    vi.stubGlobal('fetch', vi.fn()
      .mockResolvedValueOnce(eventStream(['data: {"status":"Processing"}\n\n']))
      .mockResolvedValueOnce(eventStream(['data: {"status":"Complete"}\n\n'])));

    const connection = connectSse<{ status: string }>('/events', (event) => {
      receivedStatuses.push(event.status);
      if (event.status === 'Complete') connection.close();
    }, { initialRetryMs: 1, maxRetryMs: 1 });

    await vi.waitFor(() => expect(receivedStatuses).toEqual(['Processing', 'Complete']));
    expect(fetch).toHaveBeenCalledTimes(2);
  });

  it.each([
    ['split CRLF within multiline JSON', ['data: {"status":\r', '\ndata: "Complete"}\r\n\r\n']],
    ['split CRLF at the frame boundary', ['data: {"status":"Complete"}\r\n\r', '\n']],
    ['CR-only frame boundary at EOF', ['data: {"status":"Complete"}\r\r']],
  ])('parses %s', async (_name, chunks) => {
    const onEvent = vi.fn();
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(eventStream(chunks as string[])));
    const connection = connectSse('/events', onEvent, { initialRetryMs: 60_000 });
    try {
      await vi.waitFor(() => expect(onEvent).toHaveBeenCalledExactlyOnceWith({ status: 'Complete' }));
    } finally {
      connection.close();
    }
  });

  it('does not dispatch another buffered frame after a terminal callback closes the connection', async () => {
    const onEvent = vi.fn();
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(eventStream([
      'data: {"status":"Complete","state_version":3}\n\n'
      + 'data: {"status":"Processing","state_version":2}\n\n',
    ])));
    const connection = connectSse('/events', (event) => {
      onEvent(event);
      connection.close();
    });
    try {
      await vi.waitFor(() => expect(onEvent).toHaveBeenCalledExactlyOnceWith({ status: 'Complete', state_version: 3 }));
    } finally {
      connection.close();
    }
  });
});
