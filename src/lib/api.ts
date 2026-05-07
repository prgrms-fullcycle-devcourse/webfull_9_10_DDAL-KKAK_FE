/**
 * API base URL (환경변수에서 로드).
 * dev: Vite proxy가 /auth, /api 경로를 이 URL로 포워딩 (vite.config.ts 참조).
 * 배포: 실제 백엔드 도메인. CORS 설정 필요.
 */
export const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || '';

const TOKEN_KEY = 'tt_access_token_v1';

/** OAuth 시작 URL — provider 페이지로 리다이렉트하는 백엔드 엔드포인트 */
export function oauthStartUrl(provider: 'kakao' | 'google'): string {
  return `${API_BASE_URL}/auth/${provider}/login`;
}

/**
 * 백엔드 공통 응답 envelope.
 * { success, status, message, data?, error?, timestamp } 형태.
 */
export type ApiEnvelope<T> = {
  success: boolean;
  status: number;
  message: string;
  data?: T;
  error?: { code: string; detail: string };
  timestamp: string;
};

/**
 * API 에러 (status, code 보존).
 * caller가 특정 에러 코드 (USER_NOT_FOUND, WITHDRAWAL_FAILED 등)를 분기 처리할 때 사용.
 */
export class ApiError extends Error {
  status: number;
  code?: string;
  constructor(status: number, message: string, code?: string) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.code = code;
  }
}

type RefreshData = {
  accessToken: string;
  tokenType: string;
  expiresIn: number;
};

/**
 * 동시 refresh 방지용 promise singleton.
 * 여러 API가 동시에 401을 받아도 refresh는 한 번만 실행되고
 * 모두 같은 결과를 공유.
 */
let refreshInflight: Promise<string | null> | null = null;

/**
 * accessToken 갱신.
 * 성공 시 새 토큰을 localStorage에 저장하고 반환.
 * 실패 시 (refresh token 만료/탈취/유실 등) auth 상태를 클리어하고
 * 'auth:cleared' 이벤트 발행 → AuthProvider가 듣고 user state 초기화.
 */
async function refreshAccessToken(): Promise<string | null> {
  if (refreshInflight) return refreshInflight;
  refreshInflight = (async () => {
    try {
      const res = await fetch(`${API_BASE_URL}/auth/refresh`, {
        method: 'POST',
        credentials: 'include', // refreshToken httpOnly cookie 자동 전달
      });
      if (!res.ok) {
        // 401 (EXPIRED / INVALID / MISSING / TOKEN_REUSE_DETECTED / REFRESH_TOKEN_NOT_FOUND)
        // 모두 재로그인 필요한 상황이라 auth 클리어.
        localStorage.removeItem(TOKEN_KEY);
        localStorage.removeItem('tt_auth_v2');
        window.dispatchEvent(new CustomEvent('auth:cleared'));
        return null;
      }
      const body = (await res.json()) as ApiEnvelope<RefreshData>;
      const newToken = body.data?.accessToken ?? null;
      if (newToken) localStorage.setItem(TOKEN_KEY, newToken);
      return newToken;
    } catch {
      // 네트워크 에러 등 — 일단 토큰 유지하고 caller가 처리
      return null;
    } finally {
      refreshInflight = null;
    }
  })();
  return refreshInflight;
}

/**
 * fetch 래퍼.
 * - accessToken이 localStorage에 있으면 Authorization: Bearer 자동 첨부.
 * - refreshToken은 httpOnly cookie라 credentials: include로 자동 전달.
 * - 401 응답 시 /auth/refresh 자동 호출 후 원 요청 1회 재시도.
 * - 응답이 백엔드 envelope 형식이면 data만 추출, 아니면 그대로 반환.
 */
export async function apiFetch<T>(path: string, init?: RequestInit): Promise<T> {
  const url = path.startsWith('http') ? path : `${API_BASE_URL}${path}`;

  const send = async (token: string | null) => {
    return fetch(url, {
      ...init,
      credentials: 'include',
      headers: {
        'Content-Type': 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
        ...(init?.headers ?? {}),
      },
    });
  };

  let res = await send(localStorage.getItem(TOKEN_KEY));

  // 401 → 토큰 갱신 후 재시도. /auth/refresh, /auth/logout 자체는 무한 루프 방지차 제외.
  const skipRefresh = path.includes('/auth/refresh') || path.includes('/auth/logout');
  if (res.status === 401 && !skipRefresh) {
    const newToken = await refreshAccessToken();
    if (newToken) {
      res = await send(newToken);
    }
  }

  const body = (await res.json().catch(() => null)) as ApiEnvelope<T> | T | null;
  if (!res.ok) {
    const env = body as ApiEnvelope<T> | null;
    throw new ApiError(
      res.status,
      env?.error?.detail ?? env?.message ?? `HTTP ${res.status}`,
      env?.error?.code,
    );
  }
  if (body && typeof body === 'object' && 'success' in body && 'data' in body) {
    return (body as ApiEnvelope<T>).data as T;
  }
  return body as T;
}
