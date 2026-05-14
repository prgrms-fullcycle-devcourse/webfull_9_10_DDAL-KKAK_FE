import { env } from '@/config/env';
import type { Expense } from '@/features/expenses/types';

const TOKEN_KEY = 'tt_access_token_v1';

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
  // dev: Vite 프록시를 타도록 상대 경로 사용 (lib/api.ts와 동일 규칙)
  if (import.meta.env.DEV) {
    return path.startsWith('/') ? path : `/${path}`;
  }
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

/** Authorization: Bearer {token} 헤더 반환 */
function getAuthHeaders(): Record<string, string> {
  const token = localStorage.getItem(TOKEN_KEY);
  return token ? { Authorization: `Bearer ${token}` } : {};
}

/**
 * API 에러 응답({ message, code }) → ExpenseApiError.
 * 구형 { success: false, error: { code } } 형식도 함께 지원.
 */
function extractApiError(body: unknown, status: number): ExpenseApiError | null {
  if (!isRecord(body)) return null;
  const message = typeof body.message === 'string' ? body.message : '';
  const code =
    typeof body.code === 'string'
      ? body.code
      : isRecord(body.error) && typeof body.error.code === 'string'
        ? body.error.code
        : undefined;
  if (!message) return null;
  return new ExpenseApiError(message || '지출 API 요청 실패', { code, status });
}

/** { data: ... } 엔벨로프에서 data 추출 */
function extractData(body: unknown): unknown {
  if (isRecord(body) && 'data' in body) return body.data;
  return body;
}

// 카테고리: 프론트(한국어/영문) → 백엔드(FOOD | SHOPPING | TRANSPORT | TOUR | ETC)
const CATEGORY_TO_API: Record<string, string> = {
  기타: 'ETC',
  음식: 'FOOD',
  쇼핑: 'SHOPPING',
  교통: 'TRANSPORT',
  관광: 'TOUR',
  FOOD: 'FOOD',
  SHOPPING: 'SHOPPING',
  TRANSPORT: 'TRANSPORT',
  TOUR: 'TOUR',
  ETC: 'ETC',
};

function toExpensePayload(
  expense:
    | Expense
    | (Partial<Expense> & { journeyId: string })
    | (Omit<Partial<Expense>, 'receiptId'> & { journeyId: string; receiptId?: string | null }),
) {
  const amountOriginal =
    'amountLocal' in expense && expense.amountLocal !== undefined ? Number(expense.amountLocal) : undefined;
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

  // payerParticipantId 우선, 없으면 payer(이름 문자열) 폴백
  if ('payerParticipantId' in expense && expense.payerParticipantId !== undefined) {
    payload.payerParticipantId = expense.payerParticipantId;
  } else if ('payer' in expense && expense.payer !== undefined) {
    payload.payerParticipantId = expense.payer;
  }

  if (fxRate !== undefined) payload.fxRateTripToKrw = fxRate;
  if (amountKrw !== undefined) payload.amountKrw = amountKrw;
  if ('fxMode' in expense && expense.fxMode !== undefined) payload.fxMode = expense.fxMode;
  if ('splitMode' in expense && expense.splitMode !== undefined) payload.splitMode = expense.splitMode;
  if ('splitWith' in expense && expense.splitWith !== undefined) payload.splitWith = expense.splitWith;
  if ('method' in expense && expense.method !== undefined) payload.method = expense.method;
  if ('emoji' in expense && expense.emoji !== undefined) payload.emoji = expense.emoji;
  // 카테고리: 한국어·영문 모두 백엔드 enum으로 변환
  if ('category' in expense && expense.category !== undefined) {
    payload.category = CATEGORY_TO_API[expense.category] ?? 'ETC';
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
      raw.receiptId === null ? undefined : typeof raw.receiptId === 'string' ? raw.receiptId : fallback.receiptId,
    storeName: typeof raw.title === 'string' ? raw.title : fallback.storeName,
    category: typeof raw.category === 'string' ? raw.category : fallback.category,
    amountLocal:
      typeof raw.amountOriginal === 'number'
        ? raw.amountOriginal
        : Number(raw.amountOriginal) || fallback.amountLocal,
    currency: mappedCurrency || fallback.currency,
    paidAt: typeof raw.spentAt === 'string' ? raw.spentAt : fallback.paidAt,
    payerParticipantId:
      typeof raw.payerParticipantId === 'string' ? raw.payerParticipantId : fallback.payerParticipantId,
    // payer: payerName(우선) → payerParticipantId → fallback 순.
    // payerParticipantId만 있으면 이름 역변환은 JourneyTimelinePage에서 수행.
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
    amountKrw: typeof raw.amountKrw === 'number' ? raw.amountKrw : Number(raw.amountKrw) || fallback.amountKrw,
    updatedAt: typeof raw.updatedAt === 'string' ? raw.updatedAt : fallback.updatedAt,
    createdAt: typeof raw.createdAt === 'string' ? raw.createdAt : fallback.createdAt,
  };
}

