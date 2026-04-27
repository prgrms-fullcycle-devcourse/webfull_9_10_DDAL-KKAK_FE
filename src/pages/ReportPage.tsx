import html2canvas from 'html2canvas';
import { ArrowRight } from 'lucide-react';
import { useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { TopBar } from '@/components/layout/TopBar';
import { useExpensesQuery } from '@/features/expenses/queries';
import { useJourneyQuery } from '@/features/journeys/queries';
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

  if (!journey) return null;

  const data = calcSettlement(journey, expenses);
  const people = journey.participants.length ? journey.participants : ['나'];
  const selfName = ledgerSelfName(journey);
  const selected = basisPerson ?? people[0];

  const totalLocal = sumTotalLocal(expenses);
  const totalKRW = totalLocal * journey.rate;
  const mySpendLocal = sumMySpendLocal(journey, expenses);
  const mySpendKRW = sumMySpendKRW(journey, expenses);

  const toMe = data.transfers.filter((t) => t.to === selfName);
  const fromMe = data.transfers.filter((t) => t.from === selfName);
  const toMeTotal = toMe.reduce((a, t) => a + t.amountLocal, 0);
  const fromMeTotal = fromMe.reduce((a, t) => a + t.amountLocal, 0);

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
                toMeTotal > 0 ? 'border-blue-100 bg-blue-50' : 'border-slate-100 bg-slate-50'
              }`}
            >
              <p
                className={`text-[10px] font-black uppercase tracking-tighter ${
                  toMeTotal > 0 ? 'text-blue-600' : 'text-slate-400'
                }`}
              >
                받을 돈
              </p>
              <p
                className={`mt-2 text-base font-black tracking-tight ${
                  toMeTotal > 0 ? 'text-blue-600' : 'text-slate-300'
                }`}
              >
                {formatKRW(toMeTotal * journey.rate)}
                <span className="ml-0.5 text-[10px] font-bold opacity-70">원</span>
              </p>
              <p
                className={`mt-0.5 text-[10px] font-bold ${
                  toMeTotal > 0 ? 'text-blue-400' : 'text-slate-300'
                }`}
              >
                {formatLocal(toMeTotal)} {journey.currency}
              </p>
            </div>

            <div
              className={`rounded-2xl border p-4 ${
                fromMeTotal > 0
                  ? 'border-[#FFD0D0] bg-[#FFF5F5]'
                  : 'border-slate-100 bg-slate-50'
              }`}
            >
              <p
                className={`text-[10px] font-black uppercase tracking-tighter ${
                  fromMeTotal > 0 ? 'text-[#FF4D4D]' : 'text-slate-400'
                }`}
              >
                줄 돈
              </p>
              <p
                className={`mt-2 text-base font-black tracking-tight ${
                  fromMeTotal > 0 ? 'text-[#FF4D4D]' : 'text-slate-300'
                }`}
              >
                {formatKRW(fromMeTotal * journey.rate)}
                <span className="ml-0.5 text-[10px] font-bold opacity-70">원</span>
              </p>
              <p
                className={`mt-0.5 text-[10px] font-bold ${
                  fromMeTotal > 0 ? 'text-[#FF8888]' : 'text-slate-300'
                }`}
              >
                {formatLocal(fromMeTotal)} {journey.currency}
              </p>
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
                  const krw = Math.round(t.amountLocal * journey.rate);
                  const fromIsMe = t.from === selfName;
                  const toIsMe = t.to === selfName;
                  return (
                    <div
                      key={`${t.from}->${t.to}-${t.amountLocal}`}
                      className="flex items-center justify-between rounded-2xl border border-slate-100 bg-slate-50 px-4 py-3"
                    >
                      <div className="flex items-center gap-2 text-[12px] font-black tracking-tight">
                        <span
                          className={`rounded-md px-2 py-0.5 text-[10px] font-black ${
                            fromIsMe ? 'bg-[#FF4D4D] text-white' : 'bg-white text-slate-700'
                          }`}
                        >
                          {t.from}
                        </span>
                        <ArrowRight className="size-3 text-slate-400" />
                        <span
                          className={`rounded-md px-2 py-0.5 text-[10px] font-black ${
                            toIsMe ? 'bg-blue-500 text-white' : 'bg-white text-slate-700'
                          }`}
                        >
                          {t.to}
                        </span>
                      </div>
                      <div className="text-right">
                        <p className="text-sm font-black tracking-tight text-slate-900">
                          {formatKRW(krw)}
                          <span className="ml-0.5 text-[10px] font-bold text-slate-400">원</span>
                        </p>
                        <p className="text-[10px] font-bold text-slate-400">
                          {formatLocal(t.amountLocal)} {journey.currency}
                        </p>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}

            {settleTone !== 'none' ? (
              <p className="mt-4 text-center text-[10px] font-bold text-slate-400">
                {settleTone === 'credit'
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
                                  {isShared
                                    ? `공동 (${splitPeople.join(', ')}) 1/${n}`
                                    : '개인'}
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
