import { useState, useCallback, useEffect, useRef } from 'react';
import { usePostVtoGenerations, useGetVtoGenerationsGenerationId } from '../api/endpoints/vto/vto';
import type { PostVtoGenerationsBody } from '../api/model/postVtoGenerationsBody';
import type { GetVtoGenerationsGenerationId200 } from '../api/model/getVtoGenerationsGenerationId200';
import type { GetVtoGenerationsGenerationId200Status } from '../api/model/getVtoGenerationsGenerationId200Status';
import { useQueryClient } from '@tanstack/react-query';
import { connectSse } from '../lib/sse';

export default function useVtoGeneration() {
  const queryClient = useQueryClient();
  const [vtoId, setVtoId] = useState<string | null>(null);
  const sseRef = useRef<ReturnType<typeof connectSse> | null>(null);

  const generateMutation = usePostVtoGenerations();

  const statusQuery = useGetVtoGenerationsGenerationId(vtoId ?? '', {
    query: {
      enabled: !!vtoId,
      refetchInterval: (query) => {
        if (!vtoId) return false;
        const data = query.state.data as GetVtoGenerationsGenerationId200 | undefined;
        return data?.status === 'Complete' || data?.status === 'Failed' ? false : 10_000;
      },
    },
  });

  const status: GetVtoGenerationsGenerationId200Status | null = statusQuery.data?.status ?? null;
  const isTerminal = status === 'Complete' || status === 'Failed';

  useEffect(() => {
    sseRef.current?.close();
    sseRef.current = null;

    if (!vtoId || isTerminal) return;

    sseRef.current = connectSse<GetVtoGenerationsGenerationId200>(
      `/vto/generations/${vtoId}/stream`,
      (data) => {
        queryClient.setQueryData(
          [`/vto/generations/${vtoId}`],
          data,
        );
        if (data.status === 'Complete' || data.status === 'Failed') {
          sseRef.current?.close();
          sseRef.current = null;
        }
      },
    );

    return () => {
      sseRef.current?.close();
      sseRef.current = null;
    };
  }, [vtoId, queryClient, isTerminal]);

  const result: GetVtoGenerationsGenerationId200 | null = statusQuery.data ?? null;
  const errorMessage: string | null = statusQuery.data?.error_message ?? (generateMutation.isError ? 'Failed to start generation' : null);
  const isPolling = !!vtoId && !isTerminal;

  const generate = useCallback(async (params: PostVtoGenerationsBody) => {
    setVtoId(null);
    const response = await generateMutation.mutateAsync({ data: params });
    setVtoId(response.generation_id);
    queryClient.invalidateQueries({ queryKey: ['/vto/generations'] as const });
  }, [generateMutation, queryClient]);

  return { generate, status, result, errorMessage, isPolling, vtoId, isStarting: generateMutation.isPending };
}
