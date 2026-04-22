import { createContext, useContext, useMemo, useState } from 'react'
import type { ReactNode } from 'react'
import { clearAuth, loadAuth, saveAuth, type AuthState } from './auth'

type AuthCtx = {
  state: AuthState
  login: (userName: string) => void
  logout: () => void
}

const Ctx = createContext<AuthCtx | null>(null)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<AuthState>(() => loadAuth())

  const value = useMemo<AuthCtx>(() => {
    return {
      state,
      login: (userName) => {
        const next: AuthState = { status: 'logged_in', user: { name: userName } }
        saveAuth(next)
        setState(next)
      },
      logout: () => {
        clearAuth()
        setState({ status: 'logged_out' })
      },
    }
  }, [state])

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>
}

export function useAuth() {
  const v = useContext(Ctx)
  if (!v) throw new Error('AuthProvider가 필요합니다.')
  return v
}

