import { ChevronRight, Plane, Plus, X } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import type { CurrencyCode, RateMode } from '@/types/common';
import { TopBar } from '@/components/layout/TopBar';
import {
  useCreateJourneyMutation,
  useDeleteJourneyMutation,
  useJourneyQuery,
  useUpdateJourneyMutation,
} from '@/features/journeys/queries';
import { demoRateForCurrency } from '@/lib/currencyRates';
import { useAuth } from '@/features/auth/useAuth';

const CURRENCIES: { code: CurrencyCode; label: string }[] = [
  { code: 'JPY', label: 'JPY (엔)' },
  { code: 'USD', label: 'USD (달러)' },
  { code: 'EUR', label: 'EUR (유로)' },
  { code: 'KRW', label: 'KRW (원)' },
];

export function JourneyCreatePage() {
  const nav = useNavigate();
  const { journeyId } = useParams<{ journeyId?: string }>();
  const isEdit = Boolean(journeyId);

  const { data: existingJourney } = useJourneyQuery(isEdit ? journeyId : undefined);
  const createJourney = useCreateJourneyMutation();
  const updateJourneyMut = useUpdateJourneyMutation();
  const deleteJourneyMut = useDeleteJourneyMutation();
  const { user } = useAuth();
  const authName = user?.name?.trim() ?? '나';

  const today = useMemo(() => new Date().toISOString().slice(0, 10), []);

  const [name, setName] = useState('');
  const [destination, setDestination] = useState('');
  const [country, setCountry] = useState('한국');
  const [currency, setCurrency] = useState<CurrencyCode>('JPY');
  const [rateMode, setRateMode] = useState<RateMode>('fixed');
  const [fixedRate, setFixedRate] = useState<number | ''>(9.0);
  const [participants, setParticipants] = useState<string[]>(['나', '지수', '민호']);
  const [newParticipant, setNewParticipant] = useState('');
  const [dates, setDates] = useState({ start: today, end: today });
  const [hydratedFromId, setHydratedFromId] = useState<string | null>(null);

  // journeyId 바뀌면 hydrate 플래그 리셋 (effect 대신 렌더 중 비교)
  const [prevJourneyId, setPrevJourneyId] = useState(journeyId);
  if (prevJourneyId !== journeyId) {
    setPrevJourneyId(journeyId);
    setHydratedFromId(null);
  }

  useEffect(() => {
    if (!isEdit || !existingJourney) return;
    if (hydratedFromId === existingJourney.id) return;

    setName(existingJourney.name);
    setCountry(existingJourney.country);
    setDestination('');
    setCurrency(existingJourney.currency);
    setRateMode(existingJourney.rateMode);
    setFixedRate(
      existingJourney.rateMode === 'fixed'
        ? existingJourney.rate
        : demoRateForCurrency(existingJourney.currency),
    );
    setDates({ start: existingJourney.startDate, end: existingJourney.endDate });
    setParticipants(existingJourney.participants.length ? existingJourney.participants : ['나']);
    setHydratedFromId(existingJourney.id);
  }, [isEdit, existingJourney, hydratedFromId]);

  useEffect(() => {
    setParticipants((prev) => {
      const trimmed = authName || '나';
      const list = prev.length ? prev : ['나'];
      if (list.includes(trimmed)) {
        return [trimmed, ...list.filter((x) => x !== trimmed)];
      }
      return [trimmed, ...list];
    });
  }, [authName]);

  const infer = (text: string) => {
    const t = text.toLowerCase();
    const has = (...keywords: string[]) => keywords.some((k) => t.includes(k));
    if (has('한국', '서울', '부산', '제주', '강릉', '속초'))
      return { country: '한국', currency: 'KRW' as const, fixedRate: 1 };
    if (has('일본', '후쿠오카', '도쿄', '오사카', '교토', '삿포로', '나고야'))
      return { country: '일본', currency: 'JPY' as const, fixedRate: 9.0 };
    if (has('미국', '뉴욕', 'la', '샌프란시스코', '하와이', '라스베가스'))
      return { country: '미국', currency: 'USD' as const, fixedRate: 1350 };
    if (has('유럽', '프랑스', '파리', '이탈리아', '로마', '스페인', '바르셀로나'))
      return { country: '유럽', currency: 'EUR' as const, fixedRate: 1500 };
    return null;
  };

  useEffect(() => {
    if (isEdit) return;
    const seed = destination.trim() || name.trim();
    if (!seed) return;
    const r = infer(seed);
    if (!r) return;
    setCountry(r.country);
    setCurrency(r.currency);
    if (rateMode === 'fixed') setFixedRate(r.fixedRate);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [name, destination, isEdit]);

  const effectiveRate = (): number =>
    rateMode === 'fixed'
      ? typeof fixedRate === 'number'
        ? fixedRate
        : 0
      : demoRateForCurrency(currency);

  const saving =
    createJourney.isPending || updateJourneyMut.isPending || deleteJourneyMut.isPending;

  const handleSubmit = async () => {
    const safeName = name.trim() || destination.trim() || country || '새 여행';
    const rate = effectiveRate();
    const plist = participants.length ? participants : [authName || '나'];
    const selfN = authName || plist[0] || '나';

    if (isEdit && journeyId) {
      await updateJourneyMut.mutateAsync({
        id: journeyId,
        patch: {
          name: safeName,
          country,
          currency,
          rate,
          rateMode,
          startDate: dates.start,
          endDate: dates.end,
          participants: plist,
          selfParticipant: selfN,
        },
      });
      nav(`/journeys/${journeyId}`, { replace: true });
      return;
    }

    const id = String(Date.now());
    await createJourney.mutateAsync({
      id,
      name: safeName,
      country,
      currency,
      rate,
      rateMode,
      status: 'active',
      startDate: dates.start,
      endDate: dates.end,
      participants: plist,
      selfParticipant: selfN,
    });
    nav(`/journeys/${id}`);
  };
  async function handleDelete() {
    if (!journeyId) return;
    const ok = window.confirm('이 여행을 삭제하시겠어요?\n모든 소비 기록이 함께 사라집니다.');
    if (!ok) return;
    await deleteJourneyMut.mutateAsync(journeyId);
    nav('/', { replace: true });
  }

  return (
    <div className="min-h-dvh bg-white">
      <TopBar
        title={
          <span>
            {isEdit ? '여정 수정' : '여정의 시작'}
            <Plane className="ml-1 inline size-5 text-blue-500" />
          </span>
        }
        onBack={() => {
          if (isEdit && journeyId) nav(`/journeys/${journeyId}`);
          else nav('/');
        }}
      />

      <main className="space-y-8 px-6 pb-28">
        <section className="mt-2 grid grid-cols-2 gap-4">
          <div className="col-span-2">
            <label className="mb-2 block text-[10px] font-black uppercase tracking-widest text-slate-400">
              여행 이름
            </label>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="어디로 떠나시나요?"
              className="w-full rounded-2xl border border-slate-100 bg-slate-50 p-4 text-sm font-bold outline-none focus:border-blue-500"
            />
          </div>

          <div className="col-span-2">
            <div className="mb-2 flex items-center justify-between">
              <label className="block text-[10px] font-black uppercase tracking-widest text-slate-400">
                여행지(나라/도시)
              </label>
              <span className="rounded-full bg-slate-100 px-2 py-1 text-[10px] font-black text-slate-500">
                자동 인식: {country}
              </span>
            </div>
            <input
              value={destination}
              onChange={(e) => setDestination(e.target.value)}
              placeholder="예: 일본 후쿠오카"
              className="w-full rounded-2xl border border-slate-100 bg-slate-50 p-4 text-sm font-bold outline-none focus:border-blue-500"
            />
          </div>

          <div>
            <label className="mb-2 block text-[10px] font-black uppercase tracking-widest text-slate-400">
              출발일
            </label>
            <input
              type="date"
              value={dates.start}
              onChange={(e) => setDates({ ...dates, start: e.target.value })}
              className="w-full rounded-2xl border border-slate-100 bg-slate-50 p-4 text-sm font-bold outline-none"
            />
          </div>
          <div>
            <label className="mb-2 block text-[10px] font-black uppercase tracking-widest text-slate-400">
              도착일
            </label>
            <input
              type="date"
              value={dates.end}
              onChange={(e) => setDates({ ...dates, end: e.target.value })}
              className="w-full rounded-2xl border border-slate-100 bg-slate-50 p-4 text-sm font-bold outline-none"
            />
          </div>
        </section>

        <section className="grid grid-cols-2 gap-4">
          <div className="col-span-2">
            <label className="mb-2 block text-[10px] font-black uppercase tracking-widest text-slate-400">
              사용 통화
            </label>
            <div className="flex w-full items-center justify-between rounded-2xl border border-slate-100 bg-slate-50 p-4 text-sm font-bold">
              <select
                value={currency}
                onChange={(e) => setCurrency(e.target.value as CurrencyCode)}
                className="w-full bg-transparent outline-none"
              >
                {CURRENCIES.map((c) => (
                  <option key={c.code} value={c.code}>
                    {c.label}
                  </option>
                ))}
              </select>
              <ChevronRight className="ml-2 size-4 text-slate-300" />
            </div>
          </div>
        </section>

        <section className="space-y-4">
          <label className="block text-[10px] font-black uppercase tracking-widest text-slate-400">
            환율 적용 방식
          </label>
          <div className="grid grid-cols-2 gap-4">
            <button
              type="button"
              onClick={() => setRateMode('fixed')}
              className={`rounded-[24px] border-2 p-6 text-center transition-all ${rateMode === 'fixed' ? 'border-blue-600 bg-white shadow-lg shadow-blue-50' : 'border-slate-50 bg-slate-50'}`}
            >
              <div
                className={`text-base font-black ${rateMode === 'fixed' ? 'text-blue-600' : 'text-slate-400'}`}
              >
                고정 환율
              </div>
              <div
                className={`mt-1 text-[10px] font-bold ${rateMode === 'fixed' ? 'text-blue-300' : 'text-slate-300'}`}
              >
                환전가 기준
              </div>
            </button>
            <button
              type="button"
              onClick={() => setRateMode('realtime')}
              className={`rounded-[24px] border-2 p-6 text-center transition-all ${rateMode === 'realtime' ? 'border-blue-600 bg-white shadow-lg shadow-blue-50' : 'border-slate-50 bg-slate-50'}`}
            >
              <div
                className={`text-base font-black ${rateMode === 'realtime' ? 'text-blue-600' : 'text-slate-400'}`}
              >
                실시간 환율
              </div>
              <div
                className={`mt-1 text-[10px] font-bold ${rateMode === 'realtime' ? 'text-blue-300' : 'text-slate-300'}`}
              >
                매매기준율
              </div>
            </button>
          </div>

          {rateMode === 'realtime' && (
            <p className="rounded-2xl border border-slate-100 bg-slate-50 px-4 py-3 text-[11px] font-bold leading-relaxed text-slate-500">
              팀에서 정책 확정 후 API로 연결할 예정이에요. 지금은 합계·원화 표시용으로 통화별
              <span className="text-slate-700"> 데모 기준 환율</span>을 씁니다.
            </p>
          )}

          {rateMode === 'fixed' && (
            <div className="rounded-[28px] border border-blue-100 bg-blue-50 p-5">
              <label className="mb-2 block text-[10px] font-black uppercase tracking-widest text-blue-600">
                고정 환율 (현지 1단위 → KRW)
              </label>
              <div className="flex items-baseline gap-2">
                <input
                  type="number"
                  value={fixedRate}
                  onChange={(e) =>
                    setFixedRate(e.target.value === '' ? '' : Number(e.target.value))
                  }
                  className="w-full border-b-2 border-blue-200 bg-transparent text-3xl font-black text-blue-900 outline-none placeholder:text-blue-200"
                />
                <span className="font-black text-blue-600">KRW</span>
              </div>
            </div>
          )}
        </section>

        <section className="space-y-4">
          <label className="block text-center text-[10px] font-black uppercase tracking-widest text-slate-400">
            여행 멤버
          </label>
          <div className="flex flex-wrap items-center justify-center gap-2 rounded-[32px] border border-slate-100 bg-slate-50 p-6">
            {participants.map((p) => (
              <div
                key={p}
                className="flex items-center gap-2 rounded-full border border-slate-100 bg-white px-4 py-2 shadow-sm"
              >
                <span className="text-sm font-bold">{p}</span>
                <button
                  type="button"
                  onClick={() => setParticipants(participants.filter((x) => x !== p))}
                  className="text-slate-300 hover:text-red-400"
                  aria-label="참여자 삭제"
                >
                  <X className="size-4" />
                </button>
              </div>
            ))}
            <div className="flex items-center gap-2">
              <input
                value={newParticipant}
                onChange={(e) => setNewParticipant(e.target.value)}
                placeholder="이름 추가"
                className="w-28 rounded-full border border-slate-100 bg-white px-4 py-2 text-sm font-bold outline-none"
              />
              <button
                type="button"
                onClick={() => {
                  const v = newParticipant.trim();
                  if (!v) return;
                  if (participants.includes(v)) return;
                  setParticipants([...participants, v]);
                  setNewParticipant('');
                }}
                className="grid size-10 place-items-center rounded-full bg-blue-600 text-white shadow-lg shadow-blue-200 active:scale-90"
                aria-label="참여자 추가"
              >
                <Plus className="size-5" />
              </button>
            </div>
          </div>
        </section>
      </main>

      <div className="sticky bottom-0 bg-white p-6">
        {isEdit ? (
          <div className="grid grid-cols-2 gap-4">
            <button
              type="button"
              disabled={saving || !journeyId}
              onClick={handleDelete}
              className="w-full rounded-3xl bg-[#FF4D4D] py-5 text-xl font-black tracking-tight text-white shadow-xl shadow-red-100 active:scale-[0.99] disabled:opacity-50"
            >
              여정 삭제
            </button>
            <button
              type="button"
              disabled={saving}
              onClick={handleSubmit}
              className="w-full rounded-3xl bg-blue-600 py-5 text-xl font-black tracking-tight text-white shadow-xl shadow-blue-100 active:scale-[0.99] disabled:opacity-50"
            >
              {saving ? '저장 중…' : '변경 저장'}
            </button>
          </div>
        ) : (
          <button
            type="button"
            disabled={saving}
            onClick={handleSubmit}
            className="w-full rounded-3xl bg-blue-600 py-5 text-xl font-black tracking-tight text-white shadow-xl shadow-blue-100 active:scale-[0.99] disabled:opacity-50"
          >
            {saving ? '저장 중…' : '기록장 만들기'}
          </button>
        )}
      </div>
    </div>
  );
}
