import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { Journey } from '@/features/journeys/types';
import {
  createTrip,
  deleteTrip,
  fetchTrip,
  fetchTrips,
  updateTrip,
  type CreateTripInput,
} from '@/features/journeys/api';

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
    mutationFn: ({ id, patch }: { id: string; patch: Partial<Journey> }) => updateTrip(id, patch),
    onSuccess: (updatedJourney) => {
      qc.setQueryData<Journey[]>(['journeys'], (prev = []) =>
        prev.map((j) => (j.id === updatedJourney.id ? updatedJourney : j)),
      );
      qc.setQueryData(['journeys', updatedJourney.id], updatedJourney);
    },
  });
}

export function useDeleteJourneyMutation() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => deleteTrip(id),
    onSuccess: (_, id) => {
      qc.setQueryData<Journey[]>(['journeys'], (prev = []) => prev.filter((j) => j.id !== id));
      qc.removeQueries({ queryKey: ['journeys', id] });
      qc.removeQueries({ queryKey: ['expenses', id] });
    },
  });
}
