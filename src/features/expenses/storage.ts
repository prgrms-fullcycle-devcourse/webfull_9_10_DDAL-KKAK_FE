import { MOCK_EXPENSES } from '../../mocks/data'
import type { Expense } from '../../types'

const KEY = 'tt_expenses_v1'

export function loadAllExpenses(): Expense[] {
  try {
    const raw = localStorage.getItem(KEY)
    if (!raw) return MOCK_EXPENSES
    const parsed = JSON.parse(raw) as Expense[]
    return Array.isArray(parsed) ? parsed : MOCK_EXPENSES
  } catch {
    return MOCK_EXPENSES
  }
}

export function saveAllExpenses(expenses: Expense[]) {
  localStorage.setItem(KEY, JSON.stringify(expenses))
}

export function addExpense(expense: Expense) {
  const all = loadAllExpenses()
  const next = [...all, expense]
  saveAllExpenses(next)
  return next
}

