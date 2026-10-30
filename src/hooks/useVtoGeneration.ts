import { useState, useCallback, useEffect, useRef } from 'react';
import { usePostVtoGenerations, useGetVtoGenerationsGenerationId } from '../api/endpoints/vto/vto';
import type { PostVtoGenerationsBody } from '../api/model/postVtoGenerationsBody';
import type { VtoStatusResponse } from '../api/model/vtoStatusResponse';
import type { VtoStatusResponseStatus } from '../api/model/vtoStatusResponseStatus';
import { useQueryClient } from '@tanstack/react-query';
import { connectSse } from '../lib/sse';

/** A terminal status needs no reconnect: the stream that reported it is done. */
function isTerminalStatus(data: VtoStatusResponse): boolean {
  return data.status === 'Complete' || data.status === 'Failed';
}

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
        const data = query.state.data as VtoStatusResponse | undefined;
        return data?.status === 'Complete' || data?.status === 'Failed' ? false : 10_000;
      },
    },
  });

  const status: VtoStatusResponseStatus | null = statusQuery.data?.status ?? null;
  const isTerminal = status === 'Complete' || status === 'Failed';

  const invalidateProfile = useCallback(() => {
    queryClient.invalidateQueries({ queryKey: ['/users/me'] as const });
  }, [queryClient]);

  useEffect(() => {
    sseRef.current?.close();
    sseRef.current = null;

    if (!vtoId || isTerminal) return;

    const queryKey = [`/vto/generations/${vtoId}`];

    sseRef.current = connectSse<VtoStatusResponse>(
      `/vto/generations/${vtoId}/stream`,
      (data) => {
        // Only `event: status` frames reach this callback; a duplicate or
        // out-of-order frame carries a state_version that is not newer than the
        // cached one and must leave the newer state in place.
        const cached = queryClient.getQueryData<VtoStatusResponse>(queryKey);
        if (cached && data.state_version <= cached.state_version) return;
        queryClient.setQueryData(queryKey, data);
      },
      { eventName: 'status', isTerminal: isTerminalStatus },
    );

    return () => {
      sseRef.current?.close();
      sseRef.current = null;
    };
  }, [vtoId, queryClient, isTerminal, invalidateProfile]);

  // The balance changes on generation start and again when the run settles
  // (deduction, refund, exhaustion), so re-read the profile at both points.
  useEffect(() => {
    if (vtoId && isTerminal) invalidateProfile();
  }, [vtoId, isTerminal, invalidateProfile]);

  const result: VtoStatusResponse | null = statusQuery.data ?? null;
  const errorMessage: string | null = statusQuery.data?.error_message ?? (generateMutation.isError ? 'Failed to start generation' : null);
  const isPolling = !!vtoId && !isTerminal;

  const generate = useCallback(async (params: PostVtoGenerationsBody) => {
    setVtoId(null);
    const response = await generateMutation.mutateAsync({ data: params });
    setVtoId(response.generation_id);
    queryClient.invalidateQueries({ queryKey: ['/vto/generations'] as const });
    invalidateProfile();
  }, [generateMutation, queryClient, invalidateProfile]);

  return { generate, status, result, errorMessage, isPolling, vtoId, isStarting: generateMutation.isPending };
}
