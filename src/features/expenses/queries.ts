import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import type { Expense } from '../../types'
import { addExpense, loadAllExpenses } from './storage'

async function sleep(ms: number) {
  await new Promise((r) => setTimeout(r, ms))
}

export function useExpensesQuery(journeyId: string | undefined) {
  return useQuery({
    queryKey: ['expenses', journeyId],
    enabled: !!journeyId,
    queryFn: async (): Promise<Expense[]> => {
      await sleep(80)
      return loadAllExpenses().filter((e) => e.journeyId === journeyId)
    },
  })
}

export function useAllExpensesQuery() {
  return useQuery({
    queryKey: ['expenses'],
    queryFn: async (): Promise<Expense[]> => {
      await sleep(80)
      return loadAllExpenses()
    },
  })
}

export function useAddExpenseMutation() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (expense: Expense) => {
      await sleep(100)
      return addExpense(expense)
    },
    onSuccess: (_all, expense) => {
      qc.invalidateQueries({ queryKey: ['expenses', expense.journeyId] })
      qc.invalidateQueries({ queryKey: ['expenses'] })
    },
  })
}

