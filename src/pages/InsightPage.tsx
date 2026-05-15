import { TopBar } from '@/components/layout/TopBar';
import { useJourneyQuery } from '@/features/journeys/queries';
import { useReportQuery } from '@/features/report/queries';
import { useParams } from 'react-router-dom';

export function InsightPage() {
  const { journeyId } = useParams();
  const { data: journey } = useJourneyQuery(journeyId);
  const { data: reportData, isLoading } = useReportQuery(journeyId);

  if (isLoading || !journey) return <InsightSkeleton />;

  const { report, statistics } = reportData ?? {};

  return (
    <div className="min-h-dvh bg-slate-50 pb-10">
      <TopBar title="AI 소비 성향 리포트" backTo={`/journeys/${journey.id}`} />

      <main className="space-y-6 px-6 py-6">
        <section className="relative overflow-hidden rounded-[40px] border border-slate-100 bg-white p-8 shadow-sm">
          <div className="absolute -right-12 -top-12 size-32 rounded-full bg-blue-600/5" />
          <span className="mb-2 block text-[10px] font-black uppercase tracking-widest text-blue-600">
            Travel Style Analysis
          </span>
          <h3 className="mb-4 text-2xl font-black">
            {report ? `"${report.consumptionStyle}"` : '"분석 중..."'}
          </h3>
          {report ? (
            <p className="text-sm font-bold leading-relaxed text-slate-600">
              {report.totalAnalysis}
            </p>
          ) : (
            <p className="text-sm font-bold leading-relaxed text-slate-500">
              영수증을 몇 개만 찍으면 바로 스타일이 나와요.
            </p>
          )}
        </section>

        <section className="grid grid-cols-2 gap-3">
          <div className="rounded-3xl border border-slate-100 bg-white p-5">
            <p className="text-[10px] font-black uppercase tracking-widest text-slate-300">
              총 지출 건수
            </p>
            <p className="mt-2 text-lg font-black text-slate-900">{statistics?.expenseCount}개</p>
          </div>
          <div className="rounded-3xl border border-slate-100 bg-white p-5">
            <p className="text-[10px] font-black uppercase tracking-widest text-slate-300">
              주요 카테고리
            </p>
            <p className="mt-2 text-lg font-black text-blue-600">{statistics?.mostSpentCategory}</p>
          </div>
          <div className="rounded-3xl border border-slate-100 bg-white p-5">
            <p className="text-[10px] font-black uppercase tracking-widest text-slate-300">
              총 지출액
            </p>
            <p className="mt-2 text-lg font-black text-slate-900">
              {statistics?.totalAmountKrw.toLocaleString()}원
            </p>
          </div>
          <div className="rounded-3xl border border-slate-100 bg-white p-5">
            <p className="text-[10px] font-black uppercase tracking-widest text-slate-300">
              하루 평균 지출액
            </p>
            <p className="mt-2 text-lg font-black text-slate-900">
              {statistics?.dailyAverageKrw.toLocaleString()}원
            </p>
          </div>
        </section>

        <section className="rounded-3xl border border-slate-100 bg-white p-6">
          <h4 className="mb-4 text-xs font-black uppercase tracking-widest text-slate-400">
            카테고리 분석
          </h4>
          <div className="space-y-4">
            {report?.categoryInsights.map((item, idx) => (
              <div key={idx} className="flex flex-col gap-1 border-l-2 border-blue-500 pl-4">
                <div className="flex justify-between items-center">
                  <span className="font-black text-slate-800">{item.category}</span>
                  <span className="text-xs font-bold text-slate-400">
                    {item.amount.toLocaleString()}원
                  </span>
                </div>
                <p className="text-sm text-slate-500 leading-snug">{item.insight}</p>
              </div>
            ))}
          </div>
        </section>

        <section className="rounded-3xl bg-blue-600 p-6 text-white shadow-lg shadow-blue-200">
          <div className="mb-4 flex items-center gap-2">
            <span className="text-lg">💡</span>
            <h4 className="text-sm font-black">AI가 제안하는 더 나은 여행</h4>
          </div>
          <ul className="space-y-3">
            {report?.suggestions.map((suggestion, idx) => (
              <li
                key={idx}
                className="flex gap-2 text-sm font-bold leading-relaxed text-blue-50/90"
              >
                <span className="opacity-50">#</span>
                {suggestion}
              </li>
            ))}
          </ul>
        </section>
      </main>
    </div>
  );
}

/**
 * InsightPage 로딩 중 스켈레톤.
 * - 큰 타이틀 카드 + 통계 그리드 모사
 */
function InsightSkeleton() {
  return (
    <div className="min-h-dvh bg-slate-50 pb-10">
      {/* TopBar 스켈레톤 */}
      <header className="sticky top-0 z-20 border-b border-slate-100 bg-white/90 backdrop-blur">
        <div className="flex items-center gap-3 px-6 pb-5 pt-12">
          <div className="size-7 animate-pulse rounded-xl bg-slate-100" />
          <div className="h-4 w-40 animate-pulse rounded-lg bg-slate-100" />
        </div>
      </header>

      <main className="space-y-6 px-6 py-6">
        {/* 메인 타이틀 카드 */}
        <section className="rounded-[40px] border border-slate-100 bg-white p-8">
          <div className="mb-2 h-3 w-32 animate-pulse rounded bg-slate-200" />
          <div className="mb-4 h-8 w-44 animate-pulse rounded-lg bg-slate-200" />
          <div className="space-y-2">
            <div className="h-3 w-full animate-pulse rounded bg-slate-100" />
            <div className="h-3 w-5/6 animate-pulse rounded bg-slate-100" />
            <div className="h-3 w-3/4 animate-pulse rounded bg-slate-100" />
          </div>
        </section>

        {/* 통계 그리드 */}
        <section className="grid grid-cols-2 gap-3">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="animate-pulse rounded-2xl border border-slate-100 bg-white p-4">
              <div className="mb-2 h-3 w-16 rounded bg-slate-200" />
              <div className="h-5 w-20 rounded bg-slate-200" />
            </div>
          ))}
        </section>
      </main>
    </div>
  );
}
