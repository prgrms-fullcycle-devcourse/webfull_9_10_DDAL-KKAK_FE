const KEY = 'tt_auth_v2';
const TOKEN_KEY = 'tt_access_token_v1';

export type AuthState =
  | { status: 'logged_out' }
  | {
      status: 'logged_in';
      user: { id: string; name: string; imageUrl?: string };
    };

export function loadAuth(): AuthState {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return { status: 'logged_out' };
    const parsed = JSON.parse(raw) as AuthState;
    if (parsed?.status === 'logged_in' && parsed.user?.id && parsed.user?.name) return parsed;
    return { status: 'logged_out' };
  } catch {
    return { status: 'logged_out' };
  }
}

export function saveAuth(state: AuthState) {
  localStorage.setItem(KEY, JSON.stringify(state));
}

export function clearAuth() {
  localStorage.removeItem(KEY);
  localStorage.removeItem(TOKEN_KEY);
}

/** 백엔드 발급 accessToken (JWT) 저장. API 호출 시 Authorization: Bearer 헤더에 사용. */
export function saveAccessToken(token: string) {
  localStorage.setItem(TOKEN_KEY, token);
}

export function loadAccessToken(): string | null {
  return localStorage.getItem(TOKEN_KEY);
}
