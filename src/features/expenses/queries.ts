import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { Expense } from '@/features/expenses/types';
import {
  ExpenseApiError,
  createExpenseApi,
  patchExpenseApi,
} from '@/features/expenses/expensesApi';
import {
  addExpense,
  deleteExpense,
  findExpenseById,
  loadAllExpenses,
  updateExpense,
} from '@/features/expenses/storage';
import { createExpense, type CreateExpenseInput } from '@/features/expenses/api';

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

export function useAddExpenseMutation(userId?: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (expense: Expense) => {
      await sleep(100);
      if (!userId) {
        return addExpense(expense).find((e) => e.id === expense.id) ?? expense;
      }
      try {
        return await createExpenseApi({ expense, userId });
      } catch (error) {
        if (error instanceof ExpenseApiError && error.status !== 404) throw error;
        // 백엔드 /expenses 미구현(404) 환경에서는 로컬 저장으로 폴백
        return addExpense(expense).find((e) => e.id === expense.id) ?? expense;
      }
    },
    onSuccess: (saved) => {
      qc.setQueryData(['expense', saved.id], saved);
      qc.invalidateQueries({ queryKey: ['expenses', saved.journeyId] });
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

export function useUpdateExpenseMutation(userId?: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({
      id,
      patch,
    }: {
      id: string;
      patch: Omit<Partial<Expense>, 'receiptId'> & { journeyId: string; receiptId?: string | null };
    }) => {
      await sleep(100);
      const current = findExpenseById(id);
      if (!current) throw new Error('소비 내역을 찾을 수 없어요.');
      const fallback: Expense = {
        ...current,
        ...patch,
        id,
        receiptId:
          patch.receiptId === null
            ? undefined
            : patch.receiptId === undefined
              ? current.receiptId
              : patch.receiptId,
        updatedAt: new Date().toISOString(),
      };
      if (userId) {
        try {
          return await patchExpenseApi({ expenseId: id, patch, fallback, userId });
        } catch (error) {
          if (error instanceof ExpenseApiError && error.status !== 404) throw error;
          // 백엔드 /expenses 미구현(404) 환경에서는 로컬 저장으로 폴백
        }
      }
      const storagePatch: Partial<Expense> = {
        ...patch,
        receiptId: patch.receiptId === null ? undefined : patch.receiptId,
      };
      const all = updateExpense(id, storagePatch);
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
