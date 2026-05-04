import { useState, useCallback } from 'react';
import { usePostVtoGenerations, useGetVtoGenerationsGenerationId } from '../api/endpoints/vto/vto';
import type { PostVtoGenerationsBody } from '../api/model/postVtoGenerationsBody';
import type { GetVtoGenerationsGenerationId200 } from '../api/model/getVtoGenerationsGenerationId200';
import type { GetVtoGenerationsGenerationId200Status } from '../api/model/getVtoGenerationsGenerationId200Status';
import { useQueryClient } from '@tanstack/react-query';

export default function useVtoGeneration() {
  const queryClient = useQueryClient();
  const [vtoId, setVtoId] = useState<string | null>(null);

  const generateMutation = usePostVtoGenerations();

  const statusQuery = useGetVtoGenerationsGenerationId(vtoId ?? '', {
    query: {
      refetchInterval: (query) => {
        const data = query.state.data as GetVtoGenerationsGenerationId200 | undefined;
        if (data && (data.status === 'Pending' || data.status === 'Processing')) {
          return 2000;
        }
        return false;
      },
      enabled: !!vtoId,
    },
  });

  const status: GetVtoGenerationsGenerationId200Status | null = statusQuery.data?.status ?? null;
  const result: GetVtoGenerationsGenerationId200 | null = statusQuery.data ?? null;
  const errorMessage: string | null = statusQuery.data?.error_message ?? (generateMutation.isError ? 'Failed to start generation' : null);
  const isPolling = status === 'Pending' || status === 'Processing';

  const generate = useCallback(async (params: PostVtoGenerationsBody) => {
    setVtoId(null);
    const response = await generateMutation.mutateAsync({ data: params });
    setVtoId(response.generation_id);
    queryClient.invalidateQueries({ queryKey: ['/vto/generations'] as const });
  }, [generateMutation, queryClient]);

  return { generate, status, result, errorMessage, isPolling, vtoId, isStarting: generateMutation.isPending };
}
