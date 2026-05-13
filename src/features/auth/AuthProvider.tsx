import { useEffect, useState, type ReactNode } from 'react';
import { ApiError, apiFetch } from '@/lib/api';
import { clearAuth, loadAccessToken, loadAuth, saveAuth } from './auth';
import { AuthContext, type User } from './AuthContext';

/**
 * 앱 부팅 시 localStorage에서 로그인 상태를 hydrate.
 * login/logout 마다 즉시 localStorage에 동기화 → 새로고침해도 세션 유지.
 */
function hydrateUser(): User {
  const state = loadAuth();
  if (state.status === 'logged_in') {
    return {
      id: state.user.id,
      name: state.user.name,
      imageUrl: state.user.imageUrl,
    };
  }
  return null;
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User>(hydrateUser);

  /**
   * 일부 배포/콜백 경로에서 accessToken만 저장되고 `tt_auth_v2` 프로필이 비는 경우 복구.
   * (새로고침 시 hydrate가 logged_out으로만 되어 로그인으로 튕기는 현상 완화)
   */
  useEffect(() => {
    let cancelled = false;
    const state = loadAuth();
    if (state.status === 'logged_in') return;
    const token = loadAccessToken();
    if (!token) return;

    void (async () => {
      try {
        const me = await apiFetch<{ id: string; name: string; imageUrl?: string }>('/users/me');
        if (cancelled) return;
        const next = { id: me.id, name: me.name, imageUrl: me.imageUrl };
        saveAuth({ status: 'logged_in', user: next });
        setUser(next);
      } catch {
        // 토큰 무효 등 — 그대로 비로그인
      }
    })();

    return () => {
      cancelled = true;
    };
  }, []);

  // refresh token이 만료/탈취되면 api.ts에서 'auth:cleared' 이벤트 발행.
  // 여기서 듣고 user state도 즉시 null로 → ProtectedRoute가 /login으로 리다이렉트.
  useEffect(() => {
    const handler = () => setUser(null);
    window.addEventListener('auth:cleared', handler);
    return () => window.removeEventListener('auth:cleared', handler);
  }, []);

  return (
    <AuthContext.Provider
      value={{
        user,
        login: (next) => {
          setUser(next);
          if (next) {
            saveAuth({
              status: 'logged_in',
              user: { id: next.id, name: next.name, imageUrl: next.imageUrl },
            });
          } else {
            clearAuth();
          }
        },
        logout: async () => {
          // 백엔드에 로그아웃 통보 (refreshToken 파기 요청).
          // 어떤 결과든 로컬 클리어 — TOKEN_NOT_FOUND(이미 로그아웃) / 401(만료) / 네트워크 에러 모두
          // 사용자 입장에선 "로그아웃됨"이 자연스러움.
          try {
            await apiFetch<null>('/auth/logout', { method: 'POST' });
          } catch {
            // 의도적으로 무시
          }
          setUser(null);
          clearAuth();
        },
        withdraw: async () => {
          // 회원 탈퇴 — 백엔드 사용자/연동 데이터 삭제.
          // 404 USER_NOT_FOUND: 이미 탈퇴된 계정 → 성공으로 간주.
          // 500 WITHDRAWAL_FAILED: 진짜 실패 → throw해서 caller가 재시도 안내.
          try {
            await apiFetch<null>('/auth/withdraw', { method: 'DELETE' });
          } catch (e) {
            if (e instanceof ApiError && e.status === 404) {
              // 이미 탈퇴된 상태 — 로컬 정리만 하면 됨
            } else {
              throw e;
            }
          }
          // 모든 로컬 데이터 삭제 (여행, 지출, 인증 등 전부).
          // 탈퇴 후 같은 기기에서 재가입할 때 깨끗한 상태로 시작하도록.
          setUser(null);
          localStorage.clear();
        },
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}
