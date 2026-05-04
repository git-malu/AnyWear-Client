import { useState, useCallback } from 'react';
import { useGetVtoGenerations, usePatchVtoGenerationsGenerationIdRating, useDeleteVtoGenerationsGenerationId } from '../api/endpoints/vto/vto';
import type { GetVtoGenerationsParams } from '../api/model/getVtoGenerationsParams';
import { keepPreviousData } from '@tanstack/react-query';

const DEFAULT_LIMIT = 12;

export default function useVtoHistory() {
  const [page, setPage] = useState(1);
  const [filters, setFilters] = useState<GetVtoGenerationsParams>({ limit: DEFAULT_LIMIT });

  const params: GetVtoGenerationsParams = {
    ...filters,
    page,
    limit: DEFAULT_LIMIT,
  };

  const { data, isLoading, refetch } = useGetVtoGenerations(params, {
    query: { placeholderData: keepPreviousData },
  });

  const rateMutation = usePatchVtoGenerationsGenerationIdRating();
  const deleteMutation = useDeleteVtoGenerationsGenerationId();

  const generations = data?.generations ?? [];
  const total = data?.total ?? 0;
  const nextPage = data?.nextPage ?? null;

  const goToPage = useCallback((newPage: number) => {
    setPage(newPage);
  }, []);

  const rateGeneration = useCallback((generationId: string, rating: number) => {
    rateMutation.mutate(
      { generationId, data: { rating } },
      {
        onSuccess: () => {
          refetch();
        },
      }
    );
  }, [rateMutation, refetch]);

  const deleteGeneration = useCallback((generationId: string) => {
    deleteMutation.mutate(
      { generationId },
      {
        onSuccess: () => {
          refetch();
        },
      }
    );
  }, [deleteMutation, refetch]);

  return { generations, total, page, nextPage, goToPage, isLoading, filters, setFilters, rateGeneration, deleteGeneration };
}
