import { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { saveAccessToken } from '@/features/auth/auth';
import { useAuth } from '@/features/auth/useAuth';
import { apiFetch } from '@/lib/api';

/**
 * OAuth 콜백 처리 페이지 (사용자가 카카오/구글 인증 완료 후 백엔드를 거쳐 도착).
 *
 * 백엔드 콜백 응답 스키마 (확인된 부분):
 *   data.tokenInfo.accessToken (JWT) — 서비스 API 호출용
 *   data.tokenInfo.expiresIn       — 만료 시간(초)
 *   data.user { id, name, imageUrl } — 서비스 사용자 정보
 *   Cookie: refreshToken (httpOnly)  — 갱신용
 *
 * 미확인 (백엔드 답변 대기 중):
 *   백엔드가 프론트로 어떻게 사용자를 돌려보내는지 (URL 파라미터? 쿠키만?)
 *   현재는 아래 두 가지 패턴 모두 수용하도록 작성:
 *     A. URL 쿼리에 accessToken 박혀 있으면 그걸 사용 + /auth/me 호출
 *     B. URL이 비어있으면 cookie 기반으로 /auth/me 직접 호출
 *
 * 실제 백엔드 동작에 맞춰 fetchSession 함수만 단순화하면 됨.
 */

const ERROR_MESSAGES: Record<string, string> = {
  USER_CANCELLED: '소셜 로그인을 취소했어요.',
  INVALID_OAUTH_CODE: '인증 코드가 만료됐거나 변조됐어요. 다시 시도해주세요.',
  CSRF_ERROR: '보안 검증에 실패했어요. 다시 시도해주세요.',
  BANNED_USER: '서비스 이용이 제한된 계정이에요.',
  REQUIRED_INFO_MISSING: '소셜 로그인에서 이메일 등 필수 항목을 받지 못했어요. 동의 화면에서 모든 항목을 체크해주세요.',
  INTERNAL_SERVER_ERROR: '서버에서 일시적인 오류가 발생했어요. 잠시 후 다시 시도해주세요.',
  OAUTH_PLATFORM_ERROR: '카카오/구글 서버 응답에 문제가 있어요. 잠시 후 다시 시도해주세요.',
  access_denied: '소셜 로그인을 취소했어요.',
};

function describeError(code: string | null): string {
  if (!code) return '인증 처리 중 오류가 발생했어요.';
  return ERROR_MESSAGES[code] ?? `인증 처리 중 오류가 발생했어요. (${code})`;
}

export function AuthCallbackPage() {
  const nav = useNavigate();
  const { login } = useAuth();
  const [params] = useSearchParams();
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    // 1. 에러 파라미터 우선 처리 (USER_CANCELLED, CSRF_ERROR 등)
    const errorCode = params.get('error') ?? params.get('code');
    if (errorCode && !params.get('accessToken')) {
      setError(describeError(errorCode));
      return;
    }

    const fetchSession = async () => {
      try {
        // 2. URL 쿼리에 토큰 있으면 저장 (패턴 A)
        const tokenFromUrl = params.get('accessToken');
        if (tokenFromUrl) {
          saveAccessToken(tokenFromUrl);
        }

        // 3. URL에 user 정보가 같이 박혀있으면 사용 (백엔드가 한 번에 다 넘기는 경우)
        const userId = params.get('userId') ?? params.get('user.id');
        const userName = params.get('userName') ?? params.get('user.name');
        const userImage = params.get('userImageUrl') ?? params.get('user.imageUrl');
        if (userId && userName) {
          login({ id: userId, name: userName, imageUrl: userImage ?? undefined });
        } else {
          // 4. URL에 user 정보가 없으면 /auth/me 호출 (Bearer 토큰 또는 쿠키 사용)
          const me = await apiFetch<{ id: string; name: string; imageUrl?: string }>('/auth/me');
          login({ id: me.id, name: me.name, imageUrl: me.imageUrl });
        }

        const redirect = sessionStorage.getItem('post_login_redirect') ?? '/';
        sessionStorage.removeItem('post_login_redirect');
        nav(redirect, { replace: true });
      } catch (e) {
        setError(e instanceof Error ? e.message : '인증 처리 중 오류가 발생했어요.');
      }
    };
    fetchSession();
  }, [login, nav, params]);

  if (error) {
    return (
      <div className="min-h-dvh bg-white px-6 pt-24">
        <div className="mx-auto flex max-w-sm flex-col items-center text-center">
          <h1 className="text-xl font-black tracking-tight text-slate-900">
            로그인을 마치지 못했어요
          </h1>
          <p className="mt-3 text-xs font-bold leading-relaxed text-slate-400">{error}</p>
          <button
            type="button"
            onClick={() => nav('/login', { replace: true })}
            className="mt-8 w-full cursor-pointer rounded-2xl bg-slate-900 py-4 text-sm font-black text-white active:scale-[0.99]"
          >
            로그인 화면으로 돌아가기
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="grid min-h-dvh place-items-center bg-white px-6">
      <div className="text-center">
        <p className="text-sm font-bold text-slate-400">로그인 처리 중…</p>
      </div>
    </div>
  );
}
