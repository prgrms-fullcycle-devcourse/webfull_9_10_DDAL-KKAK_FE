import html2canvas from 'html2canvas'
import { useRef, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { TopBar } from '../components/TopBar'
import { useExpensesQuery, useJourneyQuery } from '../features/journeys/queries'
import { calcSettlement, ledgerSelfName } from '../features/settlement/calc'
import { formatKRW, formatLocal } from '../lib/money'

export function ReportPage() {
  const nav = useNavigate()
  const { journeyId } = useParams()
  const { data: journey } = useJourneyQuery(journeyId)
  const { data: expenses = [] } = useExpensesQuery(journeyId)
  const reportRef = useRef<HTMLDivElement | null>(null)
  const [isCapturing, setIsCapturing] = useState(false)
  const [showBasis, setShowBasis] = useState(false)
  const [basisPerson, setBasisPerson] = useState<string | null>(null)

  if (!journey) return null

  const data = calcSettlement(journey, expenses)
  const people = journey.participants.length ? journey.participants : ['나']
  const selfName = ledgerSelfName(journey)
  const selected = basisPerson ?? people[0]

  const toMe = data.transfers.filter((t) => t.to === selfName)
  const fromMe = data.transfers.filter((t) => t.from === selfName)
  const toMeTotal = toMe.reduce((a, t) => a + t.amountLocal, 0)
  const fromMeTotal = fromMe.reduce((a, t) => a + t.amountLocal, 0)

  const handleCapture = async () => {
    if (!reportRef.current) return
    setIsCapturing(true)
    try {
      const canvas = await html2canvas(reportRef.current, {
        backgroundColor: '#F8F9FA',
        scale: 2,
      })
      const url = canvas.toDataURL('image/png')
      const a = document.createElement('a')
      a.href = url
      a.download = `travel-tick-report-${journey.id}.png`
      a.click()
    } finally {
      setIsCapturing(false)
    }
  }

  return (
    <div className="min-h-dvh bg-slate-50">
      <TopBar title="최종 정산 리포트" backTo={`/journeys/${journey.id}`} />

      <main className="px-6 pb-10">
        <div ref={reportRef} className="space-y-6 pb-6 pt-4">
          <section className="rounded-[40px] border border-slate-100 bg-white p-8 text-center shadow-sm">
            <p className="mb-2 text-xs font-black uppercase text-slate-400">
              Live Settlement
            </p>
            <h3 className="mb-1 text-3xl font-black tracking-tight text-slate-900">
              누가 누구에게 얼마를?
            </h3>
            <p className="mb-8 text-[11px] font-bold text-slate-400">
              현지 통화 기준으로 계산하고, 송금할 때만 원화 환산을 같이 보여줘요.
            </p>

            <div className="mb-8 grid gap-3 rounded-3xl bg-slate-50 p-6 text-left">
              <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">
                {selfName} 기준 요약
              </p>
              <div className="grid grid-cols-2 gap-3">
                <div className="rounded-2xl bg-white p-4">
                  <p className="text-[10px] font-black uppercase tracking-widest text-slate-300">
                    내가 받을 돈
                  </p>
                  <p className="mt-2 text-xl font-black text-emerald-700">
                    {formatLocal(toMeTotal)} {journey.currency}
                  </p>
                  <p className="mt-1 text-[10px] font-bold text-slate-400">
                    약 {formatKRW(toMeTotal * journey.rate)}원
                  </p>
                </div>
                <div className="rounded-2xl bg-white p-4">
                  <p className="text-[10px] font-black uppercase tracking-widest text-slate-300">
                    내가 줄 돈
                  </p>
                  <p className="mt-2 text-xl font-black text-rose-700">
                    {formatLocal(fromMeTotal)} {journey.currency}
                  </p>
                  <p className="mt-1 text-[10px] font-bold text-slate-400">
                    약 {formatKRW(fromMeTotal * journey.rate)}원
                  </p>
                </div>
              </div>

              <div className="grid grid-cols-1 gap-3">
                <div className="rounded-2xl bg-white p-4">
                  <p className="text-[10px] font-black uppercase tracking-widest text-slate-300">
                    내가 받을 송금 루트
                  </p>
                  {toMe.length ? (
                    <div className="mt-3 space-y-2">
                      {toMe.map((t) => (
                        <div
                          key={`${t.from}->${t.to}-${t.amountLocal}-me-in`}
                          className="flex items-center justify-between rounded-xl bg-slate-50 px-3 py-2"
                        >
                          <span className="text-[11px] font-black text-slate-700">
                            {t.from} → {selfName}
                          </span>
                          <span className="text-[11px] font-black text-slate-900">
                            {formatLocal(t.amountLocal)} {journey.currency}
                          </span>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="mt-2 text-[11px] font-bold text-slate-400">
                      받을 송금이 없어요.
                    </p>
                  )}
                </div>

                <div className="rounded-2xl bg-white p-4">
                  <p className="text-[10px] font-black uppercase tracking-widest text-slate-300">
                    내가 줄 송금 루트
                  </p>
                  {fromMe.length ? (
                    <div className="mt-3 space-y-2">
                      {fromMe.map((t) => (
                        <div
                          key={`${t.from}->${t.to}-${t.amountLocal}-me-out`}
                          className="flex items-center justify-between rounded-xl bg-slate-50 px-3 py-2"
                        >
                          <span className="text-[11px] font-black text-slate-700">
                            {selfName} → {t.to}
                          </span>
                          <span className="text-[11px] font-black text-slate-900">
                            {formatLocal(t.amountLocal)} {journey.currency}
                          </span>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="mt-2 text-[11px] font-bold text-slate-400">
                      줄 송금이 없어요.
                    </p>
                  )}
                </div>
              </div>
            </div>

            <button
              type="button"
              onClick={() => setShowBasis((v) => !v)}
              className="mt-6 w-full rounded-2xl border border-slate-100 bg-white py-4 text-sm font-black text-slate-700"
            >
              {showBasis ? '정산 기준 접기' : '어떤 영수증으로 계산했나요?'}
            </button>

            {showBasis ? (
              <div className="mt-4 rounded-3xl border border-slate-100 bg-white p-6 text-left">
                <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">
                  Settlement basis
                </p>
                <p className="mt-2 text-sm font-black text-slate-900">
                  이름을 눌러 그 사람이 어떤 영수증으로 계산됐는지 확인해요.
                </p>

                <div className="mt-4 flex flex-wrap gap-2">
                  {people.map((p) => (
                    <button
                      key={p}
                      type="button"
                      onClick={() => setBasisPerson(p)}
                      className={`rounded-full px-3 py-2 text-[11px] font-black ${
                        selected === p ? 'bg-blue-600 text-white' : 'bg-slate-100 text-slate-600'
                      }`}
                    >
                      {p}
                    </button>
                  ))}
                </div>

                <div className="mt-5 space-y-2">
                  {expenses.length ? (
                    expenses
                      .map((e) => {
                        const splitPeople =
                          e.type === 'shared'
                            ? (e.splitWith?.filter((x) => people.includes(x)) ?? people)
                            : []
                        const n =
                          e.type === 'shared'
                            ? Math.max(
                                splitPeople.length ||
                                  e.splitAmong ||
                                  Math.max(people.length, 1),
                                1,
                              )
                            : 1
                        const myShare =
                          e.type === 'private'
                            ? e.payer === selected
                              ? e.amountLocal
                              : 0
                            : splitPeople.includes(selected)
                              ? e.amountLocal / n
                              : 0

                        return { e, myShare, splitPeople, n }
                      })
                      .filter((x) => x.myShare > 0)
                      .map(({ e, myShare, splitPeople, n }) => (
                        <div
                          key={e.id}
                          className="flex items-start justify-between rounded-2xl bg-slate-50 px-4 py-3"
                        >
                          <div className="min-w-0 pr-3">
                            <p className="truncate text-sm font-black text-slate-900">
                              {e.emoji} {e.store}
                            </p>
                            <p className="mt-1 text-[10px] font-bold text-slate-400">
                              {e.date} {e.time} · 결제자 {e.payer} ·{' '}
                              {(e.method ?? 'card') === 'cash' ? '현금' : '카드'} ·{' '}
                              {e.type === 'shared'
                                ? `공동 (${splitPeople.join(', ')}) 1/${n}`
                                : '개인'}
                            </p>
                            <p className="mt-1 text-[10px] font-black text-blue-600">
                              {selected} 반영 금액: {formatLocal(myShare)} {journey.currency}
                            </p>
                          </div>
                          <div className="text-right">
                            <p className="text-sm font-black text-slate-900">
                              {formatLocal(e.amountLocal)} {journey.currency}
                            </p>
                            <p className="text-[10px] font-bold text-slate-300">
                              약 {formatKRW(e.amountLocal * journey.rate)}원
                            </p>
                          </div>
                        </div>
                      ))
                  ) : (
                    <p className="text-[11px] font-bold text-slate-500">
                      아직 저장된 영수증이 없어요.
                    </p>
                  )}
                </div>
              </div>
            ) : null}
          </section>
        </div>

        <button
          type="button"
          onClick={handleCapture}
          disabled={isCapturing}
          className="mt-2 w-full rounded-2xl bg-slate-900 py-4 text-sm font-black text-white disabled:opacity-60"
        >
          {isCapturing ? '이미지 만드는 중…' : '리포트 이미지로 공유하기'}
        </button>

        <button
          type="button"
          onClick={() => nav(`/journeys/${journey.id}`)}
          className="mt-3 w-full py-3 text-sm font-black text-slate-400"
        >
          타임라인으로 돌아가기
        </button>
      </main>
    </div>
  )
}

