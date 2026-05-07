import html2canvas from 'html2canvas';
import { ArrowRight, Check } from 'lucide-react';
import { useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { TopBar } from '@/components/layout/TopBar';
import { useExpensesQuery } from '@/features/expenses/queries';
import { useJourneyQuery, useUpdateJourneyMutation } from '@/features/journeys/queries';
import {
  calcSettlement,
  ledgerSelfName,
  sumMySpendKRW,
  sumMySpendLocal,
  sumTotalLocal,
} from '@/features/settlement/calc';
import { dateKeyOf, timeLabelOf } from '@/lib/datetime';
import { formatKRW, formatLocal } from '@/lib/money';

export function ReportPage() {
  const nav = useNavigate();
  const { journeyId } = useParams();
  const { data: journey } = useJourneyQuery(journeyId);
  const { data: expenses = [] } = useExpensesQuery(journeyId);
  const reportRef = useRef<HTMLDivElement | null>(null);
  const [isCapturing, setIsCapturing] = useState(false);
  const [showBasis, setShowBasis] = useState(false);
  const [basisPerson, setBasisPerson] = useState<string | null>(null);
  const updateJourneyMut = useUpdateJourneyMutation();

  // 영속화된 송금 완료 키 (Journey.settledTransferKeys에서 직접 읽음)
  const doneKeys = new Set(journey?.settledTransferKeys ?? []);

  const toggleDone = (key: string) => {
    if (!journey) return;
    const current = new Set(journey.settledTransferKeys ?? []);
    if (current.has(key)) {
      current.delete(key);
    } else {
      current.add(key);
    }
    updateJourneyMut.mutate({
      id: journey.id,
      patch: { settledTransferKeys: Array.from(current) },
    });
  };

  if (!journey) return <ReportSkeleton />;

  const data = calcSettlement(journey, expenses);
  const people = journey.participants.length ? journey.participants : ['나'];
  const selfName = ledgerSelfName(journey);
  const selected = basisPerson ?? people[0];

  const totalLocal = sumTotalLocal(expenses);
  const totalKRW = totalLocal * journey.rate;
  const mySpendLocal = sumMySpendLocal(journey, expenses);
  const mySpendKRW = sumMySpendKRW(journey, expenses);

  // 내 기준 송금 분류 (전체) — 결산표는 "리포트" 성격이라 숫자는 정적 (영수증 기준)
  const toMeAll = data.transfers.filter((t) => t.to === selfName);
  const fromMeAll = data.transfers.filter((t) => t.from === selfName);

  // 합계: 전체 기준 (카드 숫자는 안 바뀜)
  const toMeTotal = toMeAll.reduce((a, t) => a + t.amountLocal, 0);
  const fromMeTotal = fromMeAll.reduce((a, t) => a + t.amountLocal, 0);

  // 미정산만 추출 (체크 안 된 transfer) — 송금 루트 리스트와 진행률 표시용
  const isSettled = (t: { from: string; to: string; amountLocal: number }) =>
    doneKeys.has(`${t.from}->${t.to}-${t.amountLocal}`);
  const toMe = toMeAll.filter((t) => !isSettled(t));
  const fromMe = fromMeAll.filter((t) => !isSettled(t));

  // 진행률 (sub-line + 카드 회색 처리용)
  const toMeDoneCount = toMeAll.length - toMe.length;
  const fromMeDoneCount = fromMeAll.length - fromMe.length;
  const allToMeSettled = toMeAll.length > 0 && toMe.length === 0;
  const allFromMeSettled = fromMeAll.length > 0 && fromMe.length === 0;

  const myNetLocal = data.nets.find((n) => n.person === selfName)?.netLocal ?? 0;
  const myNetKRW = Math.round(myNetLocal * journey.rate);
  const settleTone: 'credit' | 'debit' | 'none' =
    myNetKRW > 0 ? 'credit' : myNetKRW < 0 ? 'debit' : 'none';

  const tripDateRange = `${journey.startDate.replaceAll('-', '.')} ~ ${journey.endDate.replaceAll('-', '.')}`;

  const handleCapture = async () => {
    if (!reportRef.current) return;
    setIsCapturing(true);
    try {
      const canvas = await html2canvas(reportRef.current, {
        backgroundColor: '#FFFFFF',
        scale: 2,
      });
      const url = canvas.toDataURL('image/png');
      const a = document.createElement('a');
      a.href = url;
      a.download = `travel-tick-report-${journey.id}.png`;
      a.click();
    } finally {
      setIsCapturing(false);
    }
  };

  return (
    <div className="min-h-dvh bg-white">
      <TopBar title="최종 정산 리포트" backTo={`/journeys/${journey.id}`} />

      <main className="px-6 pb-10">
        <div ref={reportRef} className="space-y-5 pb-6 pt-4">
          {/* 1. TOTAL — 와이어프레임 히어로 */}
          <section className="rounded-[32px] bg-slate-900 p-7 text-white shadow-xl">
            {/* 여행 정체성 */}
            <div className="mb-5">
              <h2 className="text-xl font-black tracking-tight text-white">{journey.name}</h2>
              <p className="mt-1 text-[11px] font-bold tracking-tight text-white/50">
                {tripDateRange}
              </p>
            </div>

            {/* 총 지출 */}
            <div className="mt-7">
              <div className="flex items-center gap-1.5 text-[10px] font-black uppercase tracking-widest text-white/50">
                <span aria-hidden>🧾</span>
                <span>Total Trip Expense</span>
              </div>
              <div className="mt-3 flex items-baseline gap-2">
                <h3 className="text-5xl font-black tracking-tight text-white">
                  {formatLocal(totalLocal)}
                </h3>
                <span className="text-xl font-bold text-white/70">{journey.currency}</span>
              </div>
              <p className="mt-1 text-[11px] font-bold text-white/40">
                ≈ {formatKRW(totalKRW)}원 · 영수증 {expenses.length}개
              </p>
            </div>

            {/* 참가자 */}
            <div className="mt-7">
              <p className="mb-2 flex items-center gap-1.5 text-[10px] font-black uppercase tracking-widest text-white/50">
                <span aria-hidden>👥</span>
                <span>Travelers · {people.length}명</span>
              </p>
              <div className="flex flex-wrap gap-1.5">
                {people.map((p) => (
                  <span
                    key={p}
                    className={`rounded-full px-2.5 py-1 text-[10px] font-black tracking-tight ${
                      p === selfName ? 'bg-blue-500/25 text-blue-200' : 'bg-white/10 text-white/80'
                    }`}
                  >
                    {p}
                    {p === selfName && p !== '나' ? ' (나)' : ''}
                  </span>
                ))}
              </div>
            </div>
          </section>

          {/* 2. 내 기준 요약 — 3카드 그리드 */}
          <section className="grid grid-cols-3 gap-2">
            <div className="rounded-2xl border border-slate-100 bg-slate-50 p-4">
              <p className="text-[10px] font-black uppercase tracking-tighter text-slate-400">
                내가 쓴 돈
              </p>
              <p className="mt-2 text-base font-black tracking-tight text-slate-900">
                {formatKRW(mySpendKRW)}
                <span className="ml-0.5 text-[10px] font-bold text-slate-400">원</span>
              </p>
              <p className="mt-0.5 text-[10px] font-bold text-slate-300">
                {formatLocal(mySpendLocal)} {journey.currency}
              </p>
            </div>

            <div
              className={`rounded-2xl border p-4 ${
                allToMeSettled
                  ? 'border-slate-100 bg-slate-50'
                  : toMeTotal > 0
                    ? 'border-blue-100 bg-blue-50'
                    : 'border-slate-100 bg-slate-50'
              }`}
            >
              <p
                className={`text-[10px] font-black uppercase tracking-tighter ${
                  allToMeSettled
                    ? 'text-slate-400'
                    : toMeTotal > 0
                      ? 'text-blue-600'
                      : 'text-slate-400'
                }`}
              >
                받을 돈
              </p>
              <p
                className={`mt-2 text-base font-black tracking-tight ${
                  allToMeSettled
                    ? 'text-slate-400'
                    : toMeTotal > 0
                      ? 'text-blue-600'
                      : 'text-slate-300'
                }`}
              >
                {formatKRW(toMeTotal * journey.rate)}
                <span className="ml-0.5 text-[10px] font-bold opacity-70">원</span>
              </p>
              <p
                className={`mt-0.5 text-[10px] font-bold ${
                  allToMeSettled
                    ? 'text-slate-300'
                    : toMeTotal > 0
                      ? 'text-blue-400'
                      : 'text-slate-300'
                }`}
              >
                {formatLocal(toMeTotal)} {journey.currency}
              </p>
              {toMeAll.length > 0 ? (
                <p
                  className={`mt-1 text-[9px] font-bold tracking-tight ${
                    allToMeSettled ? 'text-slate-500' : 'text-slate-400'
                  }`}
                >
                  {allToMeSettled
                    ? '완료'
                    : `${toMeAll.length}건 중 ${toMeDoneCount}건 완료`}
                </p>
              ) : null}
            </div>

            <div
              className={`rounded-2xl border p-4 ${
                allFromMeSettled
                  ? 'border-slate-100 bg-slate-50'
                  : fromMeTotal > 0
                    ? 'border-[#FFD0D0] bg-[#FFF5F5]'
                    : 'border-slate-100 bg-slate-50'
              }`}
            >
              <p
                className={`text-[10px] font-black uppercase tracking-tighter ${
                  allFromMeSettled
                    ? 'text-slate-400'
                    : fromMeTotal > 0
                      ? 'text-[#FF4D4D]'
                      : 'text-slate-400'
                }`}
              >
                줄 돈
              </p>
              <p
                className={`mt-2 text-base font-black tracking-tight ${
                  allFromMeSettled
                    ? 'text-slate-400'
                    : fromMeTotal > 0
                      ? 'text-[#FF4D4D]'
                      : 'text-slate-300'
                }`}
              >
                {formatKRW(fromMeTotal * journey.rate)}
                <span className="ml-0.5 text-[10px] font-bold opacity-70">원</span>
              </p>
              <p
                className={`mt-0.5 text-[10px] font-bold ${
                  allFromMeSettled
                    ? 'text-slate-300'
                    : fromMeTotal > 0
                      ? 'text-[#FF8888]'
                      : 'text-slate-300'
                }`}
              >
                {formatLocal(fromMeTotal)} {journey.currency}
              </p>
              {fromMeAll.length > 0 ? (
                <p
                  className={`mt-1 text-[9px] font-bold tracking-tight ${
                    allFromMeSettled ? 'text-slate-500' : 'text-slate-400'
                  }`}
                >
                  {allFromMeSettled
                    ? '완료'
                    : `${fromMeAll.length}건 중 ${fromMeDoneCount}건 완료`}
                </p>
              ) : null}
            </div>
          </section>

          {/* 3. 송금 루트 — 와이어프레임처럼 이름 표기 */}
          <section>
            <div className="mb-3 flex items-center justify-between px-1">
              <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">
                송금 루트
              </p>
              <p className="text-[10px] font-bold text-slate-300">총 {data.transfers.length}건</p>
            </div>

            {data.transfers.length === 0 ? (
              <p className="rounded-2xl border border-slate-100 bg-slate-50 py-8 text-center text-[12px] font-bold text-slate-400">
                정산할 내역이 없어요. 모두 깔끔하게 끝났어요 🎉
              </p>
            ) : (
              <div className="space-y-2">
                {data.transfers.map((t) => {
                  const key = `${t.from}->${t.to}-${t.amountLocal}`;
                  const krw = Math.round(t.amountLocal * journey.rate);
                  const fromIsMe = t.from === selfName;
                  const toIsMe = t.to === selfName;
                  const done = doneKeys.has(key);
                  return (
                    <div
                      key={key}
                      className={`flex items-center justify-between rounded-2xl border px-4 py-3 transition-colors ${
                        done ? 'border-green-100 bg-green-50' : 'border-slate-100 bg-slate-50'
                      }`}
                    >
                      <div className="flex items-center gap-2 text-[12px] font-black tracking-tight">
                        <span
                          className={`rounded-md px-2 py-0.5 text-[10px] font-black ${
                            done
                              ? 'bg-green-200 text-green-700'
                              : fromIsMe
                                ? 'bg-[#FF4D4D] text-white'
                                : 'bg-white text-slate-700'
                          }`}
                        >
                          {t.from}
                        </span>
                        <ArrowRight
                          className={`size-3 ${done ? 'text-green-400' : 'text-slate-400'}`}
                        />
                        <span
                          className={`rounded-md px-2 py-0.5 text-[10px] font-black ${
                            done
                              ? 'bg-green-200 text-green-700'
                              : toIsMe
                                ? 'bg-blue-500 text-white'
                                : 'bg-white text-slate-700'
                          }`}
                        >
                          {t.to}
                        </span>
                      </div>
                      <div className="flex items-center gap-3">
                        <div className="text-right">
                          <p
                            className={`text-sm font-black tracking-tight ${done ? 'text-green-600 line-through' : 'text-slate-900'}`}
                          >
                            {formatKRW(krw)}
                            <span className="ml-0.5 text-[10px] font-bold opacity-60">원</span>
                          </p>
                          <p
                            className={`text-[10px] font-bold ${done ? 'text-green-400 line-through' : 'text-slate-400'}`}
                          >
                            {formatLocal(t.amountLocal)} {journey.currency}
                          </p>
                        </div>
                        <button
                          type="button"
                          onClick={() => toggleDone(key)}
                          className={`flex size-7 shrink-0 cursor-pointer items-center justify-center rounded-full border-2 transition-colors active:scale-95 ${
                            done
                              ? 'border-green-500 bg-green-500 text-white'
                              : 'border-slate-300 bg-white text-transparent'
                          }`}
                          aria-label="송금 완료"
                        >
                          <Check className="size-3.5" strokeWidth={3} />
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}

            {toMe.length + fromMe.length > 0 ? (
              <p className="mt-4 text-center text-[10px] font-bold text-slate-400">
                {toMe.length > 0
                  ? `${selfName} 님이 송금받을 항목은 ${toMe.length}건이에요`
                  : `${selfName} 님이 송금할 항목은 ${fromMe.length}건이에요`}
              </p>
            ) : null}
          </section>

          {/* 4. 정산 기준 (collapsible) */}
          <section className="rounded-2xl border border-slate-100 bg-slate-50 p-5">
            <button
              type="button"
              onClick={() => setShowBasis((v) => !v)}
              className="flex w-full cursor-pointer items-center justify-between text-left"
            >
              <div>
                <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">
                  Settlement basis
                </p>
                <p className="mt-1 text-sm font-black text-slate-900">
                  어떤 영수증으로 계산했나요?
                </p>
              </div>
              <span className="text-[11px] font-black text-slate-400">
                {showBasis ? '접기 ▴' : '펼치기 ▾'}
              </span>
            </button>

            {showBasis ? (
              <div className="mt-5">
                <div className="flex flex-wrap gap-2">
                  {people.map((p) => (
                    <button
                      key={p}
                      type="button"
                      onClick={() => setBasisPerson(p)}
                      className={`cursor-pointer rounded-full border px-3 py-2 text-[11px] font-black active:scale-95 ${
                        selected === p
                          ? 'border-blue-600 bg-blue-600 text-white'
                          : 'border-slate-200 bg-white text-slate-600'
                      }`}
                    >
                      {p}
                    </button>
                  ))}
                </div>

                {(() => {
                  const basisItems = expenses
                    .map((e) => {
                      const isShared = e.splitMode === 'shared';
                      const splitPeople = isShared
                        ? (e.splitWith?.filter((x) => people.includes(x)) ?? people)
                        : [];
                      const n = isShared
                        ? Math.max(splitPeople.length || Math.max(people.length, 1), 1)
                        : 1;
                      const myShare = !isShared
                        ? e.payer === selected
                          ? e.amountLocal
                          : 0
                        : splitPeople.includes(selected)
                          ? e.amountLocal / n
                          : 0;

                      return { e, myShare, splitPeople, n, isShared };
                    })
                    .filter((x) => x.myShare > 0);
                  const basisTotalLocal = basisItems.reduce((acc, x) => acc + x.myShare, 0);
                  const basisTotalKRW = basisTotalLocal * journey.rate;

                  return (
                    <>
                      {/* 사람별 총 부담 요약 */}
                      <div className="mt-4 flex items-center justify-between gap-3 rounded-2xl border border-blue-100 bg-blue-50/60 px-4 py-4">
                        <div className="min-w-0">
                          <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">
                            <span className="text-blue-600">{selected}</span> 총 부담
                          </p>
                          <p className="mt-0.5 text-[10px] font-bold text-slate-400">
                            영수증 {basisItems.length}건 합계
                          </p>
                        </div>
                        <div className="shrink-0 whitespace-nowrap text-right">
                          <p className="text-lg font-black tracking-tight text-blue-600">
                            {formatLocal(basisTotalLocal)}{' '}
                            <span className="text-[11px] font-bold text-slate-400">
                              {journey.currency}
                            </span>
                          </p>
                          <p className="mt-0.5 text-[10px] font-bold text-slate-400">
                            약 {formatKRW(basisTotalKRW)}원
                          </p>
                        </div>
                      </div>

                      <div className="mt-3 space-y-2">
                        {expenses.length === 0 ? (
                          <p className="text-[11px] font-bold text-slate-500">
                            아직 저장된 영수증이 없어요.
                          </p>
                        ) : basisItems.length === 0 ? (
                          <p className="rounded-2xl border border-slate-100 bg-white px-4 py-6 text-center text-[11px] font-bold text-slate-400">
                            {selected} 님이 부담하는 영수증이 없어요.
                          </p>
                        ) : (
                          basisItems.map(({ e, myShare, splitPeople, n, isShared }) => (
                            <div
                              key={e.id}
                              className="flex items-start justify-between gap-3 rounded-2xl border border-slate-100 bg-white px-4 py-3"
                            >
                              <div className="min-w-0 flex-1">
                                <p className="truncate text-sm font-black text-slate-900">
                                  {e.emoji} {e.storeName}
                                </p>
                                <p className="mt-1 text-[10px] font-bold text-slate-400">
                                  {dateKeyOf(e.paidAt)} {timeLabelOf(e.paidAt)}
                                </p>
                                <p className="mt-0.5 text-[10px] font-bold text-slate-400">
                                  결제자 {e.payer} ·{' '}
                                  {(e.method ?? 'card') === 'cash' ? '현금' : '카드'} ·{' '}
                                  {isShared ? `공동 (${splitPeople.join(', ')}) 1/${n}` : '개인'}
                                </p>
                                <p className="mt-1 text-[10px] font-black text-blue-600">
                                  {selected} 반영: {formatLocal(myShare)} {journey.currency}
                                </p>
                              </div>
                              <div className="shrink-0 whitespace-nowrap text-right">
                                <p className="text-sm font-black text-slate-900">
                                  {formatLocal(e.amountLocal)}{' '}
                                  <span className="text-[10px] font-bold text-slate-400">
                                    {journey.currency}
                                  </span>
                                </p>
                                <p className="text-[10px] font-bold text-slate-300">
                                  약 {formatKRW(e.amountLocal * journey.rate)}원
                                </p>
                              </div>
                            </div>
                          ))
                        )}
                      </div>
                    </>
                  );
                })()}
              </div>
            ) : null}
          </section>
        </div>

        <button
          type="button"
          onClick={handleCapture}
          disabled={isCapturing}
          className="mt-2 w-full cursor-pointer rounded-2xl bg-slate-900 py-4 text-sm font-black text-white active:scale-[0.99] disabled:cursor-not-allowed disabled:opacity-60"
        >
          {isCapturing ? '이미지 만드는 중…' : '리포트 이미지로 공유하기'}
        </button>

        <button
          type="button"
          onClick={() => nav(`/journeys/${journey.id}`)}
          className="mt-3 w-full cursor-pointer py-3 text-sm font-black text-slate-400"
        >
          타임라인으로 돌아가기
        </button>
      </main>
    </div>
  );
}

/**
 * ReportPage 로딩 중 스켈레톤.
 * - 다크 hero 카드 + 3-card 그리드 + 송금 루트 row + 정산 기준 카드 모사
 */
function ReportSkeleton() {
  return (
    <div className="min-h-dvh bg-white">
      {/* TopBar 스켈레톤 */}
      <header className="sticky top-0 z-20 border-b border-slate-100 bg-white/90 backdrop-blur">
        <div className="flex items-center gap-3 px-6 pb-5 pt-12">
          <div className="size-7 animate-pulse rounded-xl bg-slate-100" />
          <div className="h-4 w-32 animate-pulse rounded-lg bg-slate-100" />
        </div>
      </header>

      <main className="space-y-5 px-6 pb-10 pt-4">
        {/* 다크 hero 스켈레톤 */}
        <section className="animate-pulse rounded-[32px] bg-slate-900/10 p-7">
          <div className="mb-5 space-y-2">
            <div className="h-5 w-44 rounded-lg bg-slate-200" />
            <div className="h-3 w-36 rounded-lg bg-slate-200" />
          </div>
          <div className="mt-7 space-y-3">
            <div className="h-3 w-32 rounded-lg bg-slate-200" />
            <div className="h-12 w-48 rounded-xl bg-slate-200" />
            <div className="h-3 w-40 rounded-lg bg-slate-200" />
          </div>
          <div className="mt-7 space-y-2">
            <div className="h-3 w-28 rounded-lg bg-slate-200" />
            <div className="flex gap-1.5">
              <div className="h-6 w-12 rounded-full bg-slate-200" />
              <div className="h-6 w-12 rounded-full bg-slate-200" />
              <div className="h-6 w-12 rounded-full bg-slate-200" />
            </div>
          </div>
        </section>

        {/* 3-card 그리드 스켈레톤 */}
        <section className="grid grid-cols-3 gap-2">
          {[1, 2, 3].map((i) => (
            <div
              key={i}
              className="animate-pulse rounded-2xl border border-slate-100 bg-slate-50 p-4"
            >
              <div className="mb-2 h-3 w-12 rounded bg-slate-200" />
              <div className="mb-1 h-5 w-16 rounded bg-slate-200" />
              <div className="h-3 w-14 rounded bg-slate-100" />
            </div>
          ))}
        </section>

        {/* 송금 루트 스켈레톤 */}
        <section>
          <div className="mb-3 flex items-center justify-between px-1">
            <div className="h-3 w-16 animate-pulse rounded bg-slate-200" />
            <div className="h-3 w-12 animate-pulse rounded bg-slate-100" />
          </div>
          <div className="space-y-2">
            {[1, 2].map((i) => (
              <div
                key={i}
                className="flex items-center justify-between rounded-2xl border border-slate-100 bg-slate-50 px-4 py-3"
              >
                <div className="flex items-center gap-2">
                  <div className="h-5 w-10 animate-pulse rounded-md bg-slate-200" />
                  <div className="size-3 animate-pulse rounded bg-slate-200" />
                  <div className="h-5 w-10 animate-pulse rounded-md bg-slate-200" />
                </div>
                <div className="space-y-1.5">
                  <div className="ml-auto h-4 w-16 animate-pulse rounded bg-slate-200" />
                  <div className="ml-auto h-3 w-12 animate-pulse rounded bg-slate-100" />
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* 정산 기준 카드 스켈레톤 */}
        <section className="rounded-2xl border border-slate-100 bg-slate-50 p-5">
          <div className="space-y-2">
            <div className="h-3 w-24 animate-pulse rounded bg-slate-200" />
            <div className="h-4 w-44 animate-pulse rounded bg-slate-200" />
          </div>
        </section>
      </main>
    </div>
  );
}
