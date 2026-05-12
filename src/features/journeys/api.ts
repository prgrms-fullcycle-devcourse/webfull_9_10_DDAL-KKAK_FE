import { apiFetch } from '@/lib/api';
import type { Journey } from './types';
import { ApiError } from '@/lib/api';
import { addJourney, deleteJourney, loadJourneys, updateJourney } from './storage';

type RawParticipant = string | { id?: string; name?: string };

function normalizeJourney(raw: Journey): Journey {
  const participantsRaw = (raw as unknown as { participants?: RawParticipant[] }).participants;
  if (!Array.isArray(participantsRaw)) return raw;

  const participants: string[] = [];
  const participantIdsByName: Record<string, string> = {};

  for (const p of participantsRaw) {
    if (typeof p === 'string') {
      participants.push(p);
      continue;
    }
    const name = typeof p.name === 'string' ? p.name.trim() : '';
    const id = typeof p.id === 'string' ? p.id.trim() : '';
    if (!name) continue;
    participants.push(name);
    if (id) participantIdsByName[name] = id;
  }

  return {
    ...raw,
    participants: participants.length ? participants : raw.participants,
    participantIdsByName:
      Object.keys(participantIdsByName).length > 0
        ? participantIdsByName
        : raw.participantIdsByName,
  };
}

function shouldUseMockTrips(): boolean {
  // 개발 단계에선 "백엔드 인증 토큰이 없으면" trips API를 치지 않고
  // 로컬스토리지(mock)로 동작하게 해서 401로 화면이 막히지 않게 한다.
  const hasToken = !!localStorage.getItem('tt_access_token_v1');
  return import.meta.env.DEV || import.meta.env.VITE_USE_MOCK === 'true' || !hasToken;
}

export function isMockMode(): boolean {
  return shouldUseMockTrips();
}

export async function fetchTrips(): Promise<Journey[]> {
  if (shouldUseMockTrips()) return loadJourneys();
  try {
    const list = await apiFetch<Journey[]>('/trips');
    return list.map(normalizeJourney);
  } catch (e) {
    // 데모/개발 단계: trips API가 없거나(404/501) 인증이 없으면(401) 목데이터로 폴백
    if (e instanceof ApiError && (e.status === 401 || e.status === 404 || e.status === 501)) {
      return loadJourneys();
    }
    throw e;
  }
}

export async function fetchTrip(tripId: string): Promise<Journey> {
  if (shouldUseMockTrips()) {
    const found = loadJourneys().find((j) => j.id === tripId);
    if (!found) throw new Error('여정을 찾을 수 없어요.');
    return found;
  }
  try {
    const trip = await apiFetch<Journey>(`/trips/${tripId}`);
    return normalizeJourney(trip);
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
  if (shouldUseMockTrips()) {
    const id = `${Date.now()}-${Math.random().toString(16).slice(2)}`;
    const next: Journey = { ...input, id };
    addJourney(next);
    return next;
  }
  try {
    const created = await apiFetch<Journey>('/trips', {
      method: 'POST',
      body: JSON.stringify(input),
    });
    return normalizeJourney(created);
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
  if (shouldUseMockTrips()) {
    const list = updateJourney(tripId, patch);
    const updated = list.find((j) => j.id === tripId);
    if (!updated) throw new Error('여정을 찾을 수 없어요.');
    return updated;
  }
  try {
    const updated = await apiFetch<Journey>(`/trips/${tripId}`, {
      method: 'PATCH',
      body: JSON.stringify(patch),
    });
    return normalizeJourney(updated);
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
  if (shouldUseMockTrips()) {
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
