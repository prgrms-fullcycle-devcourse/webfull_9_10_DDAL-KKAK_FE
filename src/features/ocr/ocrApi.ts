import { env } from '@/config/env';

/** 백엔드 `sendSuccess` / `sendError` 래퍼와 동일 */
export type ApiSuccessResponse<T> = {
  success: true;
  status: number;
  message: string;
  data: T;
};

export type ApiErrorResponse = {
  success: false;
  status: number;
  message: string;
  error: { code: string; detail: string };
};

export class OcrApiError extends Error {
  code?: string;
  status?: number;
  detail?: string;

  constructor(message: string, options?: { code?: string; status?: number; detail?: string }) {
    super(message);
    this.name = 'OcrApiError';
    this.code = options?.code;
    this.status = options?.status;
    this.detail = options?.detail;
  }
}

export type OcrParsedResult = {
  merchantName: string;
  totalAmount: number;
  currency: string;
  purchasedAt: string;
};

export type OcrJobStatus = 'PENDING' | 'PROCESSING' | 'SUCCESS' | 'FAILED' | 'EXPIRED';

export type OcrJobResult = {
  receiptId: string;
  status: OcrJobStatus;
  result?: OcrParsedResult;
  failure?: { code: string; detail: string };
};

export type CreateOcrJobResponse = { receiptId: string; status: 'PENDING' };

const RECEIPT_MAX_BYTES = 10 * 1024 * 1024;
const ALLOWED_MIME = new Set(['image/jpeg', 'image/jpg', 'image/png', 'image/webp']);

function apiBase(): string {
  return env.API_BASE_URL.replace(/\/?$/, '/');
}

function expensesUrl(path: string): string {
  const p = path.startsWith('/') ? path.slice(1) : path;
  return new URL(p, apiBase()).toString();
}

