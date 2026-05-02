import { useState, useCallback } from 'react';
import { usePostVtoGenerate, useGetVtoStatusVtoId } from '../api/endpoints/vto/vto';
import type { PostVtoGenerateBody } from '../api/model/postVtoGenerateBody';
import type { GetVtoStatusVtoId200 } from '../api/model/getVtoStatusVtoId200';
import type { GetVtoStatusVtoId200Status } from '../api/model/getVtoStatusVtoId200Status';
import { useQueryClient } from '@tanstack/react-query';

export default function useVtoGeneration() {
  const queryClient = useQueryClient();
  const [vtoId, setVtoId] = useState<string | null>(null);

  const generateMutation = usePostVtoGenerate();

  const statusQuery = useGetVtoStatusVtoId(vtoId ?? '', {
    query: {
      refetchInterval: (query) => {
        const data = query.state.data as GetVtoStatusVtoId200 | undefined;
        if (data && (data.status === 'Pending' || data.status === 'Processing')) {
          return 2000;
        }
        return false;
      },
      enabled: !!vtoId,
    },
  });

  const status: GetVtoStatusVtoId200Status | null = statusQuery.data?.status ?? null;
  const result: GetVtoStatusVtoId200 | null = statusQuery.data ?? null;
  const errorMessage: string | null = statusQuery.data?.error_message ?? (generateMutation.isError ? 'Failed to start generation' : null);
  const isPolling = status === 'Pending' || status === 'Processing';

  const generate = useCallback(async (params: PostVtoGenerateBody) => {
    setVtoId(null);
    const response = await generateMutation.mutateAsync({ data: params });
    setVtoId(response.vto_id);
    queryClient.invalidateQueries({ queryKey: ['/vto/history'] as const });
  }, [generateMutation, queryClient]);

  return { generate, status, result, errorMessage, isPolling, vtoId, isStarting: generateMutation.isPending };
}
