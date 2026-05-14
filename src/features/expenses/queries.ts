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
import { fetchTrips } from '@/features/journeys/api';
import type { Journey } from '@/features/journeys/types';
import { isDemoLocalOnlyJourneyId } from '@/mocks/data';

async function sleep(ms: number) {
  await new Promise((r) => setTimeout(r, ms));
}

/**
 * 백엔드 인증 토큰 존재 여부.
 * journey queries(hasBackendAuth)와 동일 기준으로 맞춤.
 */
function hasBackendAuth(): boolean {
  return !!localStorage.getItem('tt_access_token_v1');
}

/**
 * API가 아직 준비되지 않은 상태 (인증 실패·미구현·지원 안 함).
 * 이 경우 로컬 스토리지 폴백 허용.
 */
function isApiNotAvailable(error: unknown): boolean {
  return (
    error instanceof ExpenseApiError &&
    (error.status === 401 || error.status === 404 || error.status === 501)
  );
}

export function useExpensesQuery(journeyId: string | undefined, userId?: string) {
  return useQuery({
    queryKey: ['expenses', journeyId],
    enabled: !!journeyId,
    queryFn: async (): Promise<Expense[]> => {
      await sleep(80);
      if (!journeyId) return [];
      // 로그인 안 됨 또는 데모 전용 여정 → 로컬 스토리지
      if (!userId || !hasBackendAuth() || isDemoLocalOnlyJourneyId(journeyId)) {
        return loadAllExpenses().filter((e) => e.journeyId === journeyId);
      }
      try {
        return await listExpensesApi({ tripId: journeyId });
      } catch (error) {
        if (isApiNotAvailable(error)) {
          return loadAllExpenses().filter((e) => e.journeyId === journeyId);
        }
        throw error;
      }
    },
  });
}

export function useAllExpensesQuery(userId?: string) {
  const qc = useQueryClient();
  return useQuery({
    queryKey: ['expenses'],
    queryFn: async (): Promise<Expense[]> => {
      await sleep(80);
      if (!userId || !hasBackendAuth()) return loadAllExpenses();
      try {
        // 캐시된 여정 목록 우선 사용, 없으면 API 조회
        const cached = qc.getQueryData<Journey[]>(['journeys']);
        const trips = cached !== undefined ? cached : await fetchTrips();
        const tripIds = trips.map((j) => j.id).filter((id) => !isDemoLocalOnlyJourneyId(id));
        if (tripIds.length === 0) return [];
        const rows = await Promise.all(tripIds.map((tripId) => listExpensesApi({ tripId })));
        return rows.flat();
      } catch (error) {
        if (isApiNotAvailable(error)) return loadAllExpenses();
        throw error;
      }
    },
  });
}

export function useAddExpenseMutation(userId?: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (expense: Expense) => {
      await sleep(100);
      if (!userId || !hasBackendAuth()) {
        return addExpense(expense).find((e) => e.id === expense.id) ?? expense;
      }
      try {
        return await createExpenseApi({ expense });
      } catch (error) {
        if (isApiNotAvailable(error)) {
          // 백엔드 미구현 환경에서는 로컬 저장으로 폴백
          return addExpense(expense).find((e) => e.id === expense.id) ?? expense;
        }
        throw error;
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
      await sleep(80);
      if (expenseId && userId && hasBackendAuth()) {
        try {
          return await getExpenseApi({ expenseId });
        } catch (error) {
          if (!isApiNotAvailable(error)) throw error;
          // 폴백: 로컬 스토리지
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
      await sleep(100);
      // React Query 캐시 우선 조회 → 없으면 로컬 스토리지
      // (백엔드 CUID로 저장된 지출은 localStorage에 없을 수 있음)
      const current = qc.getQueryData<Expense>(['expense', id]) ?? findExpenseById(id);
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
      if (userId && hasBackendAuth()) {
        try {
          return await patchExpenseApi({ expenseId: id, patch, fallback });
        } catch (error) {
          if (!isApiNotAvailable(error)) throw error;
          // 폴백: 로컬 저장
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
      await sleep(100);
      if (userId && hasBackendAuth()) {
        try {
          await deleteExpenseApi({ expenseId: id });
        } catch (error) {
          if (!isApiNotAvailable(error)) throw error;
          // 폴백: 로컬 삭제로 진행
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
