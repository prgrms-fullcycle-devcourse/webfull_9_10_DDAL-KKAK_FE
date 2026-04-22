const KEY = 'tt_auth_v1'

export type AuthState =
  | { status: 'logged_out' }
  | { status: 'logged_in'; user: { name: string } }

export function loadAuth(): AuthState {
  try {
    const raw = localStorage.getItem(KEY)
    if (!raw) return { status: 'logged_out' }
    const parsed = JSON.parse(raw) as AuthState
    if (parsed?.status === 'logged_in' && parsed.user?.name) return parsed
    return { status: 'logged_out' }
  } catch {
    return { status: 'logged_out' }
  }
}

export function saveAuth(state: AuthState) {
  localStorage.setItem(KEY, JSON.stringify(state))
}

export function clearAuth() {
  localStorage.removeItem(KEY)
}