export function validateReceiptFile(file: File): string | null {
  const type = file.type.toLowerCase();
  if (!ALLOWED_MIME.has(type)) {
    return 'JPEG, PNG, WEBP 이미지만 업로드할 수 있어요.';
  }
  if (file.size > RECEIPT_MAX_BYTES) {
    return '파일 크기는 10MB 이하여야 해요.';
  }
  return null;
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

function parseApiError(
  body: unknown,
): { code?: string; detail?: string; status?: number; message?: string } | null {
  if (!isRecord(body)) return null;
  if (body.success !== false) return null;
  const error = isRecord(body.error) ? body.error : null;
  return {
    code: error && typeof error.code === 'string' ? error.code : undefined,
    detail: error && typeof error.detail === 'string' ? error.detail : undefined,
    status: typeof body.status === 'number' ? body.status : undefined,
    message: typeof body.message === 'string' ? body.message : undefined,
  };
}

export function getOcrErrorMessage(error: unknown): string {
  if (error instanceof OcrApiError) {
    switch (error.code) {
      case 'OCR_003':
        return '파일 용량이 너무 커요. 10MB 이하 이미지를 업로드해 주세요.';
      case 'OCR_004':
        return '이미지 파일을 다시 선택해 주세요. 손상된 파일일 수 있어요.';
      case 'OCR_007':
        return '총액 인식이 어려웠어요. 더 선명한 사진으로 다시 시도해 주세요.';
      case 'OCR_008':
        return '해당 OCR 결과에 접근할 권한이 없어요.';
      case 'OCR_009':
        return 'OCR 작업을 찾지 못했어요. 다시 스캔해 주세요.';
      case 'OCR_011':
        return '여정 정보가 누락되었어요. 다시 시도해 주세요.';
      case 'AUTH_001':
      case 'AUTH_002':
        return '로그인이 필요해요.';
      case 'TRIP_009':
        return '존재하지 않는 여행이에요. 여행을 다시 선택해 주세요.';
      case 'TRIP_010':
        return '해당 여행에 접근 권한이 없어요.';
      case 'COMMON_001':
        return '일시적인 서버 오류가 발생했어요. 잠시 후 다시 시도해 주세요.';
      default:
        break;
    }
    return error.detail || error.message || 'OCR 요청 중 오류가 발생했어요.';
  }
  if (error instanceof Error) return error.message;
  return 'OCR 요청 중 오류가 발생했어요.';
}

export async function createReceiptOcrJob(params: {
  file: File;
  tripId: string;
  userId: string;
  currencyHint?: string;
  receiptLocale?: string;
}): Promise<CreateOcrJobResponse> {
  const { file, tripId, userId, currencyHint, receiptLocale } = params;

  const form = new FormData();
  form.append('receipt', file);
  form.append('tripId', tripId);
  if (currencyHint?.trim()) form.append('currencyHint', currencyHint.trim());
  if (receiptLocale?.trim()) form.append('receiptLocale', receiptLocale.trim());

  const res = await fetch(expensesUrl('expenses/ocr'), {
    method: 'POST',
    headers: { 'x-user-id': userId },
    body: form,
  });

  const body = await parseJson(res);
  const apiError = parseApiError(body);

  if (!isRecord(body)) {
    throw new OcrApiError(`OCR 요청 실패 (${res.status})`, { status: res.status });
  }

  if (apiError) {
    throw new OcrApiError(apiError.detail || apiError.message || 'OCR 요청 실패', {
      code: apiError.code,
      detail: apiError.detail,
      status: apiError.status ?? res.status,
    });
  }

  if (body.success !== true || !isRecord(body.data)) {
    throw new OcrApiError(`OCR 요청 실패 (${res.status})`, { status: res.status });
  }

  const data = body.data as Record<string, unknown>;
  const receiptId = typeof data.receiptId === 'string' ? data.receiptId : '';
  const status = data.status === 'PENDING' ? 'PENDING' : '';
  if (!receiptId || status !== 'PENDING') {
    throw new OcrApiError('OCR 응답 형식이 올바르지 않아요.');
  }

  return { receiptId, status: 'PENDING' };
}

export async function getReceiptOcrJob(params: {
  receiptId: string;
  userId: string;
}): Promise<OcrJobResult> {
  const { receiptId, userId } = params;
  const res = await fetch(expensesUrl(`expenses/ocr/${encodeURIComponent(receiptId)}`), {
    method: 'GET',
    headers: { 'x-user-id': userId },
  });

  const body = await parseJson(res);
  const apiError = parseApiError(body);

  if (!isRecord(body)) {
    throw new OcrApiError(`OCR 조회 실패 (${res.status})`, { status: res.status });
  }

  if (apiError) {
    throw new OcrApiError(apiError.detail || apiError.message || 'OCR 조회 실패', {
      code: apiError.code,
      detail: apiError.detail,
      status: apiError.status ?? res.status,
    });
  }

  if (body.success !== true || !isRecord(body.data)) {
    throw new OcrApiError(`OCR 조회 실패 (${res.status})`, { status: res.status });
  }

  const data = body.data as Record<string, unknown>;
  const rid = typeof data.receiptId === 'string' ? data.receiptId : receiptId;
  const status = typeof data.status === 'string' ? (data.status as OcrJobStatus) : 'PENDING';

  const out: OcrJobResult = { receiptId: rid, status };

  if (status === 'SUCCESS' && isRecord(data.result)) {
    const r = data.result;
    out.result = {
      merchantName: typeof r.merchantName === 'string' ? r.merchantName : '',
      totalAmount: typeof r.totalAmount === 'number' ? r.totalAmount : Number(r.totalAmount) || 0,
      currency: typeof r.currency === 'string' ? r.currency : 'KRW',
      purchasedAt: typeof r.purchasedAt === 'string' ? r.purchasedAt : '',
    };
  }

  if (status === 'FAILED' && isRecord(data.failure)) {
    const f = data.failure;
    out.failure = {
      code: typeof f.code === 'string' ? f.code : 'UNKNOWN',
      detail: typeof f.detail === 'string' ? f.detail : 'OCR 처리에 실패했습니다.',
    };
  }

  return out;
}

export type PollOcrOptions = {
  intervalMs?: number;
  maxAttempts?: number;
};

/** PENDING/PROCESSING 이 끝날 때까지 폴링. SUCCESS 또는 FAILED(및 EXPIRED)에서 종료 */
export async function pollReceiptOcrJob(
  receiptId: string,
  userId: string,
  options?: PollOcrOptions,
): Promise<OcrJobResult> {
  const baseIntervalMs = options?.intervalMs ?? 1200;
  const maxAttempts = options?.maxAttempts ?? 55;

  for (let i = 0; i < maxAttempts; i++) {
    const job = await getReceiptOcrJob({ receiptId, userId });

    if (job.status === 'SUCCESS' || job.status === 'FAILED' || job.status === 'EXPIRED') {
      return job;
    }

    const waitMs = Math.min(baseIntervalMs + i * 200, 3000);
    await new Promise((r) => setTimeout(r, waitMs));
  }

  throw new OcrApiError('OCR 분석 시간이 초과되었어요. 잠시 후 다시 시도해 주세요.');
}

export async function deleteReceiptOcrJob(params: {
  receiptId: string;
  userId: string;
}): Promise<void> {
  const { receiptId, userId } = params;
  const res = await fetch(expensesUrl(`expenses/ocr/${encodeURIComponent(receiptId)}`), {
    method: 'DELETE',
    headers: { 'x-user-id': userId },
  });

  const body = await parseJson(res);
  const apiError = parseApiError(body);

  if (apiError) {
    throw new OcrApiError(apiError.detail || apiError.message || 'OCR 삭제 실패', {
      code: apiError.code,
      detail: apiError.detail,
      status: apiError.status ?? res.status,
    });
  }
  if (!res.ok) {
    throw new OcrApiError(`OCR 삭제 실패 (${res.status})`, { status: res.status });
  }
}
