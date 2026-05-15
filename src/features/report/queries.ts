import { useQuery } from '@tanstack/react-query';
import { getReport } from './api';

export const reportKeys = {
  all: ['reports'] as const,
  detail: (journeyId: string) => [...reportKeys.all, 'detail', journeyId] as const,
};

export const useReportQuery = (journeyId: string | undefined) => {
  return useQuery({
    queryKey: reportKeys.detail(journeyId ?? ''),
    queryFn: () => getReport(journeyId!),
    enabled: !!journeyId,
    staleTime: 1000 * 60 * 10,
    gcTime: 1000 * 60 * 30,
  });
};
