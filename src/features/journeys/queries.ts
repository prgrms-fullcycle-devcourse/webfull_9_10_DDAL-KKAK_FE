import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { Journey } from '@/features/journeys/types';
import { deleteJourney, loadJourneys, updateJourney } from '@/features/journeys/storage';
import { createTrip, fetchTrip, fetchTrips, type CreateTripInput } from '@/features/journeys/api';

async function sleep(ms: number) {
  await new Promise((r) => setTimeout(r, ms));
}

export function useJourneysQuery() {
  return useQuery({
    queryKey: ['journeys'],
    queryFn: (): Promise<Journey[]> => fetchTrips(),
  });
}

export function useJourneyQuery(journeyId: string | undefined) {
  return useQuery({
    queryKey: ['journeys', journeyId],
    enabled: !!journeyId,
    queryFn: (): Promise<Journey> => fetchTrip(journeyId!),
  });
}

export function useCreateJourneyMutation() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: CreateTripInput) => createTrip(input),
    onSuccess: (newJourney) => {
      qc.setQueryData<Journey[]>(['journeys'], (prev = []) => [newJourney, ...prev]);
      qc.setQueryData(['journeys', newJourney.id], newJourney);
    },
  });
}

export function useUpdateJourneyMutation() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, patch }: { id: string; patch: Partial<Journey> }) => {
      await sleep(150);
      return updateJourney(id, patch);
    },
    onSuccess: (journeys, { id }) => {
      qc.setQueryData(['journeys'], journeys);
      const updated = journeys.find((j) => j.id === id);
      if (updated) qc.setQueryData(['journeys', id], updated);
    },
  });
}

export function useDeleteJourneyMutation() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      await sleep(150);
      return deleteJourney(id);
    },
    onSuccess: (journeys, id) => {
      qc.setQueryData(['journeys'], journeys);
      qc.removeQueries({ queryKey: ['journeys', id] });
      qc.removeQueries({ queryKey: ['expenses', id] });
    },
  });
}
