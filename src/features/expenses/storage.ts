import { MOCK_EXPENSES } from '@/mocks/data';
import type { Expense } from '@/features/expenses/types';

// journeys_v4와 함께 expense 캐시도 초기화 (목데이터 재씨드)
const KEY = 'tt_expenses_v4';

export function loadAllExpenses(): Expense[] {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return MOCK_EXPENSES;
    const parsed = JSON.parse(raw) as Expense[];
    return Array.isArray(parsed) ? parsed : MOCK_EXPENSES;
  } catch {
    return MOCK_EXPENSES;
  }
}

export function saveAllExpenses(expenses: Expense[]) {
  localStorage.setItem(KEY, JSON.stringify(expenses));
}

export function addExpense(expense: Expense) {
  const all = loadAllExpenses();
  const next = [...all, expense];
  saveAllExpenses(next);
  return next;
}

export function findExpenseById(id: string): Expense | undefined {
  return loadAllExpenses().find((e) => e.id === id);
}

export function updateExpense(id: string, patch: Partial<Expense>): Expense[] {
  const all = loadAllExpenses();
  const idx = all.findIndex((e) => e.id === id);
  if (idx === -1) throw new Error('소비 내역을 찾을 수 없어요.');
  const merged: Expense = {
    ...all[idx],
    ...patch,
    id,
    updatedAt: new Date().toISOString(),
  };
  const next = [...all];
  next[idx] = merged;
  saveAllExpenses(next);
  return next;
}

export function deleteExpense(id: string): Expense[] {
  const next = loadAllExpenses().filter((e) => e.id !== id);
  saveAllExpenses(next);
  return next;
}
