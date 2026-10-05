import type { PropsWithChildren } from 'react';
import { act, renderHook } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import useVtoGeneration from './useVtoGeneration';
import {
  useGetVtoGenerationsGenerationId,
  usePostVtoGenerations,
} from '../api/endpoints/vto/vto';
import type { GetVtoGenerationsGenerationId200 } from '../api/model/getVtoGenerationsGenerationId200';
import { connectSse } from '../lib/sse';

vi.mock('../api/endpoints/vto/vto', () => ({
  useGetVtoGenerationsGenerationId: vi.fn(),
  usePostVtoGenerations: vi.fn(),
}));

vi.mock('../lib/sse', () => ({
  connectSse: vi.fn(),
}));

const pendingStatus: GetVtoGenerationsGenerationId200 = {
  generation_id: 'generation-1',
  status: 'Processing',
  state_version: 1,
  created_at: '2026-10-03T00:00:00.000Z',
};

function createStatusQuery(data: GetVtoGenerationsGenerationId200 | undefined) {
  return {
    data,
    queryKey: ['/vto/generations/generation-1'],
  } as unknown as ReturnType<typeof useGetVtoGenerationsGenerationId>;
}

function createWrapper(queryClient: QueryClient) {
  return function QueryClientWrapper({ children }: PropsWithChildren) {
    return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>;
  };
}

describe('useVtoGeneration', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(useGetVtoGenerationsGenerationId).mockReturnValue(createStatusQuery(undefined));
    vi.mocked(usePostVtoGenerations).mockReturnValue({
      mutateAsync: vi.fn().mockResolvedValue({ generation_id: 'generation-1', outfit_id: 'outfit-1' }),
      isError: false,
      isPending: false,
    } as unknown as ReturnType<typeof usePostVtoGenerations>);
    vi.mocked(connectSse).mockImplementation(() => ({ close: vi.fn() }));
  });

  it('owns one SSE connection and keeps polling while the task is non-terminal', async () => {
    const queryOptions: Array<{ query?: { refetchInterval?: unknown } }> = [];
    vi.mocked(useGetVtoGenerationsGenerationId).mockImplementation((_generationId, options) => {
      queryOptions.push(options ?? {});
      return createStatusQuery(pendingStatus);
    });

    const queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    });
    const { result } = renderHook(() => useVtoGeneration(), {
      wrapper: createWrapper(queryClient),
    });

    await act(async () => {
      await result.current.generate({ base_photo_id: 'photo-1', outfit_id: 'outfit-1' });
    });

    expect(connectSse).toHaveBeenCalledTimes(1);
    const refetchInterval = queryOptions[0]?.query?.refetchInterval;
    expect(refetchInterval).toBeTypeOf('function');
    expect((refetchInterval as (query: never) => number | false)({
      state: { data: pendingStatus },
    } as never)).toBe(10_000);
    expect((refetchInterval as (query: never) => number | false)({
      state: { data: { ...pendingStatus, status: 'Complete' } },
    } as never)).toBe(false);
  });

  it('closes the owned SSE connection when a terminal event arrives', async () => {
    const close = vi.fn();
    let onEvent: ((event: GetVtoGenerationsGenerationId200) => void) | undefined;
    vi.mocked(connectSse).mockImplementation((_path, callback) => {
      onEvent = callback as (event: GetVtoGenerationsGenerationId200) => void;
      return { close };
    });

    const queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    });
    const { result } = renderHook(() => useVtoGeneration(), {
      wrapper: createWrapper(queryClient),
    });

    await act(async () => {
      await result.current.generate({ base_photo_id: 'photo-1', outfit_id: 'outfit-1' });
    });

    expect(onEvent).toBeDefined();
    act(() => {
      onEvent?.({ ...pendingStatus, status: 'Complete' });
    });

    expect(close).toHaveBeenCalledTimes(1);
  });
});
