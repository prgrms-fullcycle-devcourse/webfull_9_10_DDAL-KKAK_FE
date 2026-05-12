import { ArrowRight, Check, ChevronRight, Coins, ImageDown, Sparkles, Users } from 'lucide-react';
import html2canvas from 'html2canvas';
import { useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { TopBar } from '@/components/layout/TopBar';
import { useJourneyQuery, useUpdateJourneyMutation } from '@/features/journeys/queries';
import { ledgerSelfName } from '@/features/settlement/calc';
import { useSettlementQuery } from '@/features/settlement/queries';
import { formatKRW, formatLocal } from '@/lib/money';

export function ReportPage() {
  const nav = useNavigate();
  const { journeyId } = useParams();
  const { data: journey } = useJourneyQuery(journeyId);
  const {
    data: settlement,
    isPending: settlementPending,
    isError: settlementError,
    error: settlementErrorObj,
  } = useSettlementQuery(journeyId);
  const reportRef = useRef<HTMLDivElement | null>(null);
  const [isCapturing, setIsCapturing] = useState(false);
  const updateJourneyMut = useUpdateJourneyMutation();

  // 영속화된 송금 완료 키 (Journey.settledTransferKeys에서 직접 읽음)
  const doneKeys = new Set(journey?.settledTransferKeys ?? []);

  // 백엔드 송금 식별자: sender.id → receiver.id @ amount
  const transferKeyOf = (sender: string, receiver: string, amount: number) =>
    `${sender}->${receiver}@${amount}`;

  const toggleDone = (key: string) => {
    if (!journey) return;
    const current = new Set(journey.settledTransferKeys ?? []);
    if (current.has(key)) {
      current.delete(key);
    } else {
      current.add(key);
    }
    updateJourneyMut.mutate({
      id: journey.id,
      patch: { settledTransferKeys: Array.from(current) },
    });
  };

  // 로딩 중 → 스켈레톤
  if (!journey || settlementPending) return <ReportSkeleton />;

  // 정산 API 실패 (403/404/500 등) → 에러 화면
  if (settlementError || !settlement) {
    return (
      <div className="min-h-dvh bg-white">
        <TopBar title="최종 정산 리포트" backTo={`/journeys/${journey.id}`} />
        <main className="grid place-items-center px-6 pt-24">
          <div className="text-center">
            <p className="text-sm font-black text-slate-900">정산 결과를 가져올 수 없어요</p>
            <p className="mt-2 text-xs font-bold text-slate-400">
              {settlementErrorObj instanceof Error
                ? settlementErrorObj.message
                : '잠시 후 다시 시도해주세요.'}
            </p>
            <button
              type="button"
              onClick={() => nav(`/journeys/${journey.id}`)}
              className="mt-8 cursor-pointer rounded-2xl bg-blue-600 px-6 py-3 text-sm font-black text-white active:scale-95"
            >
              타임라인으로 돌아가기
            </button>
          </div>
        </main>
      </div>
    );
  }

  const selfName = ledgerSelfName(journey);

  // 총액 — API의 KRW 기준이 source of truth
  const totalKRW = settlement.totalAmountKrw;
  // 현지 통화 환산 — 환율 있으면 보조 표시
  const totalLocal = journey.rate ? totalKRW / journey.rate : null;

  // 송금 진행률 — settledTransferKeys 기준
  const totalTransfers = settlement.remittances.length;
  const settledTransfers = settlement.remittances.filter((r) =>
    doneKeys.has(transferKeyOf(r.sender.id, r.receiver.id, r.amount)),
  ).length;

  // 인원별 소비 내역 — API 응답 그대로 사용 (결제 큰 순 정렬)
  const perPerson = [...settlement.settlementSummary]
    .sort((a, b) => b.totalPaidKrw - a.totalPaidKrw)
    .map((p) => ({
      participantId: p.participantId,
      person: p.name,
      paidKRW: p.totalPaidKrw,
      paidLocal: journey.rate ? p.totalPaidKrw / journey.rate : null,
      netKRW: p.netAmount,
      netLocal: journey.rate ? p.netAmount / journey.rate : null,
    }));

  // 환율 표시용 — JPY 같은 소단위 통화는 100 단위, USD/EUR 등은 1 단위로 표기
  const rateInfo = (() => {
    if (journey.currency === 'KRW') return null;
    const isSmallUnit = journey.currency === 'JPY';
    const base = isSmallUnit ? 100 : 1;
    return {
      baseLabel: `${base} ${journey.currency}`,
      converted: formatKRW(Math.round(base * journey.rate)),
      detail: isSmallUnit ? `1 ${journey.currency} ≈ ${journey.rate.toFixed(2)} KRW` : null,
      mode: journey.rateMode === 'fixed' ? '고정환율' : '실시간 환율',
    };
  })();

  const downloadBlob = (blob: Blob, filename: string) => {
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.rel = 'noopener';
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  };

  const handleCapture = async () => {
    const root = reportRef.current;
    if (!root) return;
    setIsCapturing(true);
    const filename = `travel-tick-report-${journey.id}.png`;

    const tryPlaywrightServer = async (): Promise<boolean> => {
      try {
        const res = await fetch('/__screenshot/report', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ journeyId: journey.id }),
        });
        if (!res.ok) return false;
        const ct = res.headers.get('Content-Type') || '';
        if (!ct.includes('image/png')) return false;
        const blob = await res.blob();
        downloadBlob(blob, filename);
        return true;
      } catch {
        return false;
      }
    };

    const tryClientCapture = async (): Promise<void> => {
      const canvas = await html2canvas(root, {
        scale: 2,
        useCORS: true,
        backgroundColor: '#ffffff',
        logging: false,
      });
      await new Promise<void>((resolve, reject) => {
        canvas.toBlob((blob) => {
          if (blob) {
            downloadBlob(blob, filename);
            resolve();
          } else reject(new Error('PNG 변환에 실패했어요.'));
        }, 'image/png');
      });
    };

    try {
      const ok = await tryPlaywrightServer();
      if (!ok) await tryClientCapture();
    } catch {
      alert(
        '이미지를 저장하지 못했어요. 고화질 캡처는 터미널에서 `npm run dev:screenshot-server`를 띄운 뒤 다시 시도해 주세요.',
      );
    } finally {
      setIsCapturing(false);
    }
  };

  return (
    <div className="min-h-dvh bg-white">
      <TopBar title="최종 정산 리포트" backTo={`/journeys/${journey.id}`} />

      <main className="px-6 pb-10">
        <div ref={reportRef} data-tt-report-root className="space-y-5 pb-6 pt-4">
          {/* 1. TOTAL — 다크 히어로 (백엔드 KRW 응답이 메인, 현지통화는 보조) */}
          <section className="rounded-[32px] bg-slate-900 p-7 text-white shadow-xl">
            {/* 여행 정체성 */}
            <div className="mb-5">
              <h2 className="text-xl font-black tracking-tight text-white">{journey.name}</h2>
              <p className="mt-1 text-[11px] font-bold tracking-tight text-white/50">
                {`${journey.startDate.replaceAll('-', '.')} ~ ${journey.endDate.replaceAll('-', '.')}`}
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
                  {formatKRW(totalKRW)}
                </h3>
                <span className="text-xl font-bold text-white/70">KRW</span>
              </div>
              {totalLocal != null && journey.currency !== 'KRW' ? (
                <p className="mt-1 text-[11px] font-bold text-white/40">
                  ≈ {formatLocal(totalLocal)} {journey.currency}
                </p>
              ) : null}
            </div>

            {/* 참가자 — settlement API의 summary 기반 */}
            <div className="mt-7">
              <p className="mb-2 flex items-center gap-1.5 text-[10px] font-black uppercase tracking-widest text-white/50">
                <span aria-hidden>👥</span>
                <span>Travelers · {settlement.settlementSummary.length}명</span>
              </p>
              <div className="flex flex-wrap gap-1.5">
                {settlement.settlementSummary.map((p) => {
                  const isMe = p.name === selfName;
                  return (
                    <span
                      key={p.participantId}
                      className={`rounded-full px-2.5 py-1 text-[10px] font-black tracking-tight ${
                        isMe ? 'bg-blue-500/25 text-blue-200' : 'bg-white/10 text-white/80'
                      }`}
                    >
                      {p.name}
                      {isMe && p.name !== '나' ? ' (나)' : ''}
                    </span>
                  );
                })}
              </div>
            </div>
          </section>

          {/* 2. 최적 정산 루트 — 최소 횟수 송금 (와이어프레임 기준) */}
          <section>
            <div className="mb-3 flex items-end justify-between px-1">
              <div>
                <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">
                  최적 정산 루트
                </p>
                <p className="mt-1 text-[11px] font-bold text-slate-500">
                  {totalTransfers === 0
                    ? '정산할 항목이 없어요'
                    : `최소 ${totalTransfers}번 송금으로 정산 완료`}
                </p>
              </div>
              {totalTransfers > 0 ? (
                <p className="text-[10px] font-bold text-slate-400">
                  {settledTransfers}/{totalTransfers} 완료
                </p>
              ) : null}
            </div>

            {settlement.remittances.length === 0 ? (
              <p className="rounded-2xl border border-slate-100 bg-slate-50 py-8 text-center text-[12px] font-bold text-slate-400">
                정산할 내역이 없어요. 모두 깔끔하게 끝났어요 🎉
              </p>
            ) : (
              <div className="space-y-2">
                {settlement.remittances.map((t) => {
                  const key = transferKeyOf(t.sender.id, t.receiver.id, t.amount);
                  const fromIsMe = t.sender.name === selfName;
                  const toIsMe = t.receiver.name === selfName;
                  const done = doneKeys.has(key);
                  const localAmount = journey.rate ? t.amount / journey.rate : null;
                  return (
                    <div
                      key={key}
                      className={`flex items-center justify-between rounded-2xl border px-4 py-3 transition-colors ${
                        done ? 'border-green-100 bg-green-50' : 'border-slate-100 bg-slate-50'
                      }`}
                    >
                      <div className="flex items-center gap-2 text-[12px] font-black tracking-tight">
                        <span
                          className={`rounded-md px-2 py-0.5 text-[10px] font-black ${
                            done
                              ? 'bg-green-200 text-green-700'
                              : fromIsMe
                                ? 'bg-[#FF4D4D] text-white'
                                : 'bg-white text-slate-700'
                          }`}
                        >
                          {t.sender.name}
                        </span>
                        <ArrowRight
                          className={`size-3 ${done ? 'text-green-400' : 'text-slate-400'}`}
                        />
                        <span
                          className={`rounded-md px-2 py-0.5 text-[10px] font-black ${
                            done
                              ? 'bg-green-200 text-green-700'
                              : toIsMe
                                ? 'bg-blue-500 text-white'
                                : 'bg-white text-slate-700'
                          }`}
                        >
                          {t.receiver.name}
                        </span>
                      </div>
                      <div className="flex items-center gap-3">
                        <div className="text-right">
                          <p
                            className={`text-sm font-black tracking-tight ${done ? 'text-green-600 line-through' : 'text-slate-900'}`}
                          >
                            {formatKRW(Math.round(t.amount))}
                            <span className="ml-0.5 text-[10px] font-bold opacity-60">원</span>
                          </p>
                          {localAmount != null && journey.currency !== 'KRW' ? (
                            <p
                              className={`text-[10px] font-bold ${done ? 'text-green-400 line-through' : 'text-slate-400'}`}
                            >
                              {formatLocal(localAmount)} {journey.currency}
                            </p>
                          ) : null}
                        </div>
                        <button
                          type="button"
                          onClick={() => toggleDone(key)}
                          className={`flex size-7 shrink-0 cursor-pointer items-center justify-center rounded-full border-2 transition-colors active:scale-95 ${
                            done
                              ? 'border-green-500 bg-green-500 text-white'
                              : 'border-slate-300 bg-white text-transparent'
                          }`}
                          aria-label="송금 완료"
                        >
                          <Check className="size-3.5" strokeWidth={3} />
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </section>

          {/* 3. 인원별 소비내역 — 각 멤버의 결제 + 정산 잔액 */}
          <section>
            <div className="mb-3 flex items-end justify-between px-1">
              <div>
                <p className="flex items-center gap-1.5 text-[10px] font-black uppercase tracking-widest text-slate-400">
                  <Users className="size-3" />
                  인원별 소비내역
                </p>
                <p className="mt-1 text-[11px] font-bold text-slate-500">
                  멤버별 결제 금액과 정산 잔액
                </p>
              </div>
            </div>

            {perPerson.length === 0 || perPerson.every((p) => p.paidKRW === 0) ? (
              <p className="rounded-2xl border border-slate-100 bg-slate-50 py-8 text-center text-[12px] font-bold text-slate-400">
                아직 기록된 지출이 없어요
              </p>
            ) : (
              <div className="space-y-2">
                {perPerson.map(
                  ({ participantId, person, paidLocal, paidKRW, netLocal, netKRW }) => {
                    const isMe = person === selfName;
                    const tone: 'credit' | 'debit' | 'none' =
                      netKRW > 0 ? 'credit' : netKRW < 0 ? 'debit' : 'none';
                    const netLabel =
                      tone === 'credit'
                        ? `+${formatKRW(Math.round(netKRW))}원 받을 돈`
                        : tone === 'debit'
                          ? `-${formatKRW(Math.abs(Math.round(netKRW)))}원 보낼 돈`
                          : '정산 완료';
                    const netColor =
                      tone === 'credit'
                        ? 'text-blue-600'
                        : tone === 'debit'
                          ? 'text-[#FF4D4D]'
                          : 'text-slate-400';
                    return (
                      <div
                        key={participantId}
                        className="flex items-center justify-between gap-3 rounded-2xl border border-slate-100 bg-white px-4 py-3"
                      >
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-1.5">
                            <span className="truncate text-sm font-black tracking-tight text-slate-900">
                              {person}
                            </span>
                            {isMe ? (
                              <span className="rounded bg-blue-100 px-1.5 py-0.5 text-[8px] font-black tracking-tighter text-blue-600">
                                나
                              </span>
                            ) : null}
                          </div>
                          <p className="mt-1 text-[10px] font-bold text-slate-400">
                            결제 {formatKRW(Math.round(paidKRW))}원
                            {paidLocal != null && journey.currency !== 'KRW' ? (
                              <span className="ml-1 text-slate-300">
                                ({formatLocal(paidLocal)} {journey.currency})
                              </span>
                            ) : null}
                          </p>
                        </div>
                        <div className="shrink-0 whitespace-nowrap text-right">
                          <p className={`text-xs font-black tracking-tight ${netColor}`}>
                            {netLabel}
                          </p>
                          {tone !== 'none' && netLocal != null && journey.currency !== 'KRW' ? (
                            <p className="mt-0.5 text-[10px] font-bold text-slate-300">
                              ({formatLocal(Math.abs(netLocal))} {journey.currency})
                            </p>
                          ) : null}
                        </div>
                      </div>
                    );
                  },
                )}
              </div>
            )}
          </section>

          {/* 4. 이번여행 적용환율 — fixed/realtime 모드 + 변환 정보 */}
          {rateInfo ? (
            <section className="rounded-2xl border border-slate-100 bg-slate-50 p-5">
              <div className="mb-3 flex items-center justify-between">
                <p className="flex items-center gap-1.5 text-[10px] font-black uppercase tracking-widest text-slate-400">
                  <Coins className="size-3" />
                  이번여행 적용환율
                </p>
                <span
                  className={`rounded-full px-2 py-0.5 text-[9px] font-black tracking-tight ${
                    journey.rateMode === 'fixed'
                      ? 'bg-blue-100 text-blue-600'
                      : 'bg-slate-200 text-slate-600'
                  }`}
                >
                  {rateInfo.mode}
                </span>
              </div>
              <div className="flex items-baseline gap-2">
                <p className="text-base font-black text-slate-900">
                  {rateInfo.baseLabel}
                  <span className="mx-2 text-slate-300">=</span>
                  <span className="text-blue-600">{rateInfo.converted}원</span>
                </p>
              </div>
              {rateInfo.detail ? (
                <p className="mt-1 text-[10px] font-bold tracking-tight text-slate-400">
                  {rateInfo.detail}
                </p>
              ) : null}
              <p data-tt-wrap className="mt-2 text-[10px] font-bold leading-relaxed text-slate-400">
                {journey.rateMode === 'fixed'
                  ? '여행 생성 시 입력한 환율로 모든 영수증을 환산합니다.'
                  : '환율 API 연동 전, 화면 표시용 데모 기준 환율입니다.'}
              </p>
            </section>
          ) : null}
        </div>

        {/* 5. AI 소비 성향 리포트 — 캡처 영역 밖, 별도 액션 카드 */}
        <button
          type="button"
          onClick={() => nav(`/journeys/${journey.id}/insight`)}
          className="mt-2 flex w-full cursor-pointer items-center justify-between rounded-2xl border border-blue-100 bg-blue-50/60 p-4 text-left active:scale-[0.99]"
        >
          <div className="flex items-center gap-3">
            <div className="grid size-10 shrink-0 place-items-center rounded-xl bg-blue-600 text-white shadow-sm shadow-blue-200">
              <Sparkles className="size-5" />
            </div>
            <div>
              <p className="text-sm font-black text-slate-900">AI 소비 성향 리포트 보기</p>
              <p className="mt-0.5 text-[11px] font-bold text-slate-500">
                이번 여행에서 어떤 소비 패턴을 보였는지 분석해드려요
              </p>
            </div>
          </div>
          <ChevronRight className="size-4 shrink-0 text-blue-600" />
        </button>

        {/* 6. 이미지로 저장하기 — 메인 컬러 (브랜드 블루) */}
        <button
          type="button"
          onClick={handleCapture}
          disabled={isCapturing}
          className="mt-3 flex w-full cursor-pointer items-center justify-center gap-2 rounded-2xl bg-blue-600 py-4 text-sm font-black text-white shadow-lg shadow-blue-200 active:scale-[0.99] disabled:cursor-not-allowed disabled:opacity-60"
        >
          <ImageDown className="size-4" />
          {isCapturing ? '이미지 만드는 중…' : '이미지로 저장하기'}
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

/**
 * ReportPage 로딩 중 스켈레톤.
 * - 다크 hero 카드 + 3-card 그리드 + 송금 루트 row + 정산 기준 카드 모사
 */
function ReportSkeleton() {
  return (
    <div className="min-h-dvh bg-white">
      {/* TopBar 스켈레톤 */}
      <header className="sticky top-0 z-20 border-b border-slate-100 bg-white/90 backdrop-blur">
        <div className="flex items-center gap-3 px-6 pb-5 pt-12">
          <div className="size-7 animate-pulse rounded-xl bg-slate-100" />
          <div className="h-4 w-32 animate-pulse rounded-lg bg-slate-100" />
        </div>
      </header>

      <main className="space-y-5 px-6 pb-10 pt-4">
        {/* 다크 hero 스켈레톤 */}
        <section className="animate-pulse rounded-[32px] bg-slate-900/10 p-7">
          <div className="mb-5 space-y-2">
            <div className="h-5 w-44 rounded-lg bg-slate-200" />
            <div className="h-3 w-36 rounded-lg bg-slate-200" />
          </div>
          <div className="mt-7 space-y-3">
            <div className="h-3 w-32 rounded-lg bg-slate-200" />
            <div className="h-12 w-48 rounded-xl bg-slate-200" />
            <div className="h-3 w-40 rounded-lg bg-slate-200" />
          </div>
          <div className="mt-7 space-y-2">
            <div className="h-3 w-28 rounded-lg bg-slate-200" />
            <div className="flex gap-1.5">
              <div className="h-6 w-12 rounded-full bg-slate-200" />
              <div className="h-6 w-12 rounded-full bg-slate-200" />
              <div className="h-6 w-12 rounded-full bg-slate-200" />
            </div>
          </div>
        </section>

        {/* 3-card 그리드 스켈레톤 */}
        <section className="grid grid-cols-3 gap-2">
          {[1, 2, 3].map((i) => (
            <div
              key={i}
              className="animate-pulse rounded-2xl border border-slate-100 bg-slate-50 p-4"
            >
              <div className="mb-2 h-3 w-12 rounded bg-slate-200" />
              <div className="mb-1 h-5 w-16 rounded bg-slate-200" />
              <div className="h-3 w-14 rounded bg-slate-100" />
            </div>
          ))}
        </section>

        {/* 송금 루트 스켈레톤 */}
        <section>
          <div className="mb-3 flex items-center justify-between px-1">
            <div className="h-3 w-16 animate-pulse rounded bg-slate-200" />
            <div className="h-3 w-12 animate-pulse rounded bg-slate-100" />
          </div>
          <div className="space-y-2">
            {[1, 2].map((i) => (
              <div
                key={i}
                className="flex items-center justify-between rounded-2xl border border-slate-100 bg-slate-50 px-4 py-3"
              >
                <div className="flex items-center gap-2">
                  <div className="h-5 w-10 animate-pulse rounded-md bg-slate-200" />
                  <div className="size-3 animate-pulse rounded bg-slate-200" />
                  <div className="h-5 w-10 animate-pulse rounded-md bg-slate-200" />
                </div>
                <div className="space-y-1.5">
                  <div className="ml-auto h-4 w-16 animate-pulse rounded bg-slate-200" />
                  <div className="ml-auto h-3 w-12 animate-pulse rounded bg-slate-100" />
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* 정산 기준 카드 스켈레톤 */}
        <section className="rounded-2xl border border-slate-100 bg-slate-50 p-5">
          <div className="space-y-2">
            <div className="h-3 w-24 animate-pulse rounded bg-slate-200" />
            <div className="h-4 w-44 animate-pulse rounded bg-slate-200" />
          </div>
        </section>
      </main>
    </div>
  );
}