export async function listExpensesApi(params: { tripId: string }): Promise<Expense[]> {
  const res = await fetch(expensesUrl(`expenses?tripId=${encodeURIComponent(params.tripId)}`), {
    method: 'GET',
    headers: { 'Content-Type': 'application/json', ...getAuthHeaders() },
    credentials: 'include',
  });
  const body = await parseJson(res);
  if (!res.ok) {
    const err = extractApiError(body, res.status);
    if (err) throw err;
    throw new ExpenseApiError(`지출 목록 조회 실패 (${res.status})`, { status: res.status });
  }
  const data = extractData(body);
  if (!Array.isArray(data)) return [];
  return data
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

export async function getExpenseApi(params: { expenseId: string }): Promise<Expense> {
  const res = await fetch(expensesUrl(`expenses/${encodeURIComponent(params.expenseId)}`), {
    method: 'GET',
    headers: { 'Content-Type': 'application/json', ...getAuthHeaders() },
    credentials: 'include',
  });
  const body = await parseJson(res);
  if (!res.ok) {
    const err = extractApiError(body, res.status);
    if (err) throw err;
    throw new ExpenseApiError(`지출 조회 실패 (${res.status})`, { status: res.status });
  }
  const data = extractData(body);
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

export async function deleteExpenseApi(params: { expenseId: string }): Promise<void> {
  const res = await fetch(expensesUrl(`expenses/${encodeURIComponent(params.expenseId)}`), {
    method: 'DELETE',
    headers: { 'Content-Type': 'application/json', ...getAuthHeaders() },
    credentials: 'include',
  });
  const body = await parseJson(res);
  if (!res.ok) {
    const err = extractApiError(body, res.status);
    if (err) throw err;
    throw new ExpenseApiError(`지출 삭제 실패 (${res.status})`, { status: res.status });
  }
}

export async function createExpenseApi(params: { expense: Expense }): Promise<Expense> {
  const res = await fetch(expensesUrl('expenses'), {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...getAuthHeaders(),
    },
    credentials: 'include',
    body: JSON.stringify(toExpensePayload(params.expense)),
  });
  const body = await parseJson(res);
  if (!res.ok) {
    const err = extractApiError(body, res.status);
    if (err) throw err;
    throw new ExpenseApiError(`지출 생성 실패 (${res.status})`, { status: res.status });
  }
  const data = extractData(body);
  return fromApiExpense(data, params.expense);
}

export async function patchExpenseApi(params: {
  expenseId: string;
  patch: Omit<Partial<Expense>, 'receiptId'> & { journeyId: string; receiptId?: string | null };
  fallback: Expense;
}): Promise<Expense> {
  const res = await fetch(expensesUrl(`expenses/${encodeURIComponent(params.expenseId)}`), {
    method: 'PATCH',
    headers: {
      'Content-Type': 'application/json',
      ...getAuthHeaders(),
    },
    credentials: 'include',
    body: JSON.stringify(toExpensePayload(params.patch)),
  });
  const body = await parseJson(res);
  if (!res.ok) {
    const err = extractApiError(body, res.status);
    if (err) throw err;
    throw new ExpenseApiError(`지출 수정 실패 (${res.status})`, { status: res.status });
  }
  const data = extractData(body);
  return fromApiExpense(data, params.fallback);
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
      default:
        return error.detail || error.message || '지출 저장 중 오류가 발생했어요.';
    }
  }
  if (error instanceof Error) return error.message;
  return '지출 저장 중 오류가 발생했어요.';
}
