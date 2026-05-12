import { MOCK_JOURNEYS } from '@/mocks/data';
import type { CurrencyCode } from '@/types/common';
import type { Journey } from '@/features/journeys/types';
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

  // 예산 정보도 함께 삭제
  deleteBudget(id);

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
