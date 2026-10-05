import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fetchAuthSession } from 'aws-amplify/auth';
import { connectSse } from './sse';

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
