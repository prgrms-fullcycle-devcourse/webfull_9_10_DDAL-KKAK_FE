import { MOCK_JOURNEYS } from '@/mocks/data';
import type { CurrencyCode } from '@/types/common';
import type { Journey } from '@/features/journeys/types';
import { loadAllExpenses, saveAllExpenses } from '@/features/expenses/storage';

const KEY = 'tt_journeys_v2';

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

  return next;
}
