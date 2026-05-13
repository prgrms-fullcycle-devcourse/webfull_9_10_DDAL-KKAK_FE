import { useLocation, useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '@/features/auth/useAuth';
import { oauthStartUrl } from '@/lib/api';

/** 백엔드가 `/login?err=` 또는 `/login?error=` 로 넘기는 OAuth 오류 코드 */
const OAUTH_LOGIN_ERRORS: Record<string, string> = {
  CSRF_ERROR: '보안 검증(state)에 실패했어요. 시크릿 창이 아닌 일반 창에서 다시 시도하거나, 잠시 후 한 번만 로그인해 주세요.',
  USER_CANCELLED: '소셜 로그인을 취소했어요.',
  INVALID_OAUTH_CODE: '인증 코드가 만료됐거나 변조됐어요. 다시 시도해 주세요.',
};

export function LoginPage() {
  const nav = useNavigate();
  const { login } = useAuth();
  const { state } = useLocation() as { state: { from?: string } | null };
  const [searchParams] = useSearchParams();
  const next = state?.from ?? '/';

  const oauthErrCode = searchParams.get('err') ?? searchParams.get('error');
  const oauthErrMessage = oauthErrCode
    ? (OAUTH_LOGIN_ERRORS[oauthErrCode] ?? `로그인 처리 중 오류가 있어요. (${oauthErrCode})`)
    : null;

  // OAuth 시작: 백엔드의 /auth/{provider}/login 으로 이동.
  // 백엔드가 302로 카카오/구글 인증 페이지로 보내고, 인증 완료 시
  // /auth/callback (프론트)로 돌려보내 (백엔드와 합의 필요).
  const startOAuth = (provider: 'kakao' | 'google') => {
    // OAuth 종료 후 돌아갈 위치를 sessionStorage에 임시 저장.
    // 콜백 페이지가 이 값 보고 최종 navigate.
    if (next && next !== '/login') {
      sessionStorage.setItem('post_login_redirect', next);
    }
    window.location.href = oauthStartUrl(provider);
  };

  return (
    <div className="min-h-dvh bg-white px-6 pt-24">
      <div className="mx-auto flex max-w-sm flex-col items-center text-center">
        <img
          src="/icons/icon-512.png"
          alt="Travel Tick"
          className="mb-4 size-32 select-none"
          draggable={false}
        />
        <h1 className="text-2xl font-black tracking-tight text-slate-900">트래블 틱</h1>
        <p className="mt-3 text-sm font-bold leading-relaxed text-slate-400">
          여행은 내가 할게,
          <br />
          기록은 네가 할래?
        </p>

        {oauthErrMessage ? (
          <p
            className="mt-6 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-left text-xs font-bold leading-relaxed text-amber-900"
            role="alert"
          >
            {oauthErrMessage}
          </p>
        ) : null}

        <div className="mt-10 w-full space-y-3">
          <button
            type="button"
            onClick={() => startOAuth('kakao')}
            className="w-full cursor-pointer rounded-2xl bg-yellow-300 py-4 text-sm font-black text-slate-900 active:scale-[0.99]"
          >
            카카오로 1초 만에 시작
          </button>
          <button
            type="button"
            onClick={() => startOAuth('google')}
            className="w-full cursor-pointer rounded-2xl bg-slate-900 py-4 text-sm font-black text-white active:scale-[0.99]"
          >
            구글로 시작
          </button>
          {import.meta.env.DEV ? (
            <button
              type="button"
              onClick={() => {
                login({ id: 'demo-user', name: '영아' });
                nav(next, { replace: true });
              }}
              className="w-full cursor-pointer rounded-2xl border border-slate-200 bg-white py-3 text-xs font-bold text-slate-500 active:scale-[0.99]"
            >
              데모 사용자로 진입 (개발용)
            </button>
          ) : null}
        </div>

        <p className="mt-10 text-[11px] font-bold text-slate-300">
          소셜 로그인은 백엔드 연결 후 동작합니다.
        </p>
      </div>
    </div>
  );
}
