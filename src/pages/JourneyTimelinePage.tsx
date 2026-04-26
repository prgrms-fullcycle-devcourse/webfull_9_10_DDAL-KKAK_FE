import { BarChart3, Camera, Clock, Edit2, Pencil, User as UserIcon } from 'lucide-react';
import { useMemo, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { Fab, FabStack } from '@/components/layout/Fab';
import { TopBar } from '@/components/layout/TopBar';
import { useExpensesQuery } from '@/features/expenses/queries';
import { useJourneyQuery } from '@/features/journeys/queries';
import {
  expenseMyShareLocal,
  sumMySpendKRW,
  sumMySpendLocal,
  sumTotalKRW,
} from '@/features/settlement/calc';
import { dateKeyOf, timeLabelOf } from '@/lib/datetime';
import { formatKRW, formatLocal } from '@/lib/money';

/** 'YYYY-MM-DD' wall-clock 기준 일차 계산 (1일차부터). */
function dayNumberFromStart(startDateKey: string, dateKey: string): number {
  const start = new Date(`${startDateKey}T00:00:00Z`).getTime();
  const cur = new Date(`${dateKey}T00:00:00Z`).getTime();
  if (Number.isNaN(start) || Number.isNaN(cur)) return 1;
  return Math.max(1, Math.floor((cur - start) / 86_400_000) + 1);
}

export function JourneyTimelinePage() {
  const nav = useNavigate();
  const { journeyId } = useParams();

  const { data: journey } = useJourneyQuery(journeyId);
  const { data: expenses = [] } = useExpensesQuery(journeyId);

  const grouped = useMemo(() => {
    const by: Record<string, typeof expenses> = {};
    for (const e of expenses) {
      const key = dateKeyOf(e.paidAt);
      (by[key] ??= []).push(e);
    }
    return Object.entries(by)
      .sort(([a], [b]) => (a < b ? 1 : -1))
      .map(([date, items]) => ({
        date,
        items: [...items].sort((a, b) => (a.paidAt < b.paidAt ? 1 : -1)),
      }));
  }, [expenses]);

  const allDates = useMemo(() => {
    if (!journey) return [];
    const dates: string[] = [];
    const cur = new Date(`${journey.startDate}T00:00:00Z`);
    const end = new Date(`${journey.endDate}T00:00:00Z`);
    while (cur <= end) {
      dates.push(cur.toISOString().slice(0, 10));
      cur.setUTCDate(cur.getUTCDate() + 1);
    }
    return dates;
  }, [journey]);

  const [selectedDate, setSelectedDate] = useState<string | null>(null);

  const filterScrollRef = useRef<HTMLDivElement>(null);
  const isDragging = useRef(false);
  const dragStartX = useRef(0);
  const dragScrollLeft = useRef(0);

  const handleMouseDown = (e: React.MouseEvent) => {
    isDragging.current = true;
    dragStartX.current = e.pageX - (filterScrollRef.current?.offsetLeft ?? 0);
    dragScrollLeft.current = filterScrollRef.current?.scrollLeft ?? 0;
  };
  const handleMouseMove = (e: React.MouseEvent) => {
    if (!isDragging.current || !filterScrollRef.current) return;
    e.preventDefault();
    const x = e.pageX - filterScrollRef.current.offsetLeft;
    filterScrollRef.current.scrollLeft = dragScrollLeft.current - (x - dragStartX.current);
  };
  const handleMouseUp = () => {
    isDragging.current = false;
  };

  const filteredGrouped = useMemo(
    () => (selectedDate ? grouped.filter(({ date }) => date === selectedDate) : grouped),
    [grouped, selectedDate],
  );

  if (!journey) return null;

  const totalKRW = sumTotalKRW(journey, expenses);
  const mySpendLocal = sumMySpendLocal(journey, expenses);
  const mySpendKRW = sumMySpendKRW(journey, expenses);

  const tripDateRange = `${journey.startDate.replaceAll('-', '.')} ~ ${journey.endDate.replaceAll('-', '.')}`;

  const statusBadge = {
    active: { label: '여행 중', className: 'bg-green-100 text-green-600' },
    planned: { label: '예정', className: 'bg-blue-100 text-blue-600' },
    ended: { label: '종료', className: 'bg-slate-100 text-slate-400' },
  }[journey.status];

  return (
    <div className="relative min-h-dvh bg-white pb-20">
      <TopBar
        title={
          <span className="flex items-center gap-2">
            {journey.name}
            <span
              className={`rounded-full px-2 py-0.5 text-[10px] font-black tracking-tight ${statusBadge.className}`}
            >
              {statusBadge.label}
            </span>
          </span>
        }
        subtitle={tripDateRange}
        backTo="/"
        right={
          <div className="flex items-center gap-1">
            <button
              type="button"
              onClick={() => nav(`/journeys/${journey.id}/edit`)}
              className="rounded-xl bg-slate-50 p-2.5 text-slate-400 active:scale-95"
              aria-label="예산·여정 수정"
            >
              <Edit2 className="size-5" />
            </button>
            <button
              type="button"
              onClick={() => nav(`/journeys/${journey.id}/insight`)}
              className="rounded-xl bg-slate-50 p-2.5 text-slate-400 active:scale-95"
              aria-label="AI 소비 성향 리포트 보기"
            >
              <BarChart3 className="size-5" />
            </button>
          </div>
        }
      />

      <main className="space-y-10 px-6 py-8">
        <section className="rounded-[32px] bg-slate-900 p-6 text-white shadow-xl">
          {/* 헤더 */}
          <div className="mb-6 flex items-center justify-between">
            <div className="flex items-center gap-1.5 text-[10px] font-black uppercase tracking-widest text-white/50">
              <span aria-hidden>👥</span>
              <span>실시간 정산 현황</span>
            </div>
            <button
              type="button"
              onClick={() => nav(`/journeys/${journey.id}/report`)}
              className="cursor-pointer rounded-full bg-white/10 px-3 py-1 text-[10px] font-black uppercase tracking-tighter active:scale-95"
            >
              결산표 보기
            </button>
          </div>

          {/* 메인: 내 총 지출 */}
          <div>
            <p className="text-[10px] font-black uppercase tracking-widest text-white/50">
              내 총 지출
            </p>
            <div className="mt-2 flex items-baseline gap-2">
              <h3 className="text-4xl font-black tracking-tight text-white">
                {formatKRW(mySpendKRW)}
              </h3>
              <span className="text-lg font-bold text-white/70">KRW</span>
            </div>
            <p className="mt-1 text-[10px] font-bold text-white/40">
              ≈ {formatLocal(mySpendLocal)} {journey.currency}
            </p>
          </div>

          {/* 예산 캐릭터 */}
          {journey.budgetKRW != null &&
            (() => {
              const ratio = mySpendKRW / journey.budgetKRW;
              const character =
                ratio >= 1
                  ? {
                      emoji: '🔥',
                      message: '예산 범위를 벗어났어요!! 망함.',
                      bubble: 'bg-red-500/30 text-red-200',
                    }
                  : ratio >= 0.8
                    ? {
                        emoji: '😰',
                        message: '지출 속도가 다소 빨라요. 지금부터는 신중을 기해주세요!',
                        bubble: 'bg-orange-500/30 text-orange-200',
                      }
                    : ratio >= 0.5
                      ? {
                          emoji: '🤔',
                          message: '정확히 절반을 사용하셨네요. 남은 일정도 계획대로 부탁드려요!',
                          bubble: 'bg-yellow-500/20 text-yellow-200',
                        }
                      : {
                          emoji: '😄',
                          message: '편안한 마음으로 지출을 이어가셔도 좋겠어요!',
                          bubble: 'bg-green-500/20 text-green-200',
                        };
              return (
                <div className="mt-5 flex items-center gap-3">
                  <span className="text-4xl">{character.emoji}</span>
                  <div className="flex-1">
                    <div
                      className={`relative rounded-2xl rounded-tl-none px-3.5 py-2.5 ${character.bubble}`}
                    >
                      <p className="text-[11px] font-black leading-snug">{character.message}</p>
                      <p className="mt-0.5 text-[10px] font-bold opacity-70">
                        예산 {formatKRW(journey.budgetKRW)}원 중 {Math.round(ratio * 100)}% 사용
                      </p>
                    </div>
                  </div>
                </div>
              );
            })()}

          {/* 하단 보조 정보 */}
          <div className="mt-5 border-t border-white/10 pt-4">
            <div className="flex items-center justify-between text-[11px] font-bold">
              <span className="text-white/40">영수증 합계</span>
              <span>
                <span className="text-white/70">{formatKRW(totalKRW)}원</span>
                <span className="ml-1 text-[10px] font-bold text-white/30">
                  (약 {formatLocal(totalKRW / journey.rate)} {journey.currency})
                </span>
              </span>
            </div>
          </div>
        </section>

        {/* 일차 필터 버튼 */}
        {allDates.length > 0 && (
          <div
            ref={filterScrollRef}
            className="-mx-6 flex gap-2 overflow-x-auto px-6 pb-1 [&::-webkit-scrollbar]:hidden [scrollbar-width:none] cursor-grab active:cursor-grabbing select-none"
            onMouseDown={handleMouseDown}
            onMouseMove={handleMouseMove}
            onMouseUp={handleMouseUp}
            onMouseLeave={handleMouseUp}
          >
            <button
              type="button"
              onClick={() => setSelectedDate(null)}
              className={`shrink-0 rounded-full px-4 py-2 text-[11px] font-black tracking-tight transition active:scale-95 ${
                selectedDate === null ? 'bg-slate-900 text-white' : 'bg-slate-100 text-slate-500'
              }`}
            >
              전체
            </button>
            {allDates.map((date) => {
              const dayN = dayNumberFromStart(journey.startDate, date);
              return (
                <button
                  key={date}
                  type="button"
                  onClick={() => setSelectedDate(date)}
                  className={`shrink-0 rounded-full px-4 py-2 text-[11px] font-black tracking-tight transition active:scale-95 ${
                    selectedDate === date
                      ? 'bg-slate-900 text-white'
                      : 'bg-slate-100 text-slate-500'
                  }`}
                >
                  {dayN}일차
                </button>
              );
            })}
          </div>
        )}

        <section className="space-y-12">
          {filteredGrouped.length === 0 && (
            <div className="flex flex-col items-center gap-4 py-20 text-center">
              <span className="text-5xl">🧾</span>
              <div>
                <p className="text-base font-black text-slate-900">아직 기록된 지출이 없어요</p>
                <p className="mt-1 text-[13px] font-bold text-slate-400">
                  영수증을 스캔하거나 직접 입력해보세요
                </p>
              </div>
            </div>
          )}
          {filteredGrouped.map(({ date, items }) => {
            const dayN = dayNumberFromStart(journey.startDate, date);
            return (
              <div key={date}>
                <div className="mb-8 flex items-center gap-3">
                  <span className="rounded-lg bg-slate-100 px-2.5 py-1 text-[11px] font-black tracking-tight text-slate-900">
                    {dayN}일차
                  </span>
                  <span className="text-[11px] font-bold tracking-tight text-slate-400">
                    {date.replaceAll('-', '.')}
                  </span>
                  <div className="h-px flex-1 bg-slate-100" />
                </div>

                <div className="space-y-10">
                  {items.map((e) => {
                    const myShare = expenseMyShareLocal(journey, e);
                    const isShared = e.splitMode === 'shared';
                    const splitN = isShared
                      ? Math.max(e.splitWith?.length ?? journey.participants.length, 1)
                      : null;
                    return (
                      <div
                        key={e.id}
                        onClick={() => nav(`/journeys/${journey.id}/expenses/${e.id}/edit`)}
                        className="group -mx-2 cursor-pointer rounded-2xl px-2 py-2 transition active:bg-slate-50"
                      >
                        <div className="mb-2 flex items-start justify-between">
                          <div className="flex items-center gap-3">
                            <span className="text-3xl drop-shadow-sm">{e.emoji}</span>
                            <div>
                              <div className="mb-1 flex items-center gap-2">
                                <h4 className="text-base font-black leading-none text-slate-900">
                                  {e.storeName}
                                </h4>
                                <span
                                  className={`rounded px-1.5 py-0.5 text-[8px] font-black tracking-tighter ${isShared ? 'bg-orange-100 text-orange-600' : 'bg-slate-100 text-slate-500'}`}
                                >
                                  {isShared
                                    ? `공동${splitN != null ? ` · ${splitN}명 1/n` : ''}`
                                    : '개인'}
                                </span>
                                <span className="rounded bg-slate-50 px-1.5 py-0.5 text-[8px] font-black tracking-tighter text-slate-400">
                                  {(e.method ?? 'card') === 'cash' ? '현금' : '카드'}
                                </span>
                              </div>
                              <p className="flex items-center text-[10px] font-bold uppercase tracking-tighter text-slate-300">
                                <Clock className="mr-1 size-3" /> {timeLabelOf(e.paidAt)} •{' '}
                                <UserIcon className="mx-1 size-3" /> 결제자: {e.payer}
                              </p>
                            </div>
                          </div>
                          <div className="text-right">
                            <p className="text-lg font-black leading-none tracking-tight text-slate-900">
                              {formatLocal(e.amountLocal)}
                              <span className="ml-0.5 text-xs font-bold">{journey.currency}</span>
                            </p>
                            <p className="mt-1 text-[10px] font-bold tracking-tighter text-slate-300">
                              약 {formatKRW(e.amountLocal * journey.rate)}원
                            </p>
                            {isShared ? (
                              <p className="mt-1 text-[10px] font-bold tracking-tighter text-blue-500">
                                🏷️ {formatLocal(myShare)} {journey.currency}
                                <span className="ml-1 text-slate-400">
                                  (약 {formatKRW(myShare * journey.rate)}원)
                                </span>
                              </p>
                            ) : null}
                          </div>
                        </div>

                        {e.comment ? (
                          <div className="ml-11 rounded-2xl border-l-4 border-blue-100 bg-slate-50 px-4 py-3">
                            <p className="text-sm font-medium leading-relaxed tracking-tight text-slate-500">
                              "{e.comment}"
                            </p>
                          </div>
                        ) : null}
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </section>
      </main>

      <FabStack>
        <Fab
          variant="secondary"
          label="수기 입력"
          onClick={() => nav(`/journeys/${journey.id}/expenses/new`)}
        >
          <Pencil className="size-5" />
        </Fab>
        <Fab label="영수증 스캔" onClick={() => nav(`/journeys/${journey.id}/scan`)}>
          <Camera className="size-8" />
        </Fab>
      </FabStack>
    </div>
  );
}
