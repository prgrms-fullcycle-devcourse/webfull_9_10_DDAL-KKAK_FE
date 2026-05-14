import { RotateCcw, RotateCw, Smile, User, Users } from 'lucide-react';
import { useMemo, useState } from 'react';
import { useLocation, useNavigate, useParams } from 'react-router-dom';
import { TopBar } from '@/components/layout/TopBar';
import { useJourneyQuery } from '@/features/journeys/queries';
import { formatKRW, formatLocal } from '@/lib/money';
import { ledgerSelfName } from '@/features/settlement/calc';
import { rotateDataUrl } from '@/lib/image';
import type { OcrDraft } from '@/features/ocr/types';
import { useAddExpenseMutation } from '@/features/expenses/queries';
import { getExpenseErrorMessage } from '@/features/expenses/expensesApi';
import { nowLocalIso, toStoredWallClock } from '@/lib/datetime';
import { useAuth } from '@/features/auth/useAuth';
import { deleteReceiptOcrJob, getOcrErrorMessage } from '@/features/ocr/ocrApi';
import { ToastPortal } from '@/components/ui/Toast';
import { useToast } from '@/components/ui/useToast';

type LocationState = { draft?: OcrDraft; imageDataUrl?: string; receiptId?: string };

export function OcrPreviewPage() {
  const nav = useNavigate();
  const { journeyId } = useParams();
  const { state } = useLocation() as { state: LocationState | null };
  const { user } = useAuth();
  const { data: journey } = useJourneyQuery(journeyId);
  const addExpense = useAddExpenseMutation(user?.id);
  const { showToast, toasts } = useToast();

  const initialDraft = useMemo<OcrDraft | null>(() => {
    return state?.draft ?? null;
  }, [state]);

  const [draft, setDraft] = useState<OcrDraft | null>(initialDraft);
  const [imageDataUrl, setImageDataUrl] = useState<string | null>(state?.imageDataUrl ?? null);
  const [isRotating, setIsRotating] = useState(false);

  if (!journey) return null;

  if (!draft) {
    return (
      <div className="min-h-dvh bg-white">
        <TopBar title="OCR 결과 확인" backTo={journeyId ? `/journeys/${journeyId}` : '/'} />
        <div className="px-6 py-10">
          <p className="text-sm font-bold text-slate-500">
            스캔 결과가 없어요. 스캔 화면에서 다시 진행해 주세요.
          </p>
          <button
            type="button"
            onClick={() => nav(`/journeys/${journey.id}/scan`, { replace: true })}
            className="mt-6 w-full rounded-2xl bg-blue-600 py-4 text-sm font-black text-white"
          >
            스캔하러 가기
          </button>
        </div>
      </div>
    );
  }

  const defaultSplitWith = journey.participants.length ? journey.participants : ['나'];
  const resolveParticipantId = (name: string): string => {
    const byName = journey.participantIdsByName;
    if (!byName) return name;
    return byName[name] ?? name;
  };
  const receiptId = state?.receiptId;
  const cleanupReceiptJob = async () => {
    if (!receiptId) return;
    try {
      await deleteReceiptOcrJob({ receiptId });
    } catch {
      // 삭제 실패와 무관하게 이동 동선은 유지
    }
  };

  const onPost = async () => {
    if (!journeyId || !draft) return;
    const systemNow = new Date().toISOString(); // createdAt/updatedAt 용 (UTC)
    const paidAt = toStoredWallClock(draft.paidAt || nowLocalIso());
    const isShared = draft.splitMode === 'shared';
    const splitWith = isShared ? (draft.splitWith ?? defaultSplitWith) : [draft.payer];

    try {
      await addExpense.mutateAsync({
        expense: {
          id: `e-${Date.now()}`,
          journeyId,
          receiptId: receiptId ?? undefined,
          storeName: draft.storeName.trim() || '지출',
          amountLocal: Number(draft.amountLocal) || 0,

          currency: draft.currency,
          splitMode: draft.splitMode,
          splitWith,

          method: draft.method ?? 'card',
          category: draft.category || '기타',
          paidAt,
          payer: draft.payer,
          payerParticipantId: resolveParticipantId(draft.payer),
          emoji: draft.emoji || '🧾',
          fxMode: journey.rateMode === 'fixed' ? 'FIXED' : 'REALTIME',
          fxRateTripToKrw: journey.rate,
          amountKrw: Math.round((Number(draft.amountLocal) || 0) * journey.rate),

          comment: draft.comment?.trim() || undefined,

          createdAt: systemNow,
          updatedAt: systemNow,
        },
        nameToParticipantId: journey.participantIdsByName,
      });

      nav(`/journeys/${journeyId}`, { replace: true });
    } catch (error) {
      showToast(getExpenseErrorMessage(error));
    }
  };

  return (
    <div className="min-h-dvh bg-slate-50">
      <ToastPortal toasts={toasts} />
      <TopBar
        title="스캔 완료! 3초 컷"
        onBack={() => {
          void (async () => {
            await cleanupReceiptJob();
            // replace: 미리보기를 히스토리에서 빼지 않으면 스캔 화면에서 X(뒤로) 시 다시 미리보기로 돌아감
            nav(`/journeys/${journey.id}/scan`, { replace: true });
          })();
        }}
      />

      <main className="space-y-4 px-6 py-6 pb-28">
        {imageDataUrl ? (
          <section className="rounded-3xl border border-slate-100 bg-white p-4 shadow-sm">
            <div className="flex items-center justify-between">
              <p className="text-[10px] font-black uppercase tracking-widest text-slate-300">
                Receipt
              </p>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  disabled={isRotating}
                  onClick={async () => {
                    setIsRotating(true);
                    try {
                      setImageDataUrl(await rotateDataUrl(imageDataUrl, -90));
                    } finally {
                      setIsRotating(false);
                    }
                  }}
                  className="grid size-9 place-items-center rounded-xl bg-slate-50 text-slate-500 disabled:opacity-60"
                  aria-label="왼쪽으로 회전"
                >
                  <RotateCcw className="size-4" />
                </button>
                <button
                  type="button"
                  disabled={isRotating}
                  onClick={async () => {
                    setIsRotating(true);
                    try {
                      setImageDataUrl(await rotateDataUrl(imageDataUrl, 90));
                    } finally {
                      setIsRotating(false);
                    }
                  }}
                  className="grid size-9 place-items-center rounded-xl bg-slate-50 text-slate-500 disabled:opacity-60"
                  aria-label="오른쪽으로 회전"
                >
                  <RotateCw className="size-4" />
                </button>
                <button
                  type="button"
                  disabled={isRotating}
                  onClick={async () => {
                    setIsRotating(true);
                    try {
                      setImageDataUrl(await rotateDataUrl(imageDataUrl, -5));
                    } finally {
                      setIsRotating(false);
                    }
                  }}
                  className="rounded-xl bg-slate-50 px-3 py-2 text-[10px] font-black text-slate-500 disabled:opacity-60"
                >
                  -5°
                </button>
                <button
                  type="button"
                  disabled={isRotating}
                  onClick={async () => {
                    setIsRotating(true);
                    try {
                      setImageDataUrl(await rotateDataUrl(imageDataUrl, 5));
                    } finally {
                      setIsRotating(false);
                    }
                  }}
                  className="rounded-xl bg-slate-50 px-3 py-2 text-[10px] font-black text-slate-500 disabled:opacity-60"
                >
                  +5°
                </button>
              </div>
            </div>

            <div className="mt-3 overflow-hidden rounded-2xl bg-slate-50">
              <img src={imageDataUrl} alt="영수증" className="h-56 w-full object-contain" />
            </div>

            <p className="mt-3 text-[11px] font-bold text-slate-400">
              글씨가 기울어져 보이면 여기서 먼저 반듯하게 맞춰주세요.
            </p>
          </section>
        ) : null}

        <section className="rounded-3xl border border-slate-100 bg-white p-6 shadow-sm">
          <div className="mb-6 flex items-start justify-between">
            <div className="min-w-0">
              <label className="mb-1 block text-[10px] font-black uppercase text-slate-300">
                Store
              </label>
              <input
                value={draft.storeName}
                onChange={(e) => setDraft({ ...draft, storeName: e.target.value })}
                className="w-full bg-transparent text-xl font-black outline-none"
              />
            </div>
            <div className="rounded-2xl bg-slate-50 p-2 text-4xl">{draft.emoji}</div>
          </div>

          <div className="space-y-4">
            <div className="flex items-center justify-between border-y border-slate-50 py-4">
              <span className="font-black text-slate-400">현지 금액</span>
              <div className="flex items-center gap-2">
                <span className="text-sm font-black">{draft.currency}</span>
                <input
                  type="number"
                  value={draft.amountLocal}
                  onChange={(e) => setDraft({ ...draft, amountLocal: Number(e.target.value) })}
                  className="w-32 bg-transparent text-right text-3xl font-black outline-none"
                />
              </div>
            </div>
            <div className="flex items-center justify-between">
              <span className="font-black text-slate-400">KRW 환산</span>
              <span className="text-xl font-black text-blue-600">
                약 {formatKRW(draft.amountLocal * journey.rate)}원
              </span>
            </div>
          </div>
        </section>

        <section className="space-y-6 rounded-3xl border border-slate-100 bg-white p-6 shadow-sm">
          <div>
            <label className="mb-3 block text-[10px] font-black uppercase text-slate-300">
              Classification
            </label>
            <div className="flex rounded-xl bg-slate-100 p-1">
              <button
                type="button"
                onClick={() =>
                  setDraft({
                    ...draft,
                    splitMode: 'shared',
                    splitWith: draft.splitWith ?? defaultSplitWith,
                  })
                }
                className={`flex-1 rounded-lg py-3 text-sm font-black transition-all ${draft.splitMode === 'shared' ? 'bg-white text-blue-600 shadow-sm' : 'text-slate-400'}`}
              >
                <Users className="mr-2 inline size-4" /> 공동 지출
              </button>
              <button
                type="button"
                onClick={() => setDraft({ ...draft, splitMode: 'personal' })}
                className={`flex-1 rounded-lg py-3 text-sm font-black transition-all ${draft.splitMode === 'personal' ? 'bg-white text-blue-600 shadow-sm' : 'text-slate-400'}`}
              >
                <User className="mr-2 inline size-4" /> 개인 지출
              </button>
            </div>
          </div>

          {draft.splitMode === 'shared' ? (
            <div>
              <label className="mb-2 block text-[10px] font-black uppercase text-slate-300">
                누구랑 1/n? (선택된 인원 수로 나눔)
              </label>
              <div className="flex flex-wrap gap-2 rounded-2xl border border-slate-100 bg-slate-50 p-4">
                {defaultSplitWith.map((p) => {
                  const current = draft.splitWith ?? defaultSplitWith;
                  const selected = current.includes(p);
                  return (
                    <button
                      key={p}
                      type="button"
                      onClick={() => {
                        const next = selected ? current.filter((x) => x !== p) : [...current, p];
                        if (next.length === 0) return;
                        setDraft({
                          ...draft,
                          splitWith: next,
                        });
                      }}
                      className={`rounded-full px-3 py-2 text-[11px] font-black transition-all ${
                        selected ? 'bg-blue-600 text-white' : 'bg-white text-slate-600'
                      }`}
                      aria-pressed={selected}
                    >
                      {p}
                    </button>
                  );
                })}
              </div>
            </div>
          ) : null}

          <div>
            <label className="mb-2 block text-[10px] font-black uppercase text-slate-300">
              결제한 사람
            </label>
            <select
              value={
                journey.participants.includes(draft.payer)
                  ? draft.payer
                  : (journey.participants[0] ?? '나')
              }
              onChange={(e) => setDraft({ ...draft, payer: e.target.value })}
              className="w-full rounded-2xl border border-slate-100 bg-slate-50 p-4 text-sm font-black outline-none"
            >
              {journey.participants.map((p) => (
                <option key={p} value={p}>
                  {p}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="mb-2 block text-[10px] font-black uppercase text-slate-300">
              결제 수단
            </label>
            <div className="flex rounded-xl bg-slate-100 p-1">
              <button
                type="button"
                onClick={() => setDraft({ ...draft, method: 'cash' })}
                className={`flex-1 rounded-lg py-3 text-sm font-black transition-all ${
                  (draft.method ?? 'card') === 'cash'
                    ? 'bg-white text-blue-600 shadow-sm'
                    : 'text-slate-400'
                }`}
              >
                현금
              </button>
              <button
                type="button"
                onClick={() => setDraft({ ...draft, method: 'card' })}
                className={`flex-1 rounded-lg py-3 text-sm font-black transition-all ${
                  (draft.method ?? 'card') === 'card'
                    ? 'bg-white text-blue-600 shadow-sm'
                    : 'text-slate-400'
                }`}
              >
                카드
              </button>
            </div>
          </div>

          <div>
            <label className="mb-3 block text-[10px] font-black uppercase text-slate-300">
              One-line Memo & Emoji
            </label>
            <div className="flex items-center rounded-2xl bg-slate-50 p-4">
              <Smile className="mr-3 size-5 text-slate-400" />
              <input
                value={draft.comment}
                onChange={(e) => setDraft({ ...draft, comment: e.target.value })}
                placeholder="그때의 기분이나 맛집 평점을 기록!"
                className="flex-1 bg-transparent text-sm font-bold outline-none"
              />
            </div>
          </div>

          <div className="rounded-2xl bg-slate-50 p-4">
            <p className="text-[10px] font-black uppercase tracking-widest text-slate-300">
              미리보기
            </p>
            <p className="mt-2 text-sm font-black text-slate-900">
              {draft.emoji} {draft.storeName} • {formatLocal(draft.amountLocal)} {journey.currency}{' '}
              (약 {formatKRW(draft.amountLocal * journey.rate)}원)
            </p>
            <p className="mt-1 text-[10px] font-bold text-slate-400">
              결제 수단: {(draft.method ?? 'card') === 'cash' ? '현금' : '카드'}
            </p>
            <p className="mt-2 text-[11px] font-bold text-blue-600">
              내 부담(가계부 기준 {ledgerSelfName(journey)}):{' '}
              {formatLocal(
                draft.splitMode === 'personal'
                  ? draft.payer.trim() === ledgerSelfName(journey)
                    ? draft.amountLocal
                    : 0
                  : draft.amountLocal /
                      Math.max(draft.splitWith?.length ?? journey.participants.length, 1),
              )}{' '}
              {journey.currency}
            </p>
          </div>
        </section>
      </main>

      <div className="fixed inset-x-0 bottom-0 mx-auto w-full max-w-md border-t border-slate-100 bg-white p-6">
        <button
          type="button"
          disabled={addExpense.isPending}
          onClick={() => void onPost()}
          className="w-full rounded-2xl bg-blue-600 py-5 text-lg font-black text-white shadow-lg shadow-blue-100 active:scale-[0.99]"
        >
          {addExpense.isPending ? '저장 중…' : '기록 게시하기'}
        </button>
        <button
          type="button"
          onClick={async () => {
            await cleanupReceiptJob();
            nav(`/journeys/${journey.id}/scan`, { replace: true });
          }}
          className="mt-3 w-full py-2 text-sm font-black text-slate-400"
        >
          다시 찍기
        </button>
        <button
          type="button"
          onClick={async () => {
            if (!receiptId) return;
            try {
              await deleteReceiptOcrJob({ receiptId });
              setImageDataUrl(null);
              setDraft({
                storeName: '',
                amountLocal: 0,
                currency: journey.currency,
                paidAt: nowLocalIso(),
                category: '기타',
                splitMode: 'shared',
                splitWith: defaultSplitWith,
                method: 'card',
                payer: journey.selfParticipant ?? journey.participants[0] ?? '나',
                emoji: '🧾',
                comment: '',
              });
              showToast('OCR 결과를 삭제했어요.');
            } catch (error) {
              showToast(getOcrErrorMessage(error));
            }
          }}
          className="mt-1 w-full py-2 text-sm font-black text-red-500"
        >
          OCR 결과 삭제
        </button>
      </div>
    </div>
  );
}
