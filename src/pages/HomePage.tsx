import { Camera, Plus, User } from 'lucide-react';
import { useMemo } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { BottomNav } from '@/components/layout/BottomNav';
import { Fab, FabStack } from '@/components/layout/Fab';
import { getElapsedDays, getJourneyPhase, getTripDays, getTripStatusLabel } from '@/lib/dates';
import { formatKRW, formatLocal } from '@/lib/money';
import type { Journey } from '@/features/journeys/types';
import type { Expense } from '@/features/expenses/types';
import { useAllExpensesQuery } from '@/features/expenses/queries';
import { useJourneysQuery } from '@/features/journeys/queries';
import { calcSettlement, ledgerSelfName, sumMySpendKRW } from '@/features/settlement/calc';

/**
 * 데이터 로딩 중 스켈레톤.
 * - 진행중 큰 카드 1개 + 콤팩트 row 2개 패턴 (가장 흔한 화면 구성을 모사)
 * - animate-pulse로 깜빡거리는 효과
 * - layout shift 없이 데이터 들어왔을 때 자연스럽게 교체
 */
function HomeSkeleton() {
  return (
    <div className="space-y-10">
      {/* 진행 중 섹션 헤더 */}
      <section>
        <div className="mb-3 space-y-2">
          <div className="h-4 w-20 animate-pulse rounded bg-slate-200" />
          <div className="h-3 w-40 animate-pulse rounded bg-slate-100" />
        </div>
        {/* 큰 카드 스켈레톤 */}
        <div className="rounded-[32px] border border-slate-100 bg-white p-5">
          <div className="mb-4 flex items-center gap-2">
            <div className="h-4 w-12 animate-pulse rounded bg-slate-200" />
            <div className="h-4 w-14 animate-pulse rounded bg-slate-100" />
          </div>
          <div className="mb-2 h-6 w-40 animate-pulse rounded bg-slate-200" />
          <div className="mb-6 h-3 w-48 animate-pulse rounded bg-slate-100" />
          <div className="rounded-2xl border border-slate-100 bg-slate-50 p-4">
            <div className="mb-2 h-3 w-16 animate-pulse rounded bg-slate-200" />
            <div className="mb-1 h-7 w-32 animate-pulse rounded bg-slate-200" />
            <div className="h-2 w-full animate-pulse rounded-full bg-slate-100" />
          </div>
        </div>
      </section>

      {/* 다가오는 여행 섹션 헤더 + 콤팩트 row */}
      <section>
        <div className="mb-3 space-y-2">
          <div className="h-4 w-24 animate-pulse rounded bg-slate-200" />
          <div className="h-3 w-44 animate-pulse rounded bg-slate-100" />
        </div>
        <div className="space-y-3">
          {[1, 2].map((i) => (
            <div
              key={i}
              className="flex items-center gap-3 rounded-2xl border border-slate-100 bg-white p-4"
            >
              <div className="size-12 shrink-0 animate-pulse rounded-xl bg-slate-100" />
              <div className="min-w-0 flex-1 space-y-2">
                <div className="h-4 w-32 animate-pulse rounded bg-slate-200" />
                <div className="h-3 w-40 animate-pulse rounded bg-slate-100" />
              </div>
              <div className="shrink-0 space-y-1.5">
                <div className="ml-auto h-4 w-12 animate-pulse rounded bg-slate-200" />
                <div className="ml-auto h-3 w-16 animate-pulse rounded bg-slate-100" />
              </div>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}

/**
 * 여행이 0개일 때 보여주는 환영 화면.
 * - 우리 로고 일러스트 (PWA 자산 재활용)
 * - 행동 유도 카피 + 큰 CTA 버튼
 * - 첫 진입 시 "뭘 해야 하지?" 막막함 제거
 */
function EmptyHomeState() {
  return (
    <div className="flex flex-col items-center px-2 pt-4 pb-12 text-center">
      <img
        src="/icons/icon-512.png"
        alt=""
        aria-hidden
        draggable={false}
        className="mb-7 size-32 select-none drop-shadow-md"
      />
      <h2 className="text-xl font-black tracking-tight text-slate-900">
        첫 여행을 시작해볼까요?
      </h2>
      <p className="mt-3 text-xs font-bold leading-relaxed text-slate-400">
        여행을 만들고 영수증만 찍으면
        <br />
        지출, 정산, 환산까지 자동으로 기록해드릴게요.
      </p>
      <Link
        to="/journeys/new"
        className="mt-9 flex items-center gap-1.5 rounded-2xl bg-blue-600 px-7 py-4 text-sm font-black text-white shadow-xl shadow-blue-200 active:scale-95"
      >
        <Plus className="size-5" />새 여행 만들기
      </Link>
      <p className="mt-6 text-[10px] font-bold tracking-tight text-slate-300">
        나라·기간·예산만 정하면 1분이면 돼요
      </p>
    </div>
  );
}

/** 나라 이름 → 국기 이모지 (썸네일용) */
function countryEmoji(country: string): string {
  switch (country) {
    case '일본':
      return '🇯🇵';
    case '미국':
      return '🇺🇸';
    case '유럽':
      return '🇪🇺';
    case '한국':
      return '🇰🇷';
    default:
      return '🗺️';
  }
}

/** "2025-07-10" + "2025-07-17" → "2025.07.10 - 17" (같은 달이면 일자만 축약) */
function formatCompactDateRange(start: string, end: string): string {
  const [sy, sm, sd] = start.split('-');
  const [ey, em, ed] = end.split('-');
  if (sy === ey && sm === em) return `${sy}.${sm}.${sd} - ${ed}`;
  if (sy === ey) return `${sy}.${sm}.${sd} - ${em}.${ed}`;
  return `${sy}.${sm}.${sd} - ${ey}.${em}.${ed}`;
}

/** 멤버 표기: 3명 이하면 전부 나열, 그 이상이면 "X 외 N명" */
function formatMembers(participants: string[]): string {
  if (participants.length === 0) return '나';
  if (participants.length <= 3) return participants.join(', ');
  return `${participants[0]} 외 ${participants.length - 1}명`;
}

function CompactJourneyRow({
  j,
  expenses,
  onClick,
}: {
  j: Journey;
  expenses: Expense[];
  onClick: () => void;
}) {
  const phase = getJourneyPhase(j.startDate, j.endDate);
  const status = getTripStatusLabel(j.startDate, j.endDate);
  const tripExpenses = expenses.filter((e) => e.journeyId === j.id);
  const spentKRW = sumMySpendKRW(j, tripExpenses);
  const tripDays = getTripDays(j.startDate, j.endDate);

  const hasBudget = typeof j.budgetKRW === 'number' && j.budgetKRW > 0;

  // 정산 요약: 미정산 transfer 기준으로 동적 계산
  // 결산표에서 송금 완료 체크할 때마다 실시간 반영
  const myName = ledgerSelfName(j);
  const { transfers } = calcSettlement(j, tripExpenses);
  const settledKeys = new Set(j.settledTransferKeys ?? []);
  const isSettled = (t: { from: string; to: string; amountLocal: number }) =>
    settledKeys.has(`${t.from}->${t.to}-${t.amountLocal}`);

  const unsettledToMe = transfers
    .filter((t) => t.to === myName && !isSettled(t))
    .reduce((acc, t) => acc + t.amountLocal, 0);
  const unsettledFromMe = transfers
    .filter((t) => t.from === myName && !isSettled(t))
    .reduce((acc, t) => acc + t.amountLocal, 0);
  const remainingNetLocal = unsettledToMe - unsettledFromMe;
  const myNetKRW = Math.round(remainingNetLocal * j.rate);

  const settleTone: 'credit' | 'debit' | 'none' =
    myNetKRW > 0 ? 'credit' : myNetKRW < 0 ? 'debit' : 'none';
  const settleLabel =
    settleTone === 'credit'
      ? `받을 돈 ${formatKRW(Math.abs(myNetKRW))}원`
      : settleTone === 'debit'
        ? `보낼 돈 ${formatKRW(Math.abs(myNetKRW))}원`
        : '정산 완료';
  const settleColor =
    settleTone === 'credit'
      ? 'text-blue-600'
      : settleTone === 'debit'
        ? 'text-[#FF4D4D]'
        : 'text-slate-400';

  return (
    <button
      type="button"
      onClick={onClick}
      className="flex w-full cursor-pointer items-center gap-3 rounded-2xl border border-slate-100 bg-white p-4 text-left active:scale-[0.99]"
    >
      {/* 썸네일 (국기) */}
      <div className="grid size-12 shrink-0 place-items-center rounded-xl bg-slate-50 text-2xl">
        {countryEmoji(j.country)}
      </div>

      {/* 가운데: 이름 + 메타 */}
      <div className="min-w-0 flex-1">
        <h4 className="truncate text-sm font-black tracking-tight text-slate-900">{j.name}</h4>
        <p className="mt-0.5 truncate text-[10px] font-bold text-slate-400">
          {formatCompactDateRange(j.startDate, j.endDate)} · {formatMembers(j.participants)}
        </p>
      </div>

      {/* 오른쪽: 단계별 정보 */}
      <div className="shrink-0 text-right">
        {phase === 'past' ? (
          <>
            <p className="text-sm font-black text-slate-900">{formatKRW(spentKRW)}원</p>
            <p className={`mt-0.5 text-[10px] font-black ${settleColor}`}>{settleLabel}</p>
          </>
        ) : (
          <>
            <p className="text-sm font-black text-blue-600">{status.label}</p>
            <p className="mt-0.5 text-[10px] font-bold text-slate-400">
              {hasBudget
                ? `예산 ${formatKRW(j.budgetKRW as number)}원`
                : `${tripDays}일 · ${j.participants.length}명`}
            </p>
          </>
        )}
      </div>
    </button>
  );
}

function JourneyCard({
  j,
  expenses,
  onClick,
}: {
  j: Journey;
  expenses: Expense[];
  onClick: () => void;
}) {
  const status = getTripStatusLabel(j.startDate, j.endDate);
  const phase = getJourneyPhase(j.startDate, j.endDate);
  const tripExpenses = expenses.filter((e) => e.journeyId === j.id);
  const spentKRW = sumMySpendKRW(j, tripExpenses);

  const hasBudget = typeof j.budgetKRW === 'number' && j.budgetKRW > 0;
  const budgetKRW = hasBudget ? (j.budgetKRW as number) : 0;
  const tripDays = getTripDays(j.startDate, j.endDate);
  const elapsedDays = getElapsedDays(j.startDate, j.endDate);
  const expenseCount = tripExpenses.length;

  const insight = (() => {
    if (phase === 'ongoing') {
      const days = Math.max(elapsedDays, 1);
      const avg = Math.round(spentKRW / days);
      return expenseCount === 0
        ? '아직 기록된 지출이 없어요'
        : `일평균 ${formatKRW(avg)}원 사용 중`;
    }
    if (phase === 'upcoming') {
      if (hasBudget) {
        const perDay = Math.round(budgetKRW / tripDays);
        return `하루 ${formatKRW(perDay)}원 예산`;
      }
      return `${tripDays}일 일정 · ${j.participants.length}명`;
    }
    // past
    if (expenseCount === 0) return '기록된 지출이 없어요';
    const avg = Math.round(spentKRW / tripDays);
    return `지출 ${expenseCount}건 · 일평균 ${formatKRW(avg)}원`;
  })();
  const isOver = hasBudget && spentKRW > budgetKRW;
  const remainKRW = Math.max(budgetKRW - spentKRW, 0);
  const overKRW = Math.max(spentKRW - budgetKRW, 0);
  const usedRatio = hasBudget ? Math.min(Math.round((spentKRW / budgetKRW) * 100), 999) : 0;
  const progressPct = hasBudget ? Math.min(usedRatio, 100) : 0;

  // 정산 요약: 미정산 transfer 기준으로 동적 계산 (결산표 체크와 실시간 연동)
  // 모두 완료되면 자연스럽게 net = 0 → 정산 완료
  const myName = ledgerSelfName(j);
  const { transfers } = calcSettlement(j, tripExpenses);
  const settledKeys = new Set(j.settledTransferKeys ?? []);
  const isSettled = (t: { from: string; to: string; amountLocal: number }) =>
    settledKeys.has(`${t.from}->${t.to}-${t.amountLocal}`);
  const unsettledToMe = transfers
    .filter((t) => t.to === myName && !isSettled(t))
    .reduce((acc, t) => acc + t.amountLocal, 0);
  const unsettledFromMe = transfers
    .filter((t) => t.from === myName && !isSettled(t))
    .reduce((acc, t) => acc + t.amountLocal, 0);
  const remainingNetLocal = unsettledToMe - unsettledFromMe;
  const myNetKRW = Math.round(remainingNetLocal * j.rate);
  const settleTone: 'credit' | 'debit' | 'none' =
    myNetKRW > 0 ? 'credit' : myNetKRW < 0 ? 'debit' : 'none';
  const settleLabel =
    settleTone === 'credit' ? '받을 돈' : settleTone === 'debit' ? '보낼 돈' : '정산 완료';
  const settleColor =
    settleTone === 'credit'
      ? 'text-blue-600'
      : settleTone === 'debit'
        ? 'text-[#FF4D4D]'
        : 'text-slate-400';
  const settleAmountAbs = Math.abs(myNetKRW);

  const statusChip =
    status.tone === 'active'
      ? 'bg-blue-50 text-blue-600'
      : status.tone === 'planned'
        ? 'bg-orange-50 text-orange-600'
        : 'bg-slate-100 text-slate-400';

  return (
    <button
      type="button"
      onClick={onClick}
      className="w-full cursor-pointer rounded-[32px] border border-slate-100 bg-white p-5 text-left shadow-sm active:scale-[0.99]"
    >
      <div className="mb-4 flex items-start justify-between">
        <div className="flex items-center gap-2">
          <span className="rounded bg-slate-900 px-2 py-0.5 text-[10px] font-black uppercase tracking-wider text-white">
            {j.country}
          </span>
          <span className={`rounded px-2 py-0.5 text-[10px] font-bold ${statusChip}`}>
            {status.label}
          </span>
        </div>
        <span className="text-[10px] font-bold tracking-tight text-slate-400">
          {j.startDate.replaceAll('-', '.')} - {j.endDate.split('-')[2]}
        </span>
      </div>

      <div className="mb-6">
        <h3 className="mb-1 text-xl font-black tracking-tight">{j.name}</h3>
        <p className="text-xs font-bold text-slate-400">{insight}</p>
      </div>

      {hasBudget ? (
        <div
          className={`mb-6 rounded-2xl border p-4 ${
            isOver ? 'border-red-100 bg-red-50/60' : 'border-blue-100 bg-blue-50/60'
          }`}
        >
          <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">
            {isOver ? '초과 지출' : '남은 예산'}
          </p>
          <p
            className={`mt-1 text-2xl font-black tracking-tight ${
              isOver ? 'text-[#FF4D4D]' : 'text-blue-600'
            }`}
          >
            {formatKRW(isOver ? overKRW : remainKRW)}
            <span className="ml-1 text-sm font-black text-slate-400">원</span>
          </p>
          <p className="mt-1 text-[10px] font-bold text-slate-400">
            ≈ {formatLocal((isOver ? overKRW : remainKRW) / j.rate)} {j.currency}
          </p>

          <div className="mt-4">
            <div className="mb-1.5 flex items-center justify-between">
              <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">
                예산 사용 현황
              </span>
              <span
                className={`text-[11px] font-black ${
                  isOver
                    ? 'text-[#FF4D4D]'
                    : usedRatio >= 80
                      ? 'text-orange-500'
                      : 'text-blue-600'
                }`}
              >
                {usedRatio}%
              </span>
            </div>
            <div className="h-2 w-full overflow-hidden rounded-full bg-white">
              <div
                className={`h-full rounded-full transition-all ${
                  isOver
                    ? 'bg-[#FF4D4D]'
                    : usedRatio >= 80
                      ? 'bg-orange-500'
                      : 'bg-blue-600'
                }`}
                style={{ width: `${progressPct}%` }}
              />
            </div>
            <div className="mt-2 flex items-center justify-between text-[10px] font-bold text-slate-500">
              <span>
                <span
                  className={`font-black ${isOver ? 'text-[#FF4D4D]' : 'text-slate-700'}`}
                >
                  {formatKRW(spentKRW)}원
                </span>{' '}
                사용
              </span>
              <span>목표 {formatKRW(budgetKRW)}원</span>
            </div>
            <div className="mt-1 flex items-center justify-between text-[10px] font-bold text-slate-300">
              <span>
                약 {formatLocal(spentKRW / j.rate)} {j.currency}
              </span>
              <span>
                약 {formatLocal(budgetKRW / j.rate)} {j.currency}
              </span>
            </div>
          </div>
        </div>
      ) : (
        <div className="mb-6 rounded-2xl border border-dashed border-slate-200 bg-slate-50/40 px-4 py-3">
          <p className="text-[11px] font-bold text-slate-500">
            내 지출액 <span className="font-black text-slate-900">{formatKRW(spentKRW)}원</span>
            <span className="ml-1 text-[10px] font-bold text-slate-400">
              (약 {formatLocal(spentKRW / j.rate)} {j.currency})
            </span>
          </p>
        </div>
      )}

      <div className="flex items-center justify-between border-t border-slate-100 pt-4">
        <div className="flex -space-x-2">
          {j.participants.map((p) => (
            <div
              key={p}
              className="grid size-8 place-items-center rounded-full border-2 border-white bg-slate-200 text-[10px] font-black text-slate-500"
            >
              {p[0]}
            </div>
          ))}
        </div>
        <div className="text-right">
          <p className="mb-0.5 text-[10px] font-black uppercase tracking-widest text-slate-300">
            정산 요약
          </p>
          <p className={`text-xs font-black ${settleColor}`}>
            {settleTone === 'none' ? settleLabel : `${settleLabel} ${formatKRW(settleAmountAbs)}원`}
          </p>
        </div>
      </div>
    </button>
  );
}

export function HomePage() {
  const nav = useNavigate();
  const { data: journeys = [], isPending: journeysPending } = useJourneysQuery();
  const { data: allExpenses = [] } = useAllExpensesQuery();

  const { ongoing, upcoming, past } = useMemo(() => {
    const ongoing: Journey[] = [];
    const upcoming: Journey[] = [];
    const past: Journey[] = [];
    for (const j of journeys) {
      const phase = getJourneyPhase(j.startDate, j.endDate);
      if (phase === 'ongoing') ongoing.push(j);
      else if (phase === 'upcoming') upcoming.push(j);
      else past.push(j);
    }
    upcoming.sort((a, b) => a.startDate.localeCompare(b.startDate));
    ongoing.sort((a, b) => b.startDate.localeCompare(a.startDate));
    past.sort((a, b) => b.endDate.localeCompare(a.endDate));
    return { ongoing, upcoming, past };
  }, [journeys]);

  const scanTarget = ongoing[0] ?? upcoming[0] ?? null;

  const Section = ({
    title,
    subtitle,
    items,
    emptyText,
    layout = 'card',
  }: {
    title: string;
    subtitle: string;
    items: Journey[];
    emptyText: string;
    layout?: 'card' | 'compact';
  }) => (
    <section className="mb-10">
      <div className="mb-3">
        <h3 className="text-base font-black tracking-tight text-slate-900">{title}</h3>
        <p className="mt-0.5 text-[11px] font-bold text-slate-400">{subtitle}</p>
      </div>
      {items.length === 0 ? (
        <p className="rounded-2xl border border-dashed border-slate-200 bg-white/60 px-4 py-8 text-center text-xs font-bold text-slate-400">
          {emptyText}
        </p>
      ) : (
        <div className={layout === 'compact' ? 'space-y-3' : 'space-y-4'}>
          {items.map((j) =>
            layout === 'compact' ? (
              <CompactJourneyRow
                key={j.id}
                j={j}
                expenses={allExpenses}
                onClick={() => nav(`/journeys/${j.id}`)}
              />
            ) : (
              <JourneyCard
                key={j.id}
                j={j}
                expenses={allExpenses}
                onClick={() => nav(`/journeys/${j.id}`)}
              />
            ),
          )}
        </div>
      )}
    </section>
  );

  return (
    <div className="relative min-h-dvh bg-slate-50 pb-20">
      <header className="flex items-start justify-between px-6 pt-12">
        <h1 className="text-2xl font-bold leading-tight tracking-tight text-slate-900">
          즐거운 여행에만 몰입하세요,
          <br />
          <span className="text-blue-600">기록은 틱(Tick)</span>이 할게요.
        </h1>
        <Link
          to="/settings"
          aria-label="설정"
          className="grid size-10 place-items-center rounded-full border border-slate-200 bg-white shadow-sm active:scale-95"
        >
          <User className="size-5 text-slate-400" />
        </Link>
      </header>

      <main className="px-6 pb-6 pt-8">
        {journeysPending ? (
          <HomeSkeleton />
        ) : journeys.length === 0 ? (
          <EmptyHomeState />
        ) : (
          <>
            <div className="mb-6 flex items-center justify-between">
              <h2 className="text-lg font-black tracking-tight">나의 여행</h2>
              <Link
                to="/journeys/new"
                className="flex items-center text-sm font-black text-blue-600"
              >
                <Plus className="mr-1 size-4" /> 새 여행
              </Link>
            </div>

            <Section
              title="여행 중"
              subtitle="오늘 날짜가 여행 기간 안에 있는 여정"
              items={ongoing}
              emptyText="진행 중인 여행이 없어요."
            />
            <Section
              title="다가오는 여행"
              subtitle="아직 시작일이 오늘보다 이후인 여정"
              items={upcoming}
              emptyText="예정된 여행이 없어요."
              layout="compact"
            />
            <Section
              title="지난 여행"
              subtitle="종료일이 지난 여정"
              items={past}
              emptyText="종료된 여행이 없어요."
              layout="compact"
            />
          </>
        )}
      </main>

      {scanTarget ? (
        <FabStack>
          <Fab label="영수증 스캔" onClick={() => nav(`/journeys/${scanTarget.id}/scan`)}>
            <Camera className="size-8" />
          </Fab>
        </FabStack>
      ) : null}

      <BottomNav />
    </div>
  );
}
