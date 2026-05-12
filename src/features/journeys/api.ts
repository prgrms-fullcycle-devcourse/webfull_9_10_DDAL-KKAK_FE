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

function normalizeJourney(raw: Journey): Journey {
  const r = raw as unknown as Record<string, unknown>;

  const resolvedName =
    (typeof r.name === 'string' && r.name) || (typeof r.title === 'string' && r.title) || '';

  const resolvedCurrency =
    (typeof r.tripCurrencyCode === 'string' && r.tripCurrencyCode) ||
    (typeof r.currencyCode === 'string' && r.currencyCode) ||
    (typeof r.currency === 'string' && r.currency) ||
    'KRW';

  const resolvedRate =
    typeof r.fixedExchangeRate === 'number'
      ? r.fixedExchangeRate
      : typeof r.rate === 'number'
        ? r.rate
        : 1;

  const rawFxMode = typeof r.defaultFxMode === 'string' ? r.defaultFxMode.toLowerCase() : '';
  const resolvedRateMode: Journey['rateMode'] =
    rawFxMode === 'fixed' || rawFxMode === 'realtime'
      ? (rawFxMode as Journey['rateMode'])
      : (raw.rateMode ?? 'fixed');

  const rawStatus = typeof r.status === 'string' ? r.status : '';
  const resolvedStatus: Journey['status'] =
    STATUS_FROM_API[rawStatus] ?? (raw.status as Journey['status']) ?? 'active';

  const resolvedStartDate =
    typeof r.startDate === 'string' ? r.startDate.slice(0, 10) : raw.startDate;
  const resolvedEndDate =
    typeof r.endDate === 'string' ? r.endDate.slice(0, 10) : raw.endDate;

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
    rate: resolvedRate,
    rateMode: resolvedRateMode,
    status: resolvedStatus,
    startDate: resolvedStartDate,
    endDate: resolvedEndDate,
    ...(participants.length && { participants }),
    ...(Object.keys(participantIdsByName).length && { participantIdsByName }),
  };
}

function serializeTrip(input: Partial<Journey> & { name?: string }): Record<string, unknown> {
  const payload: Record<string, unknown> = {};

  if (input.name !== undefined) payload.title = input.name;
  payload.tripCurrencyCode = input.currency ?? 'KRW';
  if (input.rateMode !== undefined) payload.defaultFxMode = input.rateMode.toUpperCase();
  if (input.rate !== undefined) payload.fixedExchangeRate = input.rate;
  if (input.startDate !== undefined) payload.startDate = input.startDate;
  if (input.endDate !== undefined) payload.endDate = input.endDate;

  return payload;
}

async function addParticipant(
  tripId: string,
  name: string,
): Promise<{ id: string; name: string }> {
  return apiFetch(`/trips/${tripId}/participants`, {
    method: 'POST',
    body: JSON.stringify({ name }),
  });
}

async function removeParticipant(tripId: string, participantId: string): Promise<void> {
  await apiFetch(`/trips/${tripId}/participants/${participantId}`, { method: 'DELETE' });
}

/**
 * 기존 참여자(existingIds)와 새 목록(nextNames)을 비교해 추가/삭제.
 * 이름이 existingIds에 없으면 추가, nextNames에 없으면 삭제.
 */
async function syncParticipants(
  tripId: string,
  existingIds: Record<string, string>,
  nextNames: string[],
): Promise<Record<string, string>> {
  const toDelete = Object.entries(existingIds).filter(([name]) => !nextNames.includes(name));
  const toAdd = nextNames.filter((name) => !(name in existingIds));

  await Promise.all(toDelete.map(([, id]) => removeParticipant(tripId, id)));

  const added = await Promise.all(toAdd.map((name) => addParticipant(tripId, name)));

  const next = { ...existingIds };
  for (const [name] of toDelete) delete next[name];
  for (const { id, name } of added) next[name] = id;

  return next;
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
    const trip = normalizeJourney(created);

    // 여행 생성 후 참여자 개별 등록
    if (input.participants?.length) {
      const participantIdsByName = await syncParticipants(trip.id, {}, input.participants);
      return { ...trip, participants: input.participants, participantIdsByName };
    }

    return trip;
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
    const trip = normalizeJourney(updated);

    // 참여자 diff: 기존 ID 맵과 새 목록 비교
    if (patch.participants !== undefined) {
      const existingIds = patch.participantIdsByName ?? trip.participantIdsByName ?? {};
      const participantIdsByName = await syncParticipants(tripId, existingIds, patch.participants);
      return { ...trip, participants: patch.participants, participantIdsByName };
    }

    return trip;
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
