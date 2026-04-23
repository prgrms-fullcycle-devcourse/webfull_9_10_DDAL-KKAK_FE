import { useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '@/features/auth/useAuth';

export function LoginPage() {
  const nav = useNavigate();
  const { login } = useAuth();
  const { state } = useLocation() as { state: { from?: string } | null };
  const next = state?.from ?? '/';

  return (
    <div className="min-h-dvh bg-white px-6 pt-24">
      <div className="mx-auto flex max-w-sm flex-col items-center text-center">
        <div className="mb-6 grid size-16 place-items-center rounded-3xl bg-slate-50 text-3xl">
          🧾✈️
        </div>
        <h1 className="text-2xl font-black tracking-tight text-slate-900">트래블 틱</h1>
        <p className="mt-3 text-sm font-bold leading-relaxed text-slate-400">
          여행은 내가 할게,
          <br />
          기록은 네가 할래?
        </p>

        <div className="mt-10 w-full space-y-3">
          <button
            type="button"
            onClick={() => {
              login('영아');
              nav(next, { replace: true });
            }}
            className="w-full rounded-2xl bg-yellow-300 py-4 text-sm font-black text-slate-900 active:scale-[0.99]"
          >
            카카오로 1초 만에 시작
          </button>
          <button
            type="button"
            onClick={() => {
              login('영아');
              nav(next, { replace: true });
            }}
            className="w-full rounded-2xl bg-slate-900 py-4 text-sm font-black text-white active:scale-[0.99]"
          >
            구글로 시작
          </button>
        </div>

        <p className="mt-10 text-[11px] font-bold text-slate-300">
          지금은 프론트 초기 화면(Mock)입니다.
        </p>
      </div>
    </div>
  );
}
