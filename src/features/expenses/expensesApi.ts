import { ApiError, apiFetch } from '@/lib/api';
import { displayExpenseCategory, toApiExpenseCategory } from '@/features/expenses/expenseCategory';
import type { Expense } from '@/features/expenses/types';

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

function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null;
}
function toExpenseApiError(error: unknown, fallbackMessage: string): ExpenseApiError {
  if (error instanceof ExpenseApiError) return error;
  if (error instanceof ApiError) {
    return new ExpenseApiError(error.message || fallbackMessage, {
      code: error.code,
      status: error.status,
      detail: error.message,
    });
  }
  if (error instanceof TypeError) {
    return new ExpenseApiError('네트워크/서버 연결에 실패했어요. 잠시 후 다시 시도해 주세요.', {
      code: 'NETWORK_ERROR',
    });
  }
  if (error instanceof Error) {
    return new ExpenseApiError(error.message || fallbackMessage);
  }
  return new ExpenseApiError(fallbackMessage);
}

function toExpensePayload(
  expense:
    | Expense
    | (Partial<Expense> & { journeyId: string })
    | (Omit<Partial<Expense>, 'receiptId'> & { journeyId: string; receiptId?: string | null }),
) {
  const amountOriginal =
    'amountLocal' in expense && expense.amountLocal !== undefined
      ? Number(expense.amountLocal)
      : undefined;
  const fxRate =
    'fxRateTripToKrw' in expense && expense.fxRateTripToKrw !== undefined
      ? Number(expense.fxRateTripToKrw)
      : undefined;
  const amountKrw =
    'amountKrw' in expense && expense.amountKrw !== undefined
      ? Number(expense.amountKrw)
      : amountOriginal !== undefined && fxRate !== undefined
        ? Math.round(amountOriginal * fxRate)
        : undefined;
  const payload: Record<string, unknown> = {
    tripId: expense.journeyId,
  };
  if ('receiptId' in expense) payload.receiptId = expense.receiptId;
  if ('storeName' in expense && expense.storeName !== undefined) payload.title = expense.storeName;
  if (amountOriginal !== undefined) payload.amountOriginal = amountOriginal;
  if ('currency' in expense && expense.currency !== undefined) {
    payload.currency = expense.currency === 'KRW' ? 'KRW' : 'TRIP';
  }
  if ('paidAt' in expense && expense.paidAt !== undefined) payload.spentAt = expense.paidAt;
  if ('comment' in expense && expense.comment !== undefined) payload.note = expense.comment;
  if ('payerParticipantId' in expense && expense.payerParticipantId !== undefined) {
    payload.payerParticipantId = expense.payerParticipantId;
  } else if ('payer' in expense && expense.payer !== undefined) {
    payload.payerParticipantId = expense.payer;
  }
  if (fxRate !== undefined) payload.fxRateTripToKrw = fxRate;
  if (amountKrw !== undefined) payload.amountKrw = amountKrw;
  if ('fxMode' in expense && expense.fxMode !== undefined) payload.fxMode = expense.fxMode;
  if ('splitMode' in expense && expense.splitMode !== undefined)
    payload.splitMode = expense.splitMode;
  if ('splitWith' in expense && expense.splitWith !== undefined)
    payload.splitWith = expense.splitWith;
  if ('method' in expense && expense.method !== undefined) payload.method = expense.method;
  if ('emoji' in expense && expense.emoji !== undefined) payload.emoji = expense.emoji;
  if ('category' in expense && expense.category !== undefined) {
    payload.category = toApiExpenseCategory(expense.category);
  }
  return payload;
}

function fromApiExpense(raw: unknown, fallback: Expense): Expense {
  if (!isRecord(raw)) return fallback;
  const apiCurrency = typeof raw.currency === 'string' ? raw.currency : '';
  const mappedCurrency =
    apiCurrency === 'KRW'
      ? 'KRW'
      : apiCurrency === 'TRIP'
        ? fallback.currency
        : (apiCurrency as Expense['currency']);
  return {
    ...fallback,
    id: typeof raw.id === 'string' ? raw.id : fallback.id,
    journeyId: typeof raw.tripId === 'string' ? raw.tripId : fallback.journeyId,
    receiptId:
      raw.receiptId === null
        ? undefined
        : typeof raw.receiptId === 'string'
          ? raw.receiptId
          : fallback.receiptId,
    storeName: typeof raw.title === 'string' ? raw.title : fallback.storeName,
    amountLocal:
      typeof raw.amountOriginal === 'number'
        ? raw.amountOriginal
        : Number(raw.amountOriginal) || fallback.amountLocal,
    currency: mappedCurrency || fallback.currency,
    paidAt: typeof raw.spentAt === 'string' ? raw.spentAt : fallback.paidAt,
    payerParticipantId:
      typeof raw.payerParticipantId === 'string'
        ? raw.payerParticipantId
        : fallback.payerParticipantId,
    // payer: payerName(우선) → payerParticipantId → fallback 순. payerParticipantId만 있으면
    // 이름 역변환은 components 레이어(useExpensesQuery)에서 수행.
    payer:
      typeof raw.payerName === 'string' && raw.payerName.trim()
        ? raw.payerName.trim()
        : typeof raw.payerParticipantId === 'string'
          ? raw.payerParticipantId
          : fallback.payer,
    // splitWith: 백엔드가 반환하면 사용, 없으면 fallback
    splitWith: Array.isArray(raw.splitWith)
      ? (raw.splitWith as unknown[]).filter((s): s is string => typeof s === 'string')
      : fallback.splitWith,
    comment: typeof raw.note === 'string' ? raw.note : fallback.comment,
    fxMode: raw.fxMode === 'FIXED' || raw.fxMode === 'REALTIME' ? raw.fxMode : fallback.fxMode,
    fxRateTripToKrw:
      typeof raw.fxRateTripToKrw === 'number'
        ? raw.fxRateTripToKrw
        : Number(raw.fxRateTripToKrw) || fallback.fxRateTripToKrw,
    amountKrw:
      typeof raw.amountKrw === 'number'
        ? raw.amountKrw
        : Number(raw.amountKrw) || fallback.amountKrw,
    category:
      typeof raw.category === 'string'
        ? displayExpenseCategory(raw.category)
        : fallback.category,
    updatedAt: typeof raw.updatedAt === 'string' ? raw.updatedAt : fallback.updatedAt,
    createdAt: typeof raw.createdAt === 'string' ? raw.createdAt : fallback.createdAt,
  };
}

