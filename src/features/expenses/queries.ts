import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { Expense } from '@/features/expenses/types';
import {
  addExpense,
  deleteExpense,
  findExpenseById,
  loadAllExpenses,
  updateExpense,
} from '@/features/expenses/storage';

async function sleep(ms: number) {
  await new Promise((r) => setTimeout(r, ms));
}

export function useExpensesQuery(journeyId: string | undefined) {
  return useQuery({
    queryKey: ['expenses', journeyId],
    enabled: !!journeyId,
    queryFn: async (): Promise<Expense[]> => {
      await sleep(80);
      return loadAllExpenses().filter((e) => e.journeyId === journeyId);
    },
  });
}

export function useAllExpensesQuery() {
  return useQuery({
    queryKey: ['expenses'],
    queryFn: async (): Promise<Expense[]> => {
      await sleep(80);
      return loadAllExpenses();
    },
  });
}

export function useAddExpenseMutation() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (expense: Expense) => {
      await sleep(100);
      return addExpense(expense);
    },
    onSuccess: (_all, expense) => {
      qc.invalidateQueries({ queryKey: ['expenses', expense.journeyId] });
      qc.invalidateQueries({ queryKey: ['expenses'] });
    },
  });
}

export function useExpenseQuery(expenseId: string | undefined) {
  return useQuery({
    queryKey: ['expense', expenseId],
    enabled: !!expenseId,
    queryFn: async (): Promise<Expense> => {
      await sleep(80);
      const found = findExpenseById(expenseId!);
      if (!found) throw new Error('소비 내역을 찾을 수 없어요.');
      return found;
    },
  });
}

export function useUpdateExpenseMutation() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, patch }: { id: string; patch: Partial<Expense> }) => {
      await sleep(100);
      const all = updateExpense(id, patch);
      return all.find((e) => e.id === id)!;
    },
    onSuccess: (updated) => {
      qc.setQueryData(['expense', updated.id], updated);
      qc.invalidateQueries({ queryKey: ['expenses', updated.journeyId] });
      qc.invalidateQueries({ queryKey: ['expenses'] });
    },
  });
}

export function useDeleteExpenseMutation() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, journeyId }: { id: string; journeyId: string }) => {
      await sleep(100);
      deleteExpense(id);
      return { id, journeyId };
    },
    onSuccess: ({ id, journeyId }) => {
      qc.removeQueries({ queryKey: ['expense', id] });
      qc.invalidateQueries({ queryKey: ['expenses', journeyId] });
      qc.invalidateQueries({ queryKey: ['expenses'] });
    },
  });
}
