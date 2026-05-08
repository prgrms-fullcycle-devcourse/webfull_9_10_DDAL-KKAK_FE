import { apiFetch } from '@/lib/api';
import type { Journey } from './types';
import { ApiError } from '@/lib/api';
import { addJourney, deleteJourney, loadJourneys, updateJourney } from './storage';

function useMockTrips(): boolean {
  // 개발 단계에선 "백엔드 인증 토큰이 없으면" trips API를 치지 않고
  // 로컬스토리지(mock)로 동작하게 해서 401로 화면이 막히지 않게 한다.
  const hasToken = !!localStorage.getItem('tt_access_token_v1');
  return import.meta.env.DEV || import.meta.env.VITE_USE_MOCK === 'true' || !hasToken;
}

export async function fetchTrips(): Promise<Journey[]> {
  if (useMockTrips()) return loadJourneys();
  try {
    return await apiFetch<Journey[]>('/trips');
  } catch (e) {
    // 데모/개발 단계: trips API가 없거나(404/501) 인증이 없으면(401) 목데이터로 폴백
    if (e instanceof ApiError && (e.status === 401 || e.status === 404 || e.status === 501)) {
      return loadJourneys();
    }
    throw e;
  }
}

export async function fetchTrip(tripId: string): Promise<Journey> {
  if (useMockTrips()) {
    const found = loadJourneys().find((j) => j.id === tripId);
    if (!found) throw new Error('여정을 찾을 수 없어요.');
    return found;
  }
  try {
    return await apiFetch<Journey>(`/trips/${tripId}`);
  } catch (e) {
    if (e instanceof ApiError && (e.status === 401 || e.status === 404 || e.status === 501)) {
      const found = loadJourneys().find((j) => j.id === tripId);
      if (!found) throw new Error('여정을 찾을 수 없어요.');
      return found;
    }
    throw e;
  }
}

export type CreateTripInput = Omit<Journey, 'id'>;

export async function createTrip(input: CreateTripInput): Promise<Journey> {
  if (useMockTrips()) {
    const id = `${Date.now()}-${Math.random().toString(16).slice(2)}`;
    const next: Journey = { ...input, id };
    addJourney(next);
    return next;
  }
  try {
    return await apiFetch<Journey>('/trips', {
      method: 'POST',
      body: JSON.stringify(input),
    });
  } catch (e) {
    if (e instanceof ApiError && (e.status === 401 || e.status === 404 || e.status === 501)) {
      const id = `${Date.now()}-${Math.random().toString(16).slice(2)}`;
      const next: Journey = { ...input, id };
      addJourney(next);
      return next;
    }
    throw e;
  }
}

export async function updateTrip(tripId: string, patch: Partial<Journey>): Promise<Journey> {
  if (useMockTrips()) {
    const list = updateJourney(tripId, patch);
    const updated = list.find((j) => j.id === tripId);
    if (!updated) throw new Error('여정을 찾을 수 없어요.');
    return updated;
  }
  try {
    return await apiFetch<Journey>(`/trips/${tripId}`, {
      method: 'PATCH',
      body: JSON.stringify(patch),
    });
  } catch (e) {
    if (e instanceof ApiError && (e.status === 401 || e.status === 404 || e.status === 501)) {
      const list = updateJourney(tripId, patch);
      const updated = list.find((j) => j.id === tripId);
      if (!updated) throw new Error('여정을 찾을 수 없어요.');
      return updated;
    }
    throw e;
  }
}

export async function deleteTrip(tripId: string): Promise<void> {
  if (useMockTrips()) {
    deleteJourney(tripId);
    return;
  }
  try {
    await apiFetch<void>(`/trips/${tripId}`, { method: 'DELETE' });
  } catch (e) {
    if (e instanceof ApiError && (e.status === 401 || e.status === 404 || e.status === 501)) {
      deleteJourney(tripId);
      return;
    }
    throw e;
  }
}
