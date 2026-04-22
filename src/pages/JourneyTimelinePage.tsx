import {
  BarChart3,
  Camera,
  Clock,
  Edit2,
  User as UserIcon,
} from 'lucide-react'
import { useMemo } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { Fab } from '../components/Fab'
import { TopBar } from '../components/TopBar'
import { useExpensesQuery, useJourneyQuery } from '../features/journeys/queries'
import {
  expenseMyShareLocal,
  ledgerSelfName,
  sumMySpendKRW,
  sumMySpendLocal,
  sumTotalKRW,
  sumTotalLocal,
} from '../features/settlement/calc'
import { formatKRW, formatLocal } from '../lib/money'

export function JourneyTimelinePage() {
  const nav = useNavigate()
  const { journeyId } = useParams()

  const { data: journey } = useJourneyQuery(journeyId)
  const { data: expenses = [] } = useExpensesQuery(journeyId)

  const grouped = useMemo(() => {
    const by: Record<string, typeof expenses> = {}
    for (const e of expenses) {
      ;(by[e.date] ??= []).push(e)
    }
    return Object.entries(by)
      .sort(([a], [b]) => (a < b ? 1 : -1))
      .map(([date, items]) => ({
        date,
        items: [...items].sort((a, b) => (a.time < b.time ? 1 : -1)),
      }))
  }, [expenses])

  if (!journey) return null

  const totalLocal = sumTotalLocal(expenses)
  const totalKRW = sumTotalKRW(journey, expenses)
  const mySpendLocal = sumMySpendLocal(journey, expenses)
  const mySpendKRW = sumMySpendKRW(journey, expenses)
  const selfName = ledgerSelfName(journey)

  return (
    <div className="relative min-h-dvh bg-white pb-20">
      <TopBar
        title={journey.name}
        subtitle={
          journey.rateMode === 'fixed'
            ? `고정 환율 · 1${journey.currency} = ${journey.rate}원`
            : '실시간 환율 (표시용 기준 적용)'
        }
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
          <div className="mb-6 flex items-center justify-between">
            <div className="flex items-center text-[10px] font-black uppercase tracking-widest text-slate-400">
              총 지출 현황
            </div>
            <button
              type="button"
              onClick={() => nav(`/journeys/${journey.id}/report`)}
              className="rounded-full bg-white/10 px-3 py-1 text-[10px] font-black uppercase tracking-tighter"
            >
              결산표
            </button>
          </div>

          <div className="space-y-2">
            <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">
              지금까지 내가 쓴 돈
            </p>
            <div className="flex items-baseline gap-2">
              <h3 className="text-4xl font-black">{formatKRW(mySpendKRW)}</h3>
              <span className="text-lg font-bold">KRW</span>
            </div>
            <p className="text-[10px] font-bold text-white/40">
              {formatLocal(mySpendLocal)} {journey.currency} · 공동(1/n)은 내 몫만, 개인은 결제자가
              「{selfName}」일 때만 포함
            </p>
            <p className="text-[10px] font-bold text-white/30">
              영수증 전체 합(참고): {formatKRW(totalKRW)}원 /{' '}
              {formatLocal(totalLocal)} {journey.currency}
            </p>

            <div className="mt-5 rounded-2xl border border-white/10 bg-white/5 p-4">
              <p className="text-[10px] font-black uppercase tracking-widest text-white/50">
                지금까지 내가 쓴 돈 (현지 기준)
              </p>
              <p className="mt-2 text-2xl font-black tracking-tight text-emerald-300">
                {formatLocal(mySpendLocal)}
                <span className="ml-1 text-sm font-bold text-emerald-200/90">
                  {journey.currency}
                </span>
              </p>
              <p className="mt-1 text-[10px] font-bold text-white/45">
                약 {formatKRW(mySpendLocal * journey.rate)}원
              </p>
            </div>
          </div>
        </section>

        <section className="space-y-12">
          {grouped.map(({ date, items }) => (
            <div key={date}>
              <div className="mb-8 flex items-center gap-3">
                <span className="rounded-lg bg-slate-100 px-2.5 py-1 text-[10px] font-black uppercase tracking-widest text-slate-900">
                  {date.replaceAll('-', '.')}
                </span>
                <div className="h-px flex-1 bg-slate-100" />
              </div>

              <div className="space-y-10">
                {items.map((e) => {
                  const myShare = expenseMyShareLocal(journey, e)
                  const splitN =
                    e.type === 'shared'
                      ? (typeof e.splitAmong === 'number' && e.splitAmong >= 1
                          ? e.splitAmong
                          : Math.max(journey.participants.length, 1))
                      : null
                  return (
                  <div key={e.id} className="group">
                    <div className="mb-2 flex items-start justify-between">
                      <div className="flex items-center gap-3">
                        <span className="text-3xl drop-shadow-sm">{e.emoji}</span>
                        <div>
                          <div className="mb-1 flex items-center gap-2">
                            <h4 className="text-base font-black leading-none text-slate-900">
                              {e.store}
                            </h4>
                            <span
                              className={`rounded px-1.5 py-0.5 text-[8px] font-black tracking-tighter ${e.type === 'shared' ? 'bg-orange-100 text-orange-600' : 'bg-slate-100 text-slate-500'}`}
                            >
                              {e.type === 'shared'
                                ? `공동${splitN != null ? ` · ${splitN}명 1/n` : ''}`
                                : '개인'}
                            </span>
                            <span className="rounded bg-slate-50 px-1.5 py-0.5 text-[8px] font-black tracking-tighter text-slate-400">
                              {(e.method ?? 'card') === 'cash' ? '현금' : '카드'}
                            </span>
                          </div>
                          <p className="flex items-center text-[10px] font-bold uppercase tracking-tighter text-slate-300">
                            <Clock className="mr-1 size-3" /> {e.time} •{' '}
                            <UserIcon className="mx-1 size-3" /> 결제자: {e.payer}
                          </p>
                        </div>
                      </div>
                      <div className="text-right">
                        <p className="text-lg font-black leading-none tracking-tight text-slate-900">
                          {formatLocal(e.amountLocal)}
                          <span className="ml-0.5 text-xs font-bold">
                            {journey.currency}
                          </span>
                        </p>
                        <p className="mt-1 text-[10px] font-bold tracking-tighter text-slate-300">
                          약 {formatKRW(e.amountLocal * journey.rate)}원
                        </p>
                        {e.type === 'shared' ? (
                          <p className="mt-1 text-[10px] font-black text-blue-600">
                            내 몫 {formatLocal(myShare)} {journey.currency} (약{' '}
                            {formatKRW(myShare * journey.rate)}원)
                          </p>
                        ) : null}
                      </div>
                    </div>

                    {e.memo ? (
                      <div className="ml-11 rounded-2xl border-l-4 border-blue-100 bg-slate-50 px-4 py-3">
                        <p className="text-sm font-medium leading-relaxed tracking-tight text-slate-500">
                          "{e.memo}"
                        </p>
                      </div>
                    ) : null}
                  </div>
                  )
                })}
              </div>
            </div>
          ))}
        </section>
      </main>

      <Fab
        label="영수증 스캔"
        onClick={() => nav(`/journeys/${journey.id}/scan`)}
      >
        <Camera className="size-8" />
      </Fab>
    </div>
  )
}