export async function listExpensesApi(params: {
  tripId: string;
  userId: string;
}): Promise<Expense[]> {
  void params.userId;
  let rows: unknown;
  try {
    rows = await apiFetch<unknown>(`/expenses?tripId=${encodeURIComponent(params.tripId)}`, {
      method: 'GET',
    });
  } catch (error) {
    throw toExpenseApiError(error, '지출 목록 조회 실패');
  }
  if (!Array.isArray(rows)) return [];
  return rows
    .map((row) =>
      fromApiExpense(row, {
        id: typeof row?.id === 'string' ? row.id : crypto.randomUUID(),
        journeyId: params.tripId,
        emoji: '🧾',
        storeName: '지출',
        amountLocal: 0,
        currency: 'KRW',
        paidAt: new Date().toISOString(),
        payer: '나',
        splitMode: 'personal',
        splitWith: ['나'],
        method: 'card',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      }),
    )
    .sort((a, b) => (a.paidAt < b.paidAt ? 1 : -1));
}

export async function getExpenseApi(params: {
  expenseId: string;
  userId: string;
}): Promise<Expense> {
  void params.userId;
  let data: unknown;
  try {
    data = await apiFetch<unknown>(`/expenses/${encodeURIComponent(params.expenseId)}`, {
      method: 'GET',
    });
  } catch (error) {
    throw toExpenseApiError(error, '지출 조회 실패');
  }
  if (!isRecord(data)) {
    throw new ExpenseApiError('지출 응답 형식이 올바르지 않아요.');
  }
  return fromApiExpense(data, {
    id: params.expenseId,
    journeyId: typeof data.tripId === 'string' ? data.tripId : '',
    emoji: '🧾',
    storeName: '지출',
    amountLocal: 0,
    currency: 'KRW',
    paidAt: new Date().toISOString(),
    payer: '나',
    splitMode: 'personal',
    splitWith: ['나'],
    method: 'card',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  });
}

export async function deleteExpenseApi(params: {
  expenseId: string;
  userId: string;
}): Promise<void> {
  void params.userId;
  try {
    await apiFetch<unknown>(`/expenses/${encodeURIComponent(params.expenseId)}`, {
      method: 'DELETE',
    });
  } catch (error) {
    throw toExpenseApiError(error, '지출 삭제 실패');
  }
}

export function getExpenseErrorMessage(error: unknown): string {
  if (error instanceof ExpenseApiError) {
    switch (error.code) {
      case 'EXP_001':
        return '입력값을 확인해주세요.';
      case 'EXP_002':
        return '유효하지 않은 영수증 또는 여행입니다.';
      case 'EXP_003':
        return '해당 영수증/지출에 접근 권한이 없습니다.';
      case 'EXP_004':
        return '이미 다른 지출에 연결된 영수증이에요.';
      case 'EXP_005':
        return '지출자 정보가 현재 여행과 일치하지 않습니다.';
      case 'EXP_006':
        return 'OCR이 아직 완료되지 않았어요. 잠시 후 다시 시도해 주세요.';
      case 'EXP_007':
        return '수정할 지출을 찾을 수 없습니다.';
      case 'AUTH_001':
      case 'AUTH_002':
      case 'MISSING_TOKEN':
      case 'EXPIRED_TOKEN':
        return '로그인이 만료되었어요. 다시 로그인해 주세요.';
      case 'NETWORK_ERROR':
        return '네트워크/서버 연결에 실패했어요. 잠시 후 다시 시도해 주세요.';
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
  void params.userId;
  let data: unknown;
  try {
    data = await apiFetch<unknown>('/expenses', {
      method: 'POST',
      body: JSON.stringify(toExpensePayload(params.expense)),
    });
  } catch (error) {
    throw toExpenseApiError(error, '지출 생성 실패');
  }
  return fromApiExpense(data, params.expense);
}

export async function patchExpenseApi(params: {
  expenseId: string;
  patch: Omit<Partial<Expense>, 'receiptId'> & { journeyId: string; receiptId?: string | null };
  fallback: Expense;
  userId: string;
}): Promise<Expense> {
  void params.userId;
  let data: unknown;
  try {
    data = await apiFetch<unknown>(`/expenses/${encodeURIComponent(params.expenseId)}`, {
      method: 'PATCH',
      body: JSON.stringify(toExpensePayload(params.patch)),
    });
  } catch (error) {
    throw toExpenseApiError(error, '지출 수정 실패');
  }
  return fromApiExpense(data, params.fallback);
}
