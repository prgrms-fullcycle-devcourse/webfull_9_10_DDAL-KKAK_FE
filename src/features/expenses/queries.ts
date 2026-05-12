import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { Expense } from '@/features/expenses/types';
import {
  ExpenseApiError,
  createExpenseApi,
  deleteExpenseApi,
  getExpenseApi,
  listExpensesApi,
  patchExpenseApi,
} from '@/features/expenses/expensesApi';
import {
  addExpense,
  deleteExpense,
  findExpenseById,
  loadAllExpenses,
  updateExpense,
} from '@/features/expenses/storage';
import { loadJourneys } from '@/features/journeys/storage';

function shouldUseExpenseFallback(): boolean {
  // 명시적 mock 설정 시에만 로컬스토리지로 폴백.
  // userId 없으면 각 mutation에서 직접 처리.
  return import.meta.env.VITE_USE_MOCK === 'true';
}

export function useExpensesQuery(
  journeyId: string | undefined,
  userId?: string,
  participantIdsByName?: Record<string, string>,
) {
  return useQuery({
    queryKey: ['expenses', journeyId],
    enabled: !!journeyId,
    queryFn: async (): Promise<Expense[]> => {
      if (!journeyId) return [];
      if (!userId) return loadAllExpenses().filter((e) => e.journeyId === journeyId);
      try {
        return await listExpensesApi({ tripId: journeyId, userId });
      } catch (error) {
        if (
          shouldUseExpenseFallback() &&
          error instanceof ExpenseApiError &&
          error.status === 404
        ) {
          return loadAllExpenses().filter((e) => e.journeyId === journeyId);
        }
        throw error;
      }
    },
    select: (expenses: Expense[]) => {
      if (!participantIdsByName) return expenses;
      const idToName = Object.fromEntries(
        Object.entries(participantIdsByName).map(([name, id]) => [id, name]),
      );
      return expenses.map((e) => ({
        ...e,
        payer: (e.payerParticipantId && idToName[e.payerParticipantId]) || e.payer,
      }));
    },
  });
}

export function useAllExpensesQuery(userId?: string) {
  return useQuery({
    queryKey: ['expenses'],
    queryFn: async (): Promise<Expense[]> => {
      if (!userId) return loadAllExpenses();
      try {
        const tripIds = loadJourneys().map((j) => j.id);
        const rows = await Promise.all(
          tripIds.map((tripId) => listExpensesApi({ tripId, userId })),
        );
        return rows.flat();
      } catch (error) {
        if (
          shouldUseExpenseFallback() &&
          error instanceof ExpenseApiError &&
          error.status === 404
        ) {
          return loadAllExpenses();
        }
        throw error;
      }
    },
  });
}

export function useAddExpenseMutation(userId?: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (expense: Expense) => {
      if (!userId) {
        return addExpense(expense).find((e) => e.id === expense.id) ?? expense;
      }
      try {
        return await createExpenseApi({ expense, userId });
      } catch (error) {
        if (
          !(shouldUseExpenseFallback() && error instanceof ExpenseApiError && error.status === 404)
        ) {
          throw error;
        }
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

export function useExpenseQuery(expenseId: string | undefined, userId?: string) {
  return useQuery({
    queryKey: ['expense', expenseId],
    enabled: !!expenseId,
    queryFn: async (): Promise<Expense> => {
      if (expenseId && userId) {
        try {
          return await getExpenseApi({ expenseId, userId });
        } catch (error) {
          if (
            !(
              shouldUseExpenseFallback() &&
              error instanceof ExpenseApiError &&
              error.status === 404
            )
          ) {
            throw error;
          }
        }
      }
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
          if (
            !(
              shouldUseExpenseFallback() &&
              error instanceof ExpenseApiError &&
              error.status === 404
            )
          ) {
            throw error;
          }
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

export function useDeleteExpenseMutation(userId?: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, journeyId }: { id: string; journeyId: string }) => {
      if (userId) {
        try {
          await deleteExpenseApi({ expenseId: id, userId });
        } catch (error) {
          if (
            !(
              shouldUseExpenseFallback() &&
              error instanceof ExpenseApiError &&
              error.status === 404
            )
          ) {
            throw error;
          }
        }
      }
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
