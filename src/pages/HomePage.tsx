import { Camera, Plus, User, Wallet } from 'lucide-react';
import { useMemo } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { BottomNav } from '@/components/layout/BottomNav';
import { Fab, FabStack } from '@/components/layout/Fab';
import { getElapsedDays, getJourneyPhase, getTripDays, getTripStatusLabel } from '@/lib/dates';
import { formatKRW } from '@/lib/money';
import type { Journey } from '@/features/journeys/types';
import type { Expense } from '@/features/expenses/types';
import { useAllExpensesQuery } from '@/features/expenses/queries';
import { useAuth } from '@/features/auth/useAuth';
import { useJourneysQuery } from '@/features/journeys/queries';
import { withEffectiveTripFinance } from '@/features/journeys/storage';
import { sumMySpendKRW, sumTotalKRW } from '@/features/settlement/calc';
import { useSettlementSummaryQuery } from '@/features/settlement/queries';

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

/** 원화 표기 — 기획안처럼 소액일 때 소수 한 자리까지 */
function formatWonFlexible(value: number): string {
  const t = Math.round(value * 10) / 10;
  if (Number.isInteger(t)) return formatKRW(t);
  return new Intl.NumberFormat('ko-KR', {
    minimumFractionDigits: 1,
    maximumFractionDigits: 1,
  }).format(t);
}

/** 홈 카드 메인 금액 — `US$` 대신 짧은 통화 기호로 표기 */
function formatLocalWalletHeadline(currency: string, amount: number): string {
  const intUnit = currency === 'JPY' || currency === 'KRW';
  const n = intUnit ? Math.round(amount) : amount;
  if (currency === 'KRW') {
    return `${formatKRW(n)}원`;
  }
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency,
    currencyDisplay: 'narrowSymbol',
    maximumFractionDigits: intUnit ? 0 : 2,
  }).format(n);
}

