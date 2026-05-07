import { AlertTriangle, LogOut, Sparkles, UserX } from 'lucide-react';
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { BottomNav } from '../components/layout/BottomNav';
import { TopBar } from '../components/layout/TopBar';
import { useAuth } from '@/features/auth/useAuth';

export function SettingsPage() {
  const nav = useNavigate();
  const { logout, withdraw } = useAuth();

  const [showWithdrawModal, setShowWithdrawModal] = useState(false);
  const [withdrawing, setWithdrawing] = useState(false);
  const [withdrawError, setWithdrawError] = useState<string | null>(null);

  const handleWithdraw = async () => {
    setWithdrawing(true);
    setWithdrawError(null);
    try {
      await withdraw();
      // 성공: 모든 로컬 데이터 정리됨 → 로그인 화면으로
      nav('/login', { replace: true });
    } catch (e) {
      setWithdrawError(
        e instanceof Error ? e.message : '회원 탈퇴 처리 중 오류가 발생했어요.',
      );
      setWithdrawing(false);
    }
  };

  return (
    <div className="min-h-dvh bg-white pb-20">
      <TopBar title="설정" backTo="/" />

      <main className="space-y-4 px-6 py-6">
        <div className="rounded-3xl border border-slate-100 bg-slate-50 p-6">
          <div className="flex items-center gap-3">
            <div className="grid size-10 place-items-center rounded-2xl bg-white text-slate-900 shadow-sm">
              <Sparkles className="size-5" />
            </div>
            <div>
              <p className="text-sm font-black">초기 버전</p>
              <p className="text-xs font-bold text-slate-400">
                5/15 마감용 최소 기능만 남겨뒀어요.
              </p>
            </div>
          </div>
        </div>

        <button
          type="button"
          onClick={async () => {
            await logout();
            nav('/login', { replace: true });
          }}
          className="flex w-full cursor-pointer items-center justify-between rounded-3xl border border-slate-100 bg-white p-5 text-left shadow-sm active:scale-[0.99]"
        >
          <div>
            <p className="text-sm font-black text-slate-900">로그아웃</p>
            <p className="mt-1 text-xs font-bold text-slate-400">
              세션을 종료하고 로그인 화면으로 돌아갑니다
            </p>
          </div>
          <LogOut className="size-5 text-slate-300" />
        </button>

        {/* 위험 영역 — 회원 탈퇴 */}
        <div className="pt-6">
          <p className="mb-2 px-1 text-[10px] font-black uppercase tracking-widest text-slate-400">
            위험 영역
          </p>
          <button
            type="button"
            onClick={() => setShowWithdrawModal(true)}
            className="flex w-full cursor-pointer items-center justify-between rounded-3xl border border-[#FFD0D0] bg-[#FFF5F5] p-5 text-left active:scale-[0.99]"
          >
            <div>
              <p className="text-sm font-black text-[#FF4D4D]">회원 탈퇴</p>
              <p className="mt-1 text-xs font-bold text-[#FF8888]">
                계정과 모든 여행 데이터를 영구적으로 삭제합니다
              </p>
            </div>
            <UserX className="size-5 text-[#FF8888]" />
          </button>
        </div>
      </main>

      {showWithdrawModal && (
        <WithdrawModal
          onCancel={() => {
            if (!withdrawing) {
              setShowWithdrawModal(false);
              setWithdrawError(null);
            }
          }}
          onConfirm={handleWithdraw}
          loading={withdrawing}
          error={withdrawError}
        />
      )}

      <BottomNav />
    </div>
  );
}

function WithdrawModal({
  onCancel,
  onConfirm,
  loading,
  error,
}: {
  onCancel: () => void;
  onConfirm: () => void;
  loading: boolean;
  error: string | null;
}) {
  const [confirmed, setConfirmed] = useState(false);

  return (
    <div
      className="fixed inset-0 z-50 grid place-items-center bg-black/40 px-6"
      onClick={onCancel}
    >
      <div
        className="w-full max-w-sm rounded-3xl bg-white p-6 shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-4 flex items-center gap-3">
          <div className="grid size-10 shrink-0 place-items-center rounded-2xl bg-[#FFF5F5] text-[#FF4D4D]">
            <AlertTriangle className="size-5" />
          </div>
          <h3 className="text-base font-black tracking-tight text-slate-900">
            정말 탈퇴하시겠어요?
          </h3>
        </div>

        <div className="mb-5 space-y-2 rounded-2xl bg-slate-50 p-4 text-[11px] font-bold leading-relaxed text-slate-600">
          <p>탈퇴 시 다음 데이터가 영구적으로 삭제되며 복구할 수 없어요:</p>
          <ul className="list-disc space-y-1 pl-4 text-slate-500">
            <li>내가 만든 모든 여행 (지출·정산 기록 포함)</li>
            <li>저장된 영수증 이미지</li>
            <li>연동된 카카오/구글 계정 연결</li>
          </ul>
        </div>

        <label className="mb-5 flex cursor-pointer items-center gap-2 px-1 text-xs font-bold text-slate-700">
          <input
            type="checkbox"
            checked={confirmed}
            onChange={(e) => setConfirmed(e.target.checked)}
            disabled={loading}
            className="size-4 cursor-pointer accent-[#FF4D4D]"
          />
          위 내용을 모두 확인했고, 탈퇴에 동의합니다
        </label>

        {error ? (
          <p className="mb-4 rounded-xl border border-[#FFD0D0] bg-[#FFF5F5] p-3 text-[11px] font-bold text-[#FF4D4D]">
            {error}
          </p>
        ) : null}

        <div className="grid grid-cols-2 gap-3">
          <button
            type="button"
            onClick={onCancel}
            disabled={loading}
            className="cursor-pointer rounded-2xl border border-slate-200 bg-white py-3 text-sm font-black text-slate-600 active:scale-[0.99] disabled:opacity-50"
          >
            취소
          </button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={!confirmed || loading}
            className="cursor-pointer rounded-2xl bg-[#FF4D4D] py-3 text-sm font-black text-white shadow-lg shadow-red-100 active:scale-[0.99] disabled:cursor-not-allowed disabled:opacity-50"
          >
            {loading ? '처리 중…' : '탈퇴하기'}
          </button>
        </div>
      </div>
    </div>
  );
}
