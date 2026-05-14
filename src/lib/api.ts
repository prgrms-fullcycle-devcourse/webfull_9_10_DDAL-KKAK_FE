/**
 * API base URL (환경변수에서 로드).
 * dev: apiFetch는 Vite 프록시(상대 경로)로 CORS 없이 호출. OAuth 시작 URL만 예외적으로 절대 URL 사용(oauthStartUrl).
 * 배포: 실제 백엔드 도메인.
 */
export const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || '';

const TOKEN_KEY = 'tt_access_token_v1';

function buildUrl(path: string): string {
  if (path.startsWith('http')) return path;
  // dev(localhost)에서는 Vite proxy를 타서 CORS 없이 호출 (vite.config.ts 참고)
  if (import.meta.env.DEV) return path;
  return `${API_BASE_URL}${path}`;
}

function apiOriginForFullPageNavigation(): string | null {
  const base = API_BASE_URL.replace(/\/$/, '');
  return base.length ? base : null;
}

/**
 * OAuth 시작 URL — 브라우저 전체 이동(window.location)용.
 *
 * dev에서 Vite 프록시로만 `/auth/.../login`을 열면 CSRF 쿠키가 localhost에만 심기고,
 * 카카오 콜백은 보통 백엔드 호스트(예: onrender.com)로 들어와 쿠키가 안 붙어 CSRF_ERROR가 난다.
 * 그래서 `VITE_API_BASE_URL`이 있으면 dev에서도 백엔드 절대 URL로 OAuth를 시작한다.
 * (apiFetch는 그대로 상대 경로 + 프록시로 CORS 없이 호출)
 */
export function oauthStartUrl(provider: 'kakao' | 'google'): string {
  const path = `/auth/${provider}/login`;
  if (import.meta.env.DEV) {
    const origin = apiOriginForFullPageNavigation();
    if (origin) return `${origin}${path}`;
  }
  return buildUrl(path);
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

function hasContentTypeHeader(headers: RequestInit['headers']): boolean {
  if (!headers) return false;
  return new Headers(headers).has('Content-Type');
}

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
      const res = await fetch(buildUrl('/auth/refresh'), {
        method: 'POST',
        credentials: 'include', // refreshToken httpOnly cookie 자동 전달
      });
      if (!res.ok) {
        // 401 (EXPIRED / INVALID / MISSING / TOKEN_REUSE_DETECTED / REFRESH_TOKEN_NOT_FOUND)
        // 대부분은 재로그인 필요한 상황이라 auth 클리어.
        //
        // 단, 로컬(dev/preview)에서 "배포 백엔드 + accessToken 쿼리 주입"으로 테스트할 때는
        // refreshToken 쿠키가 도메인 문제로 전달되지 않아 refresh가 항상 실패할 수 있다.
        // 이 경우까지 강제로 로그아웃시키면 로컬에서 배포 플로우를 재현하기가 어려워서,
        // localhost에서는 auth 상태를 유지하고 401을 그대로 전파한다.
        const isLocalhost =
          typeof window !== 'undefined' &&
          (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1');
        if (!isLocalhost) {
          localStorage.removeItem(TOKEN_KEY);
          localStorage.removeItem('tt_auth_v2');
          window.dispatchEvent(new CustomEvent('auth:cleared'));
        }
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
  const url = buildUrl(path);
  const method = (init?.method ?? 'GET').toUpperCase();
  const rawBody = init?.body;
  const hasBody =
    rawBody != null &&
    !(typeof rawBody === 'string' && rawBody.length === 0);
  // DELETE·GET 등 본문 없는 요청에 application/json을 붙이면 일부 서버가 415를 반환함.
  const needsDefaultJsonContentType =
    !hasContentTypeHeader(init?.headers) &&
    !((method === 'DELETE' || method === 'GET') && !hasBody);

  const send = async (token: string | null) => {
    return fetch(url, {
      ...init,
      credentials: 'include',
      headers: {
        ...(needsDefaultJsonContentType ? { 'Content-Type': 'application/json' } : {}),
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

/**
 * 응답 본문/상태를 직접 다뤄야 하는 API용 raw fetch 래퍼.
 * - Authorization/refresh 동작은 apiFetch와 동일
 * - Content-Type은 강제 주입하지 않음(FormData 업로드용)
 */
export async function apiFetchRaw(path: string, init?: RequestInit): Promise<Response> {
  const url = buildUrl(path);

  const send = async (token: string | null) => {
    return fetch(url, {
      ...init,
      credentials: 'include',
      headers: {
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
        ...(init?.headers ?? {}),
      },
    });
  };

  let res = await send(localStorage.getItem(TOKEN_KEY));
  const skipRefresh = path.includes('/auth/refresh') || path.includes('/auth/logout');
  if (res.status === 401 && !skipRefresh) {
    const newToken = await refreshAccessToken();
    if (newToken) {
      res = await send(newToken);
    }
  }
  return res;
}
