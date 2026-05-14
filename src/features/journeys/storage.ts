import { MOCK_JOURNEYS } from '@/mocks/data';
import type { CurrencyCode } from '@/types/common';
import type { Journey } from '@/features/journeys/types';
import { demoRateForCurrency } from '@/lib/currencyRates';
import { loadAllExpenses, saveAllExpenses } from '@/features/expenses/storage';

// v4: 수정 모드에서 authName이 selfParticipant를 덮어쓰던 버그로 인해
// 깨진 참가자/self 식별자를 가진 여정 캐시 무효화 (mock에서 재씨드)
const KEY = 'tt_journeys_v4';

const VALID_CURRENCY: readonly CurrencyCode[] = ['JPY', 'USD', 'EUR', 'KRW'];

function normalizeJourney(j: Journey): Journey {
  const currency = VALID_CURRENCY.includes(j.currency as CurrencyCode)
    ? (j.currency as CurrencyCode)
    : 'JPY';
  return { ...j, currency };
}

export function loadJourneys(): Journey[] {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return MOCK_JOURNEYS;
    const parsed = JSON.parse(raw) as Journey[];
    if (!Array.isArray(parsed) || parsed.length === 0) return MOCK_JOURNEYS;
    return parsed.map(normalizeJourney);
  } catch {
    return MOCK_JOURNEYS;
  }
}

export function saveJourneys(journeys: Journey[]) {
  localStorage.setItem(KEY, JSON.stringify(journeys));
}

export function addJourney(next: Journey) {
  const current = loadJourneys();
  const updated = [next, ...current];
  saveJourneys(updated);
  return updated;
}

export function updateJourney(id: string, patch: Partial<Journey>): Journey[] {
  const current = loadJourneys();
  const idx = current.findIndex((j) => j.id === id);
  if (idx === -1) throw new Error('여정을 찾을 수 없어요.');
  const merged: Journey = { ...current[idx], ...patch, id };
  const next = [...current];
  next[idx] = merged;
  saveJourneys(next);
  return next;
}

export function deleteJourney(id: string): Journey[] {
  const current = loadJourneys();
  const next = current.filter((j) => j.id !== id);
  saveJourneys(next);

  const expenses = loadAllExpenses();
  saveAllExpenses(expenses.filter((e) => e.journeyId !== id));

  // 참여자 캐시도 함께 삭제
  deleteParticipantsCache(id);

  return next;
}

// ─── 참여자 캐시 (백엔드 participants API 미배포 대비 → tripId 기준 localStorage 별도 저장) ───

const PARTICIPANTS_KEY = 'tt_trip_participants_v1';

type ParticipantsCache = {
  participants: string[];
  participantIdsByName: Record<string, string>;
};

function loadParticipantsMap(): Record<string, ParticipantsCache> {
  try {
    const raw = localStorage.getItem(PARTICIPANTS_KEY);
    if (!raw) return {};
    return JSON.parse(raw) as Record<string, ParticipantsCache>;
  } catch {
    return {};
  }
}

/** 여행 ID로 저장된 참여자 목록 조회. 없으면 undefined. */
export function loadParticipantsCache(tripId: string): ParticipantsCache | undefined {
  return loadParticipantsMap()[tripId];
}

/** 참여자 목록 저장. participants가 비어 있으면 삭제. */
export function saveParticipantsCache(
  tripId: string,
  participants: string[],
  participantIdsByName: Record<string, string>,
): void {
  const map = loadParticipantsMap();
  if (participants.length > 0) {
    map[tripId] = { participants, participantIdsByName };
  } else {
    delete map[tripId];
  }
  localStorage.setItem(PARTICIPANTS_KEY, JSON.stringify(map));
}

function deleteParticipantsCache(tripId: string): void {
  const map = loadParticipantsMap();
  delete map[tripId];
  localStorage.setItem(PARTICIPANTS_KEY, JSON.stringify(map));
}

/**
 * 카드·정산 계산용: rate가 1 이하(비정상)이면 데모 환율로 보완한 여행 객체.
 */
export function withEffectiveTripFinance(journey: Journey): Journey {
  if (journey.currency !== 'KRW' && (journey.rate <= 1 || !Number.isFinite(journey.rate))) {
    return { ...journey, rate: demoRateForCurrency(journey.currency as CurrencyCode) };
  }
  return journey;
}
