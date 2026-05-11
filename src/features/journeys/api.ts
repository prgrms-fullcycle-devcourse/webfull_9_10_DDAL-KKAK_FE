import { apiFetch } from '@/lib/api';
import type { Journey } from './types';
import { ApiError } from '@/lib/api';
import { addJourney, deleteJourney, loadJourneys, updateJourney } from './storage';

type RawParticipant = string | { id?: string; name?: string };

const STATUS_FROM_API: Record<string, Journey['status']> = {
  PLANNING: 'planned',
  ONGOING: 'active',
  COMPLETED: 'ended',
};
const STATUS_TO_API: Record<Journey['status'], string> = {
  planned: 'PLANNING',
  active: 'ONGOING',
  ended: 'COMPLETED',
};

function normalizeJourney(raw: Journey): Journey {
  const r = raw as unknown as Record<string, unknown>;

  const resolvedName =
    (typeof r.name === 'string' && r.name) || (typeof r.title === 'string' && r.title) || '';

  const resolvedCurrency =
    (typeof r.currencyCode === 'string' && r.currencyCode) ||
    (typeof r.currency === 'string' && r.currency) ||
    raw.currency ||
    'KRW';

  const rawStatus = typeof r.status === 'string' ? r.status : '';
  const resolvedStatus: Journey['status'] =
    STATUS_FROM_API[rawStatus] ?? (raw.status as Journey['status']) ?? 'active';

  const participantsRaw = r.participants as RawParticipant[] | undefined;
  const participants: string[] = [];
  const participantIdsByName: Record<string, string> = {};

  if (Array.isArray(participantsRaw)) {
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
  }

  return {
    ...raw,
    name: resolvedName || raw.name,
    currency: resolvedCurrency as Journey['currency'],
    status: resolvedStatus,
    ...(participants.length && { participants }),
    ...(Object.keys(participantIdsByName).length && { participantIdsByName }),
  };
}

function serializeTrip(input: Partial<Journey> & { name?: string }): Record<string, unknown> {
  const payload: Record<string, unknown> = {};

  if (input.name !== undefined) payload.title = input.name;
  if (input.country !== undefined) payload.country = input.country;
  if (input.currency !== undefined) payload.currencyCode = input.currency;
  if (input.rate !== undefined) payload.exchangeRate = input.rate;
  if (input.rateMode !== undefined) payload.rateMode = input.rateMode;
  if (input.startDate !== undefined) payload.startDate = input.startDate;
  if (input.endDate !== undefined) payload.endDate = input.endDate;
  if (input.budgetKRW !== undefined) payload.budgetKrw = input.budgetKRW;
  if (input.status !== undefined) payload.status = STATUS_TO_API[input.status] ?? input.status;

  // participants: string[] → [{name: string}]
  if (input.participants !== undefined) {
    payload.participants = input.participants.map((name) => ({ name }));
  }

  return payload;
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
