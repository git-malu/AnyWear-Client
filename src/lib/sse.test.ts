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
});
