import { ApiError, apiFetch } from '@/lib/api';
import {
  displayExpenseCategory,
  emojiForCategory,
  toApiExpenseCategory,
} from '@/features/expenses/expenseCategory';
import type { Expense, ExpenseSplitParticipant } from '@/features/expenses/types';



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

/** apiFetch/ApiError → ExpenseApiError 변환 */
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

function parseSplitWithFromApi(raw: unknown): {
  names: string[];
  participants?: ExpenseSplitParticipant[];
} {
  if (!Array.isArray(raw) || raw.length === 0) return { names: [] };
  const first = raw[0];
  if (
    typeof first === 'object' &&
    first !== null &&
    typeof (first as { participantId?: unknown }).participantId === 'string' &&
    typeof (first as { name?: unknown }).name === 'string'
  ) {
    const participants = (raw as { participantId: string; name: string }[])
      .filter((x) => typeof x.participantId === 'string' && typeof x.name === 'string')
      .map((x) => ({ participantId: x.participantId, name: x.name }));
    return { names: participants.map((p) => p.name), participants };
  }
  const names = (raw as unknown[]).filter((s): s is string => typeof s === 'string');
  return { names };
}

/** toExpensePayload / 분담 id 계산 공통 입력 (PATCH 시 receiptId에 null 허용) */
type ExpensePayloadInput =
  | Expense
  | (Partial<Expense> & { journeyId: string })
  | (Omit<Partial<Expense>, 'receiptId'> & { journeyId: string; receiptId?: string | null });

/** POST/PATCH: splitWithParticipantIds — 백엔드는 string[] 형식 기대 */
function splitWithParticipantIdsForPayload(
  expense: ExpensePayloadInput,
  nameToParticipantId?: Record<string, string>,
): string[] | undefined {
  if (!('splitMode' in expense) || expense.splitMode === undefined) return undefined;

  if (expense.splitMode === 'personal') {
    const pid = expense.payerParticipantId?.trim();
    if (pid) return [pid];
    if (nameToParticipantId && expense.payer) {
      const id = nameToParticipantId[expense.payer];
      if (id) return [id];
    }
    return [];
  }

  const names = expense.splitWith;
  if (!Array.isArray(names) || names.length === 0) return undefined;
  if (!nameToParticipantId) return undefined;
  const ids = [...new Set(names.map((n) => nameToParticipantId[n]).filter(Boolean))] as string[];
  if (ids.length === 0) return undefined;
  return ids;
}

function toExpensePayload(
  expense: ExpensePayloadInput,
  opts?: { nameToParticipantId?: Record<string, string> },
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

  // payerParticipantId 우선, 없으면 payer(이름 문자열) 폴백
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
  const splitIds = splitWithParticipantIdsForPayload(expense, opts?.nameToParticipantId);
  if (splitIds !== undefined) payload.splitWithParticipantIds = splitIds;
  if ('method' in expense && expense.method !== undefined) payload.method = expense.method;
  if ('emoji' in expense && expense.emoji !== undefined) payload.emoji = expense.emoji;
  // 카테고리: 한국어·영문 모두 백엔드 enum으로 변환 (expenseCategory.ts)
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
    payerName:
      typeof raw.payerName === 'string' && raw.payerName.trim()
        ? raw.payerName.trim()
        : fallback.payerName,
    // payer: payerName(우선) → payerParticipantId → fallback 순. payerParticipantId만 있으면
    // 이름 역변환은 JourneyTimelinePage에서 수행.
    payer:
      typeof raw.payerName === 'string' && raw.payerName.trim()
        ? raw.payerName.trim()
        : typeof raw.payerParticipantId === 'string'
          ? raw.payerParticipantId
          : fallback.payer,
    ...(() => {
      const parsed = parseSplitWithFromApi(raw.splitWith);
      const resolvedSplitWith = parsed.names.length ? parsed.names : fallback.splitWith;
      // 백엔드가 splitMode를 응답에 포함하지 않으므로 splitWith 인원수로 추론
      // splitWith가 2명 이상이면 shared, 아니면 fallback(기본 personal) 사용
      const resolvedSplitMode: Expense['splitMode'] =
        raw.splitMode === 'shared' || raw.splitMode === 'personal'
          ? raw.splitMode
          : resolvedSplitWith.length > 1
            ? 'shared'
            : fallback.splitMode;
      return {
        splitMode: resolvedSplitMode,
        splitWithParticipants: parsed.participants,
        splitWith: resolvedSplitWith,
      };
    })(),
    method: typeof raw.method === 'string' ? (raw.method as Expense['method']) : fallback.method,
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
    // 카테고리: 백엔드 enum → 표시용 문자열로 변환
    category:
      typeof raw.category === 'string' ? displayExpenseCategory(raw.category) : fallback.category,
    // 이모지: 카테고리에서 자동 파생 (백엔드 category 기준)
    emoji: (() => {
      const cat = typeof raw.category === 'string' ? raw.category : '';
      if (cat) return emojiForCategory(displayExpenseCategory(cat));
      // category 없으면 fallback emoji도 category 기반으로 파생
      const fallbackCat = fallback.category ?? '';
      if (fallbackCat) return emojiForCategory(fallbackCat);
      return emojiForCategory('기타');
    })(),
    updatedAt: typeof raw.updatedAt === 'string' ? raw.updatedAt : fallback.updatedAt,
    createdAt: typeof raw.createdAt === 'string' ? raw.createdAt : fallback.createdAt,
  };
}

export async function listExpensesApi(params: { tripId: string }): Promise<Expense[]> {
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

export async function getExpenseApi(params: { expenseId: string }): Promise<Expense> {
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

export async function deleteExpenseApi(params: { expenseId: string }): Promise<void> {
  try {
    await apiFetch<unknown>(`/expenses/${encodeURIComponent(params.expenseId)}`, {
      method: 'DELETE',
    });
  } catch (error) {
    throw toExpenseApiError(error, '지출 삭제 실패');
  }
}

export async function createExpenseApi(params: {
  expense: Expense;
  nameToParticipantId?: Record<string, string>;
}): Promise<Expense> {
  let data: unknown;
  try {
    data = await apiFetch<unknown>('/expenses', {
      method: 'POST',
      body: JSON.stringify(
        toExpensePayload(params.expense, { nameToParticipantId: params.nameToParticipantId }),
      ),
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
  nameToParticipantId?: Record<string, string>;
}): Promise<Expense> {
  let data: unknown;
  try {
    data = await apiFetch<unknown>(`/expenses/${encodeURIComponent(params.expenseId)}`, {
      method: 'PATCH',
      body: JSON.stringify(
        toExpensePayload(params.patch, { nameToParticipantId: params.nameToParticipantId }),
      ),
    });
  } catch (error) {
    throw toExpenseApiError(error, '지출 수정 실패');
  }
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