/** 예산 대비 사용 비율(%) — 아주 작은 지출도 0%로 뭉개지지 않게 */
function budgetUsagePercent(
  spentKRW: number,
  budgetKRW: number,
): { barPct: number; label: string; raw: number } {
  if (!budgetKRW || budgetKRW <= 0) return { barPct: 0, label: '0%', raw: 0 };
  const raw = (spentKRW / budgetKRW) * 100;
  const barPct = Math.min(raw, 100);
  const label =
    raw > 0 && raw < 0.1 ? `${raw.toFixed(2)}%` : raw < 10 && raw > 0 ? `${raw.toFixed(1)}%` : `${Math.min(Math.round(raw), 999)}%`;
  return { barPct, label, raw };
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
  const jc = withEffectiveTripFinance(j);
  const phase = getJourneyPhase(jc.startDate, jc.endDate);
  const status = getTripStatusLabel(jc.startDate, jc.endDate);
  const tripExpenses = expenses.filter((e) => e.journeyId === jc.id);
  const spentKRW = sumMySpendKRW(jc, tripExpenses);
  const tripDays = getTripDays(jc.startDate, jc.endDate);

  const hasBudget = typeof jc.budgetKRW === 'number' && jc.budgetKRW > 0;
  const budgetKRW = hasBudget ? jc.budgetKRW! : 0;

  const { data: settleSummary } = useSettlementSummaryQuery(jc.id);
  const myNetKRW = settleSummary?.summary?.netAmountKrw ?? 0;

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
        {countryEmoji(jc.country)}
      </div>

      {/* 가운데: 이름 + 메타 */}
      <div className="min-w-0 flex-1">
        <h4 className="truncate text-sm font-black tracking-tight text-slate-900">{jc.name}</h4>
        <p className="mt-0.5 truncate text-[10px] font-bold text-slate-400">
          {formatCompactDateRange(jc.startDate, jc.endDate)} · {formatMembers(jc.participants)}
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
              {hasBudget ? `예산 ${formatKRW(budgetKRW)}원` : `${tripDays}일 · ${jc.participants.length}명`}
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
  const jc = withEffectiveTripFinance(j);
  const status = getTripStatusLabel(jc.startDate, jc.endDate);
  const phase = getJourneyPhase(jc.startDate, jc.endDate);
  const tripExpenses = expenses.filter((e) => e.journeyId === jc.id);
  const spentKRW = sumMySpendKRW(jc, tripExpenses);

  const hasBudget = typeof jc.budgetKRW === 'number' && jc.budgetKRW > 0;
  const budgetKRW = hasBudget ? jc.budgetKRW! : 0;
  const tripDays = getTripDays(jc.startDate, jc.endDate);
  const elapsedDays = getElapsedDays(jc.startDate, jc.endDate);
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
      return `${tripDays}일 일정 · ${jc.participants.length}명`;
    }
    // past
    if (expenseCount === 0) return '기록된 지출이 없어요';
    const avg = Math.round(spentKRW / tripDays);
    return `지출 ${expenseCount}건 · 일평균 ${formatKRW(avg)}원`;
  })();
  const isOver = hasBudget && spentKRW > budgetKRW;
  const remainKRW = Math.max(budgetKRW - spentKRW, 0);
  const overKRW = Math.max(spentKRW - budgetKRW, 0);
  const { barPct: progressPct, label: usedRatioLabel, raw: usedRawPct } = budgetUsagePercent(
    spentKRW,
    budgetKRW,
  );

  const { data: settleSummary } = useSettlementSummaryQuery(jc.id);
  const myNetKRW = settleSummary?.summary?.netAmountKrw ?? 0;
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

  const settleSummaryLine =
    settleTone === 'none'
      ? settleLabel
      : `내 정산액: ${myNetKRW > 0 ? '+' : myNetKRW < 0 ? '−' : ''}${formatWonFlexible(settleAmountAbs)}원`;

  const settleSummaryClass =
    settleTone === 'none'
      ? settleColor
      : settleTone === 'debit'
        ? 'text-[#FF4D4D]'
        : 'text-blue-600';

  const rate = jc.rate > 0 ? jc.rate : 1;
  const spentLocal = spentKRW / rate;
  const remainLocal = remainKRW / rate;
  const overLocal = overKRW / rate;

  const tripSpendTotalKRW = sumTotalKRW(jc, tripExpenses);

  const noBudgetSharePct =
    tripSpendTotalKRW > 0 ? Math.min(100, (spentKRW / tripSpendTotalKRW) * 100) : 0;
  const noBudgetShareLabel =
    tripSpendTotalKRW > 0
      ? noBudgetSharePct < 0.1 && noBudgetSharePct > 0
        ? `${noBudgetSharePct.toFixed(2)}%`
        : noBudgetSharePct < 10 && noBudgetSharePct > 0
          ? `${noBudgetSharePct.toFixed(1)}%`
          : `${Math.round(noBudgetSharePct)}%`
      : '0%';

  return (
    <button
      type="button"
      onClick={onClick}
      className="w-full cursor-pointer rounded-[24px] border border-slate-100/80 bg-white p-6 text-left shadow-md active:scale-[0.99]"
    >
      <div className="flex items-start justify-between gap-2">
        <div className="flex flex-wrap items-center gap-2">
          <span className="rounded-lg bg-slate-900 px-2.5 py-1 text-[11px] font-black text-white">
            {jc.country}
          </span>
          <span className={`rounded-lg px-2.5 py-1 text-[11px] font-black ${statusChip}`}>
            {status.label}
          </span>
        </div>
        <span className="shrink-0 pt-0.5 text-[11px] font-bold tracking-tight text-slate-400">
          {formatCompactDateRange(jc.startDate, jc.endDate)}
        </span>
      </div>

      <h3 className="mt-4 text-xl font-black leading-snug tracking-tight text-slate-900">{jc.name}</h3>

      <p className="mt-1.5 text-xs font-bold text-slate-400">{insight}</p>

      {/* 핵심: 현지 잔액/지출 — 기획상 가장 크게 */}
      <div className="mt-5">
        <p className="text-xs font-bold text-slate-500">
          {hasBudget
            ? isOver
              ? '초과 금액'
              : '남은예산'
            : '현지 지출'}
        </p>
        <p
          className={`mt-1 text-[2rem] font-black leading-tight tracking-tight tabular-nums sm:text-[2.25rem] ${
            hasBudget && isOver ? 'text-[#FF4D4D]' : 'text-blue-600'
          }`}
        >
          {hasBudget
            ? formatLocalWalletHeadline(jc.currency, isOver ? overLocal : remainLocal)
            : formatLocalWalletHeadline(jc.currency, spentLocal)}
        </p>
        {!hasBudget ? (
          <p className="mt-1 text-[10px] font-bold leading-relaxed text-slate-400">
            목표 예산이 없어 <span className="text-slate-600">남은 잔액</span>은 계산되지 않아요. 위 금액은{' '}
            <span className="font-black text-slate-600">내 누적 지출</span>이에요.
          </p>
        ) : (
          <p className={`mt-1 text-sm font-black tabular-nums ${isOver ? 'text-[#FF4D4D]' : 'text-slate-900'}`}>
            {formatWonFlexible(isOver ? overKRW : remainKRW)}원
          </p>
        )}
      </div>

      {/* 자산 현황 바: 사용 / 전체(예산 또는 동행 전체 지출) */}
      <div className="mt-5 rounded-2xl bg-slate-100/90 px-4 py-4">
        <div className="flex items-center justify-between gap-2">
          <div className="flex min-w-0 items-center gap-1.5">
            <Wallet className="size-4 shrink-0 text-slate-500" aria-hidden />
            <div className="min-w-0">
              <p className="truncate text-sm font-black text-slate-800">예산 사용 현황</p>
              <p className="truncate text-[9px] font-bold text-slate-400">
                {hasBudget ? '내 지출 / 목표 예산(원)' : '내 지출 / 동행 전체 지출 합계(원)'}
              </p>
            </div>
          </div>
          <span
            className={`shrink-0 text-sm font-black ${
              hasBudget
                ? isOver
                  ? 'text-[#FF4D4D]'
                  : usedRawPct >= 80
                    ? 'text-orange-500'
                    : 'text-blue-600'
                : 'text-blue-600'
            }`}
          >
            {hasBudget ? usedRatioLabel : noBudgetShareLabel}
          </span>
        </div>
        <div className="mt-3 h-2.5 w-full overflow-hidden rounded-full bg-slate-200/90">
          <div
            className={`h-full rounded-full transition-all ${
              hasBudget
                ? isOver
                  ? 'bg-[#FF4D4D]'
                  : usedRawPct >= 80
                    ? 'bg-orange-500'
                    : 'bg-blue-600'
                : 'bg-blue-600'
            }`}
            style={{
              width: `${hasBudget ? progressPct : Math.min(noBudgetSharePct, 100)}%`,
            }}
          />
        </div>
        <div className="mt-3 flex items-center justify-between gap-2 text-xs font-bold text-slate-500">
          <span>
            <span className={`font-black ${hasBudget && isOver ? 'text-[#FF4D4D]' : 'text-slate-800'}`}>
              {formatWonFlexible(spentKRW)}원
            </span>{' '}
            사용
          </span>
          <span className="shrink-0 text-right text-slate-500">
            {hasBudget ? (
              <>
                목표 예산{' '}
                <span className="font-black text-slate-700">{formatKRW(budgetKRW)}원</span>
              </>
            ) : (
              <>
                동행 합계{' '}
                <span className="font-black text-slate-700">{formatKRW(tripSpendTotalKRW)}원</span>
              </>
            )}
          </span>
        </div>
      </div>

      <div className="mt-6 flex items-center justify-between border-t border-slate-100 pt-4">
        <div className="flex -space-x-2">
          {jc.participants.map((p) => (
            <div
              key={p}
              className="grid size-9 place-items-center rounded-full border-2 border-white bg-slate-200 text-[11px] font-black text-slate-600"
            >
              {p[0]}
            </div>
          ))}
        </div>
        <div className="min-w-0 max-w-[55%] text-right">
          <p className="mb-0.5 text-[10px] font-black uppercase tracking-widest text-slate-400">
            정산 요약
          </p>
          <p className={`truncate text-xs font-black ${settleSummaryClass}`}>{settleSummaryLine}</p>
        </div>
      </div>
    </button>
  );
}

export function HomePage() {
  const nav = useNavigate();
  const { user } = useAuth();
  const { data: journeys = [], isPending: journeysPending } = useJourneysQuery();
  const { data: allExpenses = [] } = useAllExpensesQuery(user?.id);

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
        <h1 className="max-w-[min(100%,18rem)] text-2xl font-bold leading-snug tracking-tight text-slate-900">
          즐거운 여행에만 몰입하세요,
          <br />
          <span className="font-black text-blue-600">기록은 틱(Tick)</span>이 할게요.
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
              <h2 className="text-lg font-black tracking-tight">나의 여행 리스트</h2>
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
