import { Camera, Plus, User } from 'lucide-react'
import { useMemo } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { BottomNav } from '../components/BottomNav'
import { Fab } from '../components/Fab'
import { getJourneyPhase, getTripStatusLabel } from '../lib/dates'
import { formatKRW } from '../lib/money'
import type { Expense, Journey } from '../types'
import { useAllExpensesQuery, useJourneysQuery } from '../features/journeys/queries'
import { sumMySpendKRW, sumTotalKRW } from '../features/settlement/calc'

function JourneyCard({
  j,
  expenses,
  onClick,
}: {
  j: Journey
  expenses: Expense[]
  onClick: () => void
}) {
  const status = getTripStatusLabel(j.startDate, j.endDate)
  const tripExpenses = expenses.filter((e) => e.journeyId === j.id)
  const spentKRW = sumMySpendKRW(j, tripExpenses)
  const totalReceiptKRW = sumTotalKRW(j, tripExpenses)

  const statusChip =
    status.tone === 'active'
      ? 'bg-blue-50 text-blue-600'
      : status.tone === 'planned'
        ? 'bg-orange-50 text-orange-600'
        : 'bg-slate-100 text-slate-400'

  return (
    <button
      type="button"
      onClick={onClick}
      className="w-full rounded-[32px] border border-slate-100 bg-white p-5 text-left shadow-sm active:scale-[0.99]"
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
        <p className="text-xs font-bold text-slate-400">
          현지 지갑(환전/충전) + 지출 기록으로만 관리
        </p>
      </div>

      <div className="mb-6 rounded-2xl border border-dashed border-slate-200 bg-slate-50/40 px-4 py-3">
        <p className="text-[11px] font-bold text-slate-500">
          내 부담 지출 <span className="font-black text-slate-900">{formatKRW(spentKRW)}원</span>
        </p>
        <p className="mt-1 text-[10px] font-bold text-slate-400">
          영수증 전체 합(참고) {formatKRW(totalReceiptKRW)}원
        </p>
      </div>

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
            총 지출
          </p>
          <p className="text-xs font-black text-slate-900">{formatKRW(spentKRW)}원</p>
        </div>
      </div>
    </button>
  )
}

export function HomePage() {
  const nav = useNavigate()
  const { data: journeys = [] } = useJourneysQuery()
  const { data: allExpenses = [] } = useAllExpensesQuery()

  const { ongoing, upcoming, past } = useMemo(() => {
    const ongoing: Journey[] = []
    const upcoming: Journey[] = []
    const past: Journey[] = []
    for (const j of journeys) {
      const phase = getJourneyPhase(j.startDate, j.endDate)
      if (phase === 'ongoing') ongoing.push(j)
      else if (phase === 'upcoming') upcoming.push(j)
      else past.push(j)
    }
    upcoming.sort((a, b) => a.startDate.localeCompare(b.startDate))
    ongoing.sort((a, b) => b.startDate.localeCompare(a.startDate))
    past.sort((a, b) => b.endDate.localeCompare(a.endDate))
    return { ongoing, upcoming, past }
  }, [journeys])

  const scanTarget = ongoing[0] ?? upcoming[0] ?? null

  const Section = ({
    title,
    subtitle,
    items,
    emptyText,
  }: {
    title: string
    subtitle: string
    items: Journey[]
    emptyText: string
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
        <div className="space-y-4">
          {items.map((j) => (
            <JourneyCard
              key={j.id}
              j={j}
              expenses={allExpenses}
              onClick={() => nav(`/journeys/${j.id}`)}
            />
          ))}
        </div>
      )}
    </section>
  )

  return (
    <div className="relative min-h-dvh bg-slate-50 pb-20">
      <header className="flex items-start justify-between px-6 pt-12">
        <h1 className="text-2xl font-bold leading-tight tracking-tight text-slate-900">
          즐거운 여행에만 몰입하세요,
          <br />
          <span className="text-blue-600">기록은 틱(Tick)</span>이 할게요.
        </h1>
        <div className="grid size-10 place-items-center rounded-full border border-slate-200 bg-white shadow-sm">
          <User className="size-5 text-slate-400" />
        </div>
      </header>

      <main className="px-6 pb-6 pt-8">
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
        />
        <Section
          title="지난 여행"
          subtitle="종료일이 지난 여정"
          items={past}
          emptyText="종료된 여행이 없어요."
        />
      </main>

      {scanTarget ? (
        <Fab
          label="영수증 스캔"
          onClick={() => nav(`/journeys/${scanTarget.id}/scan`)}
        >
          <Camera className="size-8" />
        </Fab>
      ) : null}

      <BottomNav />

    </div>
  )
}
