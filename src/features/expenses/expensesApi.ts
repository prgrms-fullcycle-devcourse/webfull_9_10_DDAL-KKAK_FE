import { env } from '@/config/env';
import type { Expense } from '@/features/expenses/types';

type ExpenseApiErrorPayload = {
  success: false;
  status: number;
  message: string;
  error?: { code?: string; detail?: string };
};

export class ExpenseApiError extends Error {
  code?: string;
  detail?: string;
  status?: number;

  constructor(message: string, options?: { code?: string; detail?: string; status?: number }) {
    super(message);
    this.name = 'ExpenseApiError';
    this.code = options?.code;
    this.detail = options?.detail;
    this.status = options?.status;
  }
}

function apiBase(): string {
  return env.API_BASE_URL.replace(/\/?$/, '/');
}

function expensesUrl(path: string): string {
  const p = path.startsWith('/') ? path.slice(1) : path;
  return new URL(p, apiBase()).toString();
}

async function parseJson(res: Response): Promise<unknown> {
  const text = await res.text();
  if (!text) return null;
  try {
    return JSON.parse(text) as unknown;
  } catch {
    return null;
  }
}

function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null;
}

function mapExpenseError(body: unknown): ExpenseApiError | null {
  if (!isRecord(body)) return null;
  if (body.success !== false) return null;
  const payload = body as ExpenseApiErrorPayload;
  return new ExpenseApiError(payload.message || '지출 API 요청 실패', {
    code: payload.error?.code,
    detail: payload.error?.detail,
    status: payload.status,
  });
}

function toExpensePayload(
  expense:
    | Expense
    | (Partial<Expense> & { journeyId: string })
    | (Omit<Partial<Expense>, 'receiptId'> & { journeyId: string; receiptId?: string | null }),
) {
  const payload: Record<string, unknown> = {
    tripId: expense.journeyId,
  };
  if ('receiptId' in expense) payload.receiptId = expense.receiptId;
  if ('storeName' in expense && expense.storeName !== undefined) payload.title = expense.storeName;
  if ('amountLocal' in expense && expense.amountLocal !== undefined) {
    payload.amountOriginal = expense.amountLocal;
  }
  if ('currency' in expense && expense.currency !== undefined) payload.currency = expense.currency;
  if ('paidAt' in expense && expense.paidAt !== undefined) payload.spentAt = expense.paidAt;
  if ('comment' in expense && expense.comment !== undefined) payload.note = expense.comment;
  if ('payer' in expense && expense.payer !== undefined) payload.payer = expense.payer;
  if ('splitMode' in expense && expense.splitMode !== undefined) payload.splitMode = expense.splitMode;
  if ('splitWith' in expense && expense.splitWith !== undefined) payload.splitWith = expense.splitWith;
  if ('method' in expense && expense.method !== undefined) payload.method = expense.method;
  if ('emoji' in expense && expense.emoji !== undefined) payload.emoji = expense.emoji;
  if ('category' in expense && expense.category !== undefined) payload.category = expense.category;
  return payload;
}

function fromApiExpense(raw: unknown, fallback: Expense): Expense {
  if (!isRecord(raw)) return fallback;
  return {
    ...fallback,
    id: typeof raw.id === 'string' ? raw.id : fallback.id,
    journeyId: typeof raw.tripId === 'string' ? raw.tripId : fallback.journeyId,
    receiptId:
      raw.receiptId === null ? undefined : typeof raw.receiptId === 'string' ? raw.receiptId : fallback.receiptId,
    storeName: typeof raw.title === 'string' ? raw.title : fallback.storeName,
    amountLocal:
      typeof raw.amountOriginal === 'number'
        ? raw.amountOriginal
        : Number(raw.amountOriginal) || fallback.amountLocal,
    currency: typeof raw.currency === 'string' ? (raw.currency as Expense['currency']) : fallback.currency,
    paidAt: typeof raw.spentAt === 'string' ? raw.spentAt : fallback.paidAt,
    comment: typeof raw.note === 'string' ? raw.note : fallback.comment,
    updatedAt: typeof raw.updatedAt === 'string' ? raw.updatedAt : fallback.updatedAt,
    createdAt: typeof raw.createdAt === 'string' ? raw.createdAt : fallback.createdAt,
  };
}

export function getExpenseErrorMessage(error: unknown): string {
  if (error instanceof ExpenseApiError) {
    switch (error.code) {
      case 'EXP_004':
        return '이미 다른 지출에 연결된 영수증이에요.';
      case 'EXP_006':
        return 'OCR이 아직 완료되지 않았어요. 잠시 후 다시 시도해 주세요.';
      default:
        return error.detail || error.message || '지출 저장 중 오류가 발생했어요.';
    }
  }
  if (error instanceof Error) return error.message;
  return '지출 저장 중 오류가 발생했어요.';
}

export async function createExpenseApi(params: {
  expense: Expense;
  userId: string;
}): Promise<Expense> {
  const res = await fetch(expensesUrl('expenses'), {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'x-user-id': params.userId,
    },
    body: JSON.stringify(toExpensePayload(params.expense)),
  });
  const body = await parseJson(res);
  const mapped = mapExpenseError(body);
  if (mapped) throw mapped;
  if (!res.ok) throw new ExpenseApiError(`지출 생성 실패 (${res.status})`, { status: res.status });
  if (!isRecord(body) || body.success !== true) return params.expense;
  const data = isRecord(body.data) ? body.data : null;
  return fromApiExpense(data, params.expense);
}

export async function patchExpenseApi(params: {
  expenseId: string;
  patch: Omit<Partial<Expense>, 'receiptId'> & { journeyId: string; receiptId?: string | null };
  fallback: Expense;
  userId: string;
}): Promise<Expense> {
  const res = await fetch(expensesUrl(`expenses/${encodeURIComponent(params.expenseId)}`), {
    method: 'PATCH',
    headers: {
      'content-type': 'application/json',
      'x-user-id': params.userId,
    },
    body: JSON.stringify(toExpensePayload(params.patch)),
  });
  const body = await parseJson(res);
  const mapped = mapExpenseError(body);
  if (mapped) throw mapped;
  if (!res.ok) throw new ExpenseApiError(`지출 수정 실패 (${res.status})`, { status: res.status });
  if (!isRecord(body) || body.success !== true) return params.fallback;
  const data = isRecord(body.data) ? body.data : null;
  return fromApiExpense(data, params.fallback);
}
