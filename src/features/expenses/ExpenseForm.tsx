import { useEffect, useMemo, useState } from 'react';
import type { Expense } from '@/features/expenses/types';
import { useJourneyQuery } from '@/features/journeys/queries';
import {
  useAddExpenseMutation,
  useDeleteExpenseMutation,
  useExpenseQuery,
  useUpdateExpenseMutation,
} from '@/features/expenses/queries';
import { TopBar } from '@/components/layout/TopBar';
import { nowLocalIso, toStoredWallClock } from '@/lib/datetime';

type Mode = 'create' | 'edit' | 'ocr';

interface ExpenseFormProps {
  mode: Mode;
  journeyId: string;
  expenseId?: string;
  initialDraft?: Partial<Expense>;
  receiptImageUrl?: string;
  onSaved: (expense: Expense) => void;
  onCanceled?: () => void;
}

export function ExpenseForm({
  mode,
  journeyId,
  expenseId,
  initialDraft,
  receiptImageUrl,
  onSaved,
  onCanceled,
}: ExpenseFormProps) {
  const { data: journey } = useJourneyQuery(journeyId);
  const { data: existing } = useExpenseQuery(mode === 'edit' ? expenseId : undefined);

  const addMut = useAddExpenseMutation();
  const updateMut = useUpdateExpenseMutation();
  const deleteMut = useDeleteExpenseMutation();

  const saving = addMut.isPending || updateMut.isPending || deleteMut.isPending;

  // ── state ──
  const [emoji, setEmoji] = useState('🍚');
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);

  const EMOJI_LIST = [
    '🍜',
    '🍣',
    '🍕',
    '🍔',
    '🌮',
    '🍱',
    '🥗',
    '🍰',
    '🍩',
    '🧁',
    '🍺',
    '🍵',
    '☕',
    '🥤',
    '🧃',
    '🍶',
    '🥂',
    '🍷',
    '🧋',
    '🍦',
    '🛍️',
    '👗',
    '👟',
    '💄',
    '🎒',
    '⌚',
    '📱',
    '💊',
    '🧴',
    '🪥',
    '🚕',
    '🚌',
    '🚇',
    '✈️',
    '🚂',
    '🚢',
    '🛵',
    '🚁',
    '🚡',
    '🛺',
    '🏨',
    '🏖️',
    '🎡',
    '🎭',
    '🏛️',
    '🎬',
    '🎮',
    '🎵',
    '🎨',
    '🏄',
    '💰',
    '🧾',
    '🎁',
    '🌸',
    '🗺️',
    '📸',
    '🔑',
    '🧳',
    '⛽',
    '🏥',
  ];
  const [storeName, setStoreName] = useState('');
  const [amountLocal, setAmountLocal] = useState<number | ''>('');
  const [paidAt, setPaidAt] = useState(() => nowLocalIso());
  const [payer, setPayer] = useState<string>('');
  const [splitMode, setSplitMode] = useState<'personal' | 'shared'>('personal');
  const [splitWith, setSplitWith] = useState<string[]>([]);
  const [method, setMethod] = useState<'cash' | 'card'>('card');
  const [comment, setComment] = useState('');

  // ── prefill: journey 로드되면 기본 payer/splitWith 세팅 ──
  useEffect(() => {
    if (!journey) return;
    const self = journey.selfParticipant ?? journey.participants[0] ?? '나';
    setPayer((prev) => prev || self);
    setSplitWith((prev) => (prev.length ? prev : [self]));
  }, [journey]);

  // ── prefill: edit existing / ocr draft ──
  useEffect(() => {
    const src = existing ?? initialDraft;
    if (!src) return;

    if (src.emoji) setEmoji(src.emoji);
    if (src.storeName) setStoreName(src.storeName);
    if (src.amountLocal !== undefined) setAmountLocal(src.amountLocal);
    if (src.paidAt) setPaidAt(src.paidAt.slice(0, 16));
    if (src.payer) setPayer(src.payer);
    if (src.splitMode) setSplitMode(src.splitMode);
    if (src.splitWith) setSplitWith(src.splitWith);
    if (src.method) setMethod(src.method);
    if (src.comment) setComment(src.comment);
  }, [existing, initialDraft]);

  // ── 계산 ──
  const rate = journey?.rate ?? 1;
  const amountKRW = typeof amountLocal === 'number' ? Math.round(amountLocal * rate) : 0;

  const self = journey?.selfParticipant ?? journey?.participants[0] ?? '나';

  const myShareLocal = useMemo(() => {
    if (typeof amountLocal !== 'number') return 0;
    if (splitMode === 'personal') return payer === self ? amountLocal : 0;
    if (!splitWith.includes(self)) return 0;
    return Math.round(amountLocal / splitWith.length);
  }, [amountLocal, splitMode, splitWith, payer, self]);

  const myShareKRW = Math.round(myShareLocal * rate);
  const participants = journey?.participants ?? [];

  // ── 핸들러 ──
  async function handleSubmit() {
    if (!journey) return;
    if (typeof amountLocal !== 'number' || amountLocal <= 0) {
      alert('금액을 입력해주세요');
      return;
    }
    if (!payer) {
      alert('결제자를 선택해주세요');
      return;
    }
    if (splitMode === 'shared' && splitWith.length === 0) {
      alert('분담자를 최소 1명 선택해주세요');
      return;
    }

    const now = new Date().toISOString();
    const payload: Expense = {
      id: expenseId ?? crypto.randomUUID(),
      journeyId,
      emoji,
      storeName: storeName.trim() || '(이름 없음)',
      category: '기타',
      amountLocal,
      currency: journey.currency,
      paidAt: toStoredWallClock(paidAt),
      payer,
      splitMode,
      splitWith: splitMode === 'personal' ? [payer] : splitWith,
      method: 'cash',
      comment: comment.trim() || undefined,
      receiptImageUrl: undefined,
      createdAt: existing?.createdAt ?? now,
      updatedAt: now,
    };

    if (mode === 'edit' && expenseId) {
      const saved = await updateMut.mutateAsync({ id: expenseId, patch: payload });
      onSaved(saved);
    } else {
      await addMut.mutateAsync(payload);
      onSaved(payload);
    }
  }

  async function handleDelete() {
    if (!expenseId) return;
    const ok = window.confirm('이 내역을 삭제할까요?');
    if (!ok) return;
    await deleteMut.mutateAsync({ id: expenseId, journeyId });
    onCanceled?.();
  }

  const isEdit = mode === 'edit';
  const currency = journey?.currency ?? 'JPY';

  return (
    <div className="min-h-dvh bg-white">
      <TopBar
        title={
          <span>
            {mode === 'edit' ? '지출 내역 수정' : mode === 'ocr' ? '영수증 확인' : '지출 내역 추가'}
          </span>
        }
        onBack={onCanceled}
      />

      <main className="space-y-8 px-6 pb-28">
        {receiptImageUrl && (
          <img
            src={receiptImageUrl}
            alt="영수증"
            className="w-full rounded-2xl border border-slate-100"
          />
        )}

        {/* 이모지 + 가게명 */}
        <section className="space-y-2">
          <div className="grid grid-cols-[auto_1fr] gap-3">
            <button
              type="button"
              onClick={() => setShowEmojiPicker((v) => !v)}
              className={`size-14 rounded-2xl border text-2xl transition active:scale-95 ${
                showEmojiPicker ? 'border-blue-400 bg-blue-50' : 'border-slate-100 bg-slate-50'
              }`}
            >
              {emoji}
            </button>
            <input
              value={storeName}
              onChange={(e) => setStoreName(e.target.value)}
              placeholder="가게명"
              className="rounded-2xl border border-slate-100 bg-slate-50 px-4 text-sm font-bold outline-none focus:border-blue-500"
            />
          </div>
          {showEmojiPicker && (
            <div className="rounded-2xl border border-slate-100 bg-slate-50 p-3">
              <div className="grid grid-cols-10 gap-1">
                {EMOJI_LIST.map((e) => (
                  <button
                    key={e}
                    type="button"
                    onClick={() => {
                      setEmoji(e);
                      setShowEmojiPicker(false);
                    }}
                    className={`flex items-center justify-center rounded-xl py-1.5 text-xl transition active:scale-90 ${
                      emoji === e ? 'bg-blue-100' : 'hover:bg-slate-100'
                    }`}
                  >
                    {e}
                  </button>
                ))}
              </div>
            </div>
          )}
        </section>

        {/* 금액 */}
        <section>
          <label className="mb-2 block text-[10px] font-black uppercase tracking-widest text-slate-400">
            금액
          </label>
          <div className="flex items-baseline gap-2 rounded-2xl border border-slate-100 bg-slate-50 px-4 py-3">
            <input
              type="number"
              inputMode="numeric"
              value={amountLocal}
              onChange={(e) => setAmountLocal(e.target.value === '' ? '' : Number(e.target.value))}
              placeholder="0"
              className="w-full bg-transparent text-2xl font-black outline-none"
            />
            <span className="font-black text-slate-500">{currency}</span>
          </div>
          {amountKRW > 0 && (
            <p className="mt-1 text-right text-xs font-bold text-slate-400">
              ≈ {amountKRW.toLocaleString()}원
            </p>
          )}
        </section>

        {/* 결제 시간 */}
        <section>
          <label className="mb-2 block text-[10px] font-black uppercase tracking-widest text-slate-400">
            결제 시간
          </label>
          <input
            type="datetime-local"
            value={paidAt}
            onChange={(e) => setPaidAt(e.target.value)}
            className="w-full rounded-2xl border border-slate-100 bg-slate-50 p-4 text-sm font-bold outline-none"
          />
        </section>

        {/* 결제자 + 유형 + 분담자 */}
        <section className="space-y-4">
          <label className="block text-[10px] font-black uppercase tracking-widest text-slate-400">
            결제 정보
          </label>

          <div>
            <p className="mb-2 text-xs font-bold text-slate-500">결제자</p>
            <div className="flex flex-wrap gap-2">
              {participants.map((p) => (
                <button
                  key={p}
                  type="button"
                  onClick={() => setPayer(p)}
                  className={`rounded-full px-4 py-2 text-sm font-bold ${
                    payer === p
                      ? 'bg-blue-600 text-white shadow-md shadow-blue-200'
                      : 'bg-slate-100 text-slate-500'
                  }`}
                >
                  {p}
                </button>
              ))}
            </div>
          </div>

          <div>
            <p className="mb-2 text-xs font-bold text-slate-500">지출 유형</p>
            <div className="grid grid-cols-2 gap-3">
              <button
                type="button"
                onClick={() => {
                  setSplitMode('personal');
                  setSplitWith([payer]);
                }}
                className={`rounded-2xl border-2 py-3 text-sm font-black ${
                  splitMode === 'personal'
                    ? 'border-blue-600 bg-white text-blue-600'
                    : 'border-slate-100 bg-slate-50 text-slate-400'
                }`}
              >
                개인
              </button>
              <button
                type="button"
                onClick={() => {
                  setSplitMode('shared');
                  setSplitWith(participants);
                }}
                className={`rounded-2xl border-2 py-3 text-sm font-black ${
                  splitMode === 'shared'
                    ? 'border-blue-600 bg-white text-blue-600'
                    : 'border-slate-100 bg-slate-50 text-slate-400'
                }`}
              >
                공동
              </button>
            </div>
          </div>

          {splitMode === 'shared' && (
            <div>
              <p className="mb-2 text-xs font-bold text-slate-500">누구와 나눠요?</p>
              <div className="flex flex-wrap gap-2">
                {participants.map((p) => {
                  const checked = splitWith.includes(p);
                  return (
                    <button
                      key={p}
                      type="button"
                      onClick={() => {
                        setSplitWith((prev) =>
                          prev.includes(p) ? prev.filter((x) => x !== p) : [...prev, p],
                        );
                      }}
                      className={`rounded-full border-2 px-4 py-2 text-sm font-bold ${
                        checked
                          ? 'border-blue-500 bg-blue-50 text-blue-600'
                          : 'border-slate-100 bg-white text-slate-400'
                      }`}
                    >
                      {checked ? '✓ ' : ''}
                      {p}
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {splitMode === 'shared' && splitWith.length > 0 && myShareLocal > 0 && (
            <div className="rounded-2xl border border-blue-100 bg-blue-50 p-4 text-xs font-bold leading-relaxed text-blue-700">
              <p>{splitWith.length}명이 1/n으로 나눠요</p>
              <p className="mt-1">
                · 내 몫: {myShareLocal.toLocaleString()} {currency} (약{' '}
                {myShareKRW.toLocaleString()}원)
              </p>
            </div>
          )}
        </section>

        {/* 결제 방법 */}
        <section>
          <label className="mb-2 block text-[10px] font-black uppercase tracking-widest text-slate-400">
            결제 방법
          </label>
          <div className="grid grid-cols-2 gap-3">
            <button
              type="button"
              onClick={() => setMethod('cash')}
              className={`rounded-2xl border-2 py-3 text-sm font-black ${
                method === 'cash'
                  ? 'border-blue-600 bg-white text-blue-600'
                  : 'border-slate-100 bg-slate-50 text-slate-400'
              }`}
            >
              💵 현금
            </button>
            <button
              type="button"
              onClick={() => setMethod('card')}
              className={`rounded-2xl border-2 py-3 text-sm font-black ${
                method === 'card'
                  ? 'border-blue-600 bg-white text-blue-600'
                  : 'border-slate-100 bg-slate-50 text-slate-400'
              }`}
            >
              💳 카드
            </button>
          </div>
        </section>

        {/* 코멘트 */}
        <section>
          <label className="mb-2 block text-[10px] font-black uppercase tracking-widest text-slate-400">
            코멘트 (선택)
          </label>
          <textarea
            value={comment}
            onChange={(e) => setComment(e.target.value)}
            rows={3}
            placeholder="메모를 남겨보세요"
            className="w-full resize-none rounded-2xl border border-slate-100 bg-slate-50 p-4 text-sm font-bold outline-none focus:border-blue-500"
          />
        </section>
      </main>

      {/* 하단 버튼 */}
      <div className="sticky bottom-0 bg-white p-6">
        {isEdit ? (
          <div className="grid grid-cols-2 gap-4">
            <button
              type="button"
              disabled={saving}
              onClick={handleDelete}
              className="w-full rounded-3xl bg-[#FF4D4D] py-5 text-xl font-black tracking-tight text-white shadow-xl shadow-red-100 active:scale-[0.99] disabled:opacity-50"
            >
              내역 삭제
            </button>
            <button
              type="button"
              disabled={saving}
              onClick={handleSubmit}
              className="w-full rounded-3xl bg-blue-600 py-5 text-xl font-black tracking-tight text-white shadow-xl shadow-blue-100 active:scale-[0.99] disabled:opacity-50"
            >
              {saving ? '저장 중…' : '변경 저장'}
            </button>
          </div>
        ) : (
          <button
            type="button"
            disabled={saving}
            onClick={handleSubmit}
            className="w-full rounded-3xl bg-blue-600 py-5 text-xl font-black tracking-tight text-white shadow-xl shadow-blue-100 active:scale-[0.99] disabled:opacity-50"
          >
            {saving ? '저장 중…' : '내역 저장'}
          </button>
        )}
      </div>
    </div>
  );
}
