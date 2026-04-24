import { useMemo } from 'react';
import { useParams } from 'react-router-dom';
import { TopBar } from '@/components/layout/TopBar';
import { useExpensesQuery } from '@/features/expenses/queries';
import { useJourneyQuery } from '@/features/journeys/queries';
import { hourOf } from '@/lib/datetime';

export function InsightPage() {
  const { journeyId } = useParams();
  const { data: journey } = useJourneyQuery(journeyId);
  const { data: expenses = [] } = useExpensesQuery(journeyId);

  const summary = useMemo(() => {
    if (!expenses.length) return null;

    const byCategory: Record<string, number> = {};
    let lateNight = 0;
    for (const e of expenses) {
      const category = e.category ?? '기타';
      byCategory[category] = (byCategory[category] ?? 0) + e.amountLocal;
      if (hourOf(e.paidAt) >= 22) lateNight += 1;
    }

    const top = Object.entries(byCategory).sort((a, b) => b[1] - a[1])[0];
    const topCat = top?.[0] ?? '기타';
    const topRatio = top
      ? Math.round((top[1] / Object.values(byCategory).reduce((a, v) => a + v, 0)) * 100)
      : 0;
    const lateRatio = Math.round((lateNight / Math.max(expenses.length, 1)) * 100);

    const title =
      topCat === '식비'
        ? '밤을 잊은 미식가'
        : topCat === '쇼핑'
          ? '살까 말까? 사버린 타입'
          : '기록하는 여행자';

    return { title, topCat, topRatio, lateRatio };
  }, [expenses]);

  if (!journey) return null;

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
            {summary ? `"${summary.title}"` : '"아직 데이터가 없어요"'}
          </h3>
          {summary ? (
            <p className="text-sm font-bold leading-relaxed text-slate-600">
              이번 여행은 <span className="font-black text-blue-600">{summary.topCat}</span> 비중이{' '}
              <span className="font-black text-blue-600">{summary.topRatio}%</span>로 가장 높아요.
              {summary.lateRatio >= 35 ? (
                <>
                  {' '}
                  또 밤 10시 이후 지출이{' '}
                  <span className="font-black text-blue-600">{summary.lateRatio}%</span>로 많은
                  편이에요.
                </>
              ) : null}
            </p>
          ) : (
            <p className="text-sm font-bold leading-relaxed text-slate-500">
              영수증을 몇 개만 찍으면 바로 스타일이 나와요.
            </p>
          )}
        </section>

        <section className="rounded-3xl border border-slate-100 bg-white p-6">
          <p className="text-[10px] font-black uppercase tracking-widest text-slate-300">
            Quick facts
          </p>
          <div className="mt-3 grid grid-cols-2 gap-3">
            <div className="rounded-2xl bg-slate-50 p-4">
              <p className="text-[10px] font-black uppercase tracking-widest text-slate-300">
                영수증 수
              </p>
              <p className="mt-2 text-lg font-black text-slate-900">{expenses.length}개</p>
            </div>
            <div className="rounded-2xl bg-slate-50 p-4">
              <p className="text-[10px] font-black uppercase tracking-widest text-slate-300">
                밤 10시 이후
              </p>
              <p className="mt-2 text-lg font-black text-slate-900">
                {expenses.filter((e) => hourOf(e.paidAt) >= 22).length}개
              </p>
            </div>
          </div>
        </section>
      </main>
    </div>
  );
}
