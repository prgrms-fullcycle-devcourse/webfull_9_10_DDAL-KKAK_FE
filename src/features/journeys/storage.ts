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

  // 예산·참여자·환율 캐시도 함께 삭제
  deleteBudget(id);
  deleteParticipantsCache(id);
  deleteRateCache(id);

  return next;
}

// ─── 목표 예산 (API 미지원 필드 → tripId 기준 localStorage 별도 저장) ───

const BUDGET_KEY = 'tt_trip_budgets_v1';

function loadBudgetMap(): Record<string, number> {
  try {
    const raw = localStorage.getItem(BUDGET_KEY);
    if (!raw) return {};
    return JSON.parse(raw) as Record<string, number>;
  } catch {
    return {};
  }
}

/** 여행 ID로 목표 예산(원) 조회. 없으면 undefined. */
export function loadBudget(tripId: string): number | undefined {
  const map = loadBudgetMap();
  const v = map[tripId];
  return typeof v === 'number' && v > 0 ? v : undefined;
}

/** 목표 예산 저장. budget이 없거나 0이하면 해당 항목을 삭제. */
export function saveBudget(tripId: string, budget: number | undefined): void {
  const map = loadBudgetMap();
  if (budget !== undefined && budget > 0) {
    map[tripId] = budget;
  } else {
    delete map[tripId];
  }
  localStorage.setItem(BUDGET_KEY, JSON.stringify(map));
}

function deleteBudget(tripId: string): void {
  saveBudget(tripId, undefined);
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

// ─── 환율 캐시 (백엔드가 fixedExchangeRate를 반환하지 않는 경우 localStorage로 보완) ───

const RATE_KEY = 'tt_trip_rates_v1';

type RateCache = {
  rate: number;
  rateMode: string;
};

function loadRateMap(): Record<string, RateCache> {
  try {
    const raw = localStorage.getItem(RATE_KEY);
    if (!raw) return {};
    return JSON.parse(raw) as Record<string, RateCache>;
  } catch {
    return {};
  }
}

/** 여행 ID로 저장된 환율 조회. 없으면 undefined. */
export function loadRateCache(tripId: string): RateCache | undefined {
  return loadRateMap()[tripId];
}

/** 환율 저장 (rate > 1인 경우만 의미 있음). */
export function saveRateCache(tripId: string, rate: number, rateMode: string): void {
  const map = loadRateMap();
  map[tripId] = { rate, rateMode };
  localStorage.setItem(RATE_KEY, JSON.stringify(map));
}

function deleteRateCache(tripId: string): void {
  const map = loadRateMap();
  delete map[tripId];
  localStorage.setItem(RATE_KEY, JSON.stringify(map));
}

/**
 * 카드·정산 계산용: API가 rate=1·예산 없이 내려줄 때 로컬 캐시·데모 환율·저장 예산을 합친 여행 객체.
 * (타임라인 `useMemo`와 동일 기준 — 현지 잔액 표시가 원화와 숫자만 같은 버그 방지)
 */
export function withEffectiveTripFinance(journey: Journey): Journey {
  let rate =
    typeof journey.rate === 'number' && Number.isFinite(journey.rate) && journey.rate > 0
      ? journey.rate
      : 1;
  const cached = loadRateCache(journey.id);
  if (cached && typeof cached.rate === 'number' && cached.rate > 1) {
    rate = cached.rate;
  } else if (rate === 1 && journey.currency !== 'KRW') {
    rate = demoRateForCurrency(journey.currency as CurrencyCode);
  }

  const withRate: Journey = { ...journey, rate };

  const stored = loadBudget(withRate.id);
  if (
    (withRate.budgetKRW == null || withRate.budgetKRW <= 0) &&
    stored !== undefined &&
    stored > 0
  ) {
    return { ...withRate, budgetKRW: stored };
  }

  return withRate;
}
