import { apiFetch } from '@/lib/api';
import type { Journey } from './types';
import { ApiError } from '@/lib/api';
import { addJourney, deleteJourney, loadJourneys, updateJourney } from './storage';

type RawParticipant = string | { id?: string; name?: string };

function normalizeJourney(raw: Journey): Journey {
  const rawAny = raw as unknown as Record<string, unknown>;
  const resolvedName =
    (typeof rawAny.name === 'string' && rawAny.name) ||
    (typeof rawAny.title === 'string' && rawAny.title) ||
    '';

  const participantsRaw = rawAny.participants as RawParticipant[] | undefined;
  if (!Array.isArray(participantsRaw)) {
    return { ...raw, name: resolvedName || raw.name };
  }

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
    name: resolvedName || raw.name,
    participants: participants.length ? participants : raw.participants,
    participantIdsByName:
      Object.keys(participantIdsByName).length > 0
        ? participantIdsByName
        : raw.participantIdsByName,
  };
}

function serializeTrip(input: Partial<Journey> & { name?: string }): Record<string, unknown> {
  const { name, ...rest } = input;
  return {
    title: name, // 백엔드가 'title' 필드를 기대함
    ...rest,
  };
}

function isMockMode(): boolean {
  const hasToken = !!localStorage.getItem('tt_access_token_v1');
  return import.meta.env.VITE_USE_MOCK === 'true' || !hasToken;
}

export async function fetchTrips(): Promise<Journey[]> {
  if (isMockMode()) return loadJourneys();
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
  if (isMockMode()) {
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
  if (isMockMode()) {
    const id = `${Date.now()}-${Math.random().toString(16).slice(2)}`;
    const next: Journey = { ...input, id };
    addJourney(next);
    return next;
  }
  try {
    const created = await apiFetch<Journey>('/trips', {
      method: 'POST',
      body: JSON.stringify(serializeTrip(input)),
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
  if (isMockMode()) {
    const list = updateJourney(tripId, patch);
    const updated = list.find((j) => j.id === tripId);
    if (!updated) throw new Error('여정을 찾을 수 없어요.');
    return updated;
  }
  try {
    const updated = await apiFetch<Journey>(`/trips/${tripId}`, {
      method: 'PATCH',
      body: JSON.stringify(serializeTrip(patch)),
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
  if (isMockMode()) {
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
