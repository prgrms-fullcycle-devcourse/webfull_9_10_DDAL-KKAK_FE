import { apiFetch } from '@/lib/api';
import type { Expense } from './types';

export type CreateExpenseInput = Omit<Expense, 'id' | 'createdAt' | 'updatedAt'>;

export async function createExpense(input: CreateExpenseInput): Promise<Expense> {
  return apiFetch<Expense>('/expenses', {
    method: 'POST',
    body: JSON.stringify(input),
  });
}
