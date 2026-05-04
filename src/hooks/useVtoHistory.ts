import { useState, useCallback } from 'react';
import { useGetVtoHistory, usePatchVtoHistoryIdRating, useDeleteVtoHistoryId } from '../api/endpoints/vto/vto';
import type { GetVtoHistoryParams } from '../api/model/getVtoHistoryParams';
import { keepPreviousData } from '@tanstack/react-query';

const DEFAULT_LIMIT = 12;

export default function useVtoHistory() {
  const [page, setPage] = useState(1);
  const [filters, setFilters] = useState<GetVtoHistoryParams>({ limit: DEFAULT_LIMIT });

  const params: GetVtoHistoryParams = {
    ...filters,
    page,
    limit: DEFAULT_LIMIT,
  };

  const { data, isLoading, refetch } = useGetVtoHistory(params, {
    query: { placeholderData: keepPreviousData },
  });

  const rateMutation = usePatchVtoHistoryIdRating();
  const deleteMutation = useDeleteVtoHistoryId();

  const generations = data?.generations ?? [];
  const total = data?.total ?? 0;
  const nextPage = data?.nextPage ?? null;

  const goToPage = useCallback((newPage: number) => {
    setPage(newPage);
  }, []);

  const rateGeneration = useCallback((id: string, rating: number) => {
    rateMutation.mutate(
      { id, data: { rating } },
      {
        onSuccess: () => {
          refetch();
        },
      }
    );
  }, [rateMutation, refetch]);

  const deleteGeneration = useCallback((id: string) => {
    deleteMutation.mutate(
      { id },
      {
        onSuccess: () => {
          refetch();
        },
      }
    );
  }, [deleteMutation, refetch]);

  return { generations, total, page, nextPage, goToPage, isLoading, filters, setFilters, rateGeneration, deleteGeneration };
}
