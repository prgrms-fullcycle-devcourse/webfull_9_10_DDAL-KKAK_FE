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
import {
  addJourney,
  deleteJourney,
  loadJourneys,
  updateJourney as updateJourneyLocal,
} from '@/features/journeys/storage';

/**
 * 백엔드 인증 토큰 존재 여부.
 * - 있음: 진짜 카카오 로그인 모드 → 백엔드 API 사용
 * - 없음: 데모 사용자 / 미로그인 모드 → localStorage 모킹 사용
 *
 * 5/15 데모 안정성 위해 두 모드 공존. 백엔드 통합 완료되면 단일화.
 */
function hasBackendAuth(): boolean {
  return !!localStorage.getItem('tt_access_token_v1');
}

async function sleep(ms: number) {
  await new Promise((r) => setTimeout(r, ms));
}

export function useJourneysQuery() {
  return useQuery({
    queryKey: ['journeys'],
    queryFn: async (): Promise<Journey[]> => {
      if (hasBackendAuth()) return fetchTrips();
      await sleep(150);
      return loadJourneys();
    },
  });
}

export function useJourneyQuery(journeyId: string | undefined) {
  return useQuery({
    queryKey: ['journeys', journeyId],
    enabled: !!journeyId,
    queryFn: async (): Promise<Journey> => {
      if (hasBackendAuth()) return fetchTrip(journeyId!);
      await sleep(120);
      const found = loadJourneys().find((j) => j.id === journeyId);
      if (!found) throw new Error('여정을 찾을 수 없어요.');
      return found;
    },
  });
}

export function useCreateJourneyMutation() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: CreateTripInput): Promise<Journey> => {
      if (hasBackendAuth()) return createTrip(input);
      await sleep(120);
      // localStorage 모드: id 자동 생성, 그대로 저장
      const journey: Journey = {
        ...(input as Journey),
        id: (input as Journey).id ?? crypto.randomUUID(),
      };
      addJourney(journey);
      return journey;
    },
    onSuccess: (newJourney) => {
      qc.setQueryData<Journey[]>(['journeys'], (prev = []) => [newJourney, ...prev]);
      qc.setQueryData(['journeys', newJourney.id], newJourney);
    },
  });
}

export function useUpdateJourneyMutation() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({
      id,
      patch,
    }: {
      id: string;
      patch: Partial<Journey>;
    }): Promise<Journey> => {
      if (hasBackendAuth()) return updateTrip(id, patch);
      await sleep(120);
      const all = updateJourneyLocal(id, patch);
      const updated = all.find((j) => j.id === id);
      if (!updated) throw new Error('여정을 찾을 수 없어요.');
      return updated;
    },
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
    mutationFn: async (id: string): Promise<void> => {
      if (hasBackendAuth()) {
        await deleteTrip(id);
        return;
      }
      await sleep(120);
      deleteJourney(id);
    },
    onSuccess: (_, id) => {
      qc.setQueryData<Journey[]>(['journeys'], (prev = []) => prev.filter((j) => j.id !== id));
      qc.removeQueries({ queryKey: ['journeys', id] });
      qc.removeQueries({ queryKey: ['expenses', id] });
    },
  });
}
