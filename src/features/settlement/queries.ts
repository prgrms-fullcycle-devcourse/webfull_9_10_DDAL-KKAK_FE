import { useQuery, useQueryClient, type QueryClient } from '@tanstack/react-query';
import { loadAllExpenses } from '@/features/expenses/storage';
import { fetchTrip, isMockMode } from '@/features/journeys/api';
import type { Journey } from '@/features/journeys/types';
import { loadJourneys, withEffectiveTripFinance } from '@/features/journeys/storage';
import { ApiError } from '@/lib/api';
import {
  fetchSettlement,
  fetchSettlementSummary,
  type SettlementData,
  type SettlementSummaryData,
} from './api';
import {
  calcSettlement,
  ledgerSelfName,
  splitNamesForExpense,
  sumMySpendLocal,
  sumMySpendKRW,
} from './calc';

/** 백엔드에 `GET …/settlement/summary`가 없을 때 매번 404가 찍히는 것을 줄이기 위해, 한 번 404면 이 SPA 세션에서는 요청 생략. */
const settlementSummaryUseLocalOnly = new Set<string>();

function shouldSkipSettlementSummaryFetch(tripId: string): boolean {
  if (import.meta.env.VITE_SKIP_SETTLEMENT_SUMMARY === 'true') return true;
  return settlementSummaryUseLocalOnly.has(tripId);
}

/**
 * 여행 API(`journeys/api`)와 동일한 기준: mock·비로그인 → 로컬 계산, 그 외 → 백엔드.
 * (토큰만 보고 API를 호출하면 VITE_USE_MOCK + 토큰 조합에서 여행은 로컬·정산만 API로 갈라짐)
 */

/**
 * 정산 API 404 등 로컬 폴백 시, API로만 존재하는 여행은 loadJourneys()에 없을 수 있음.
 * React Query 캐시 → 로컬 스토리지 → (인증 모드) GET /trips/:id 순으로 해결.
 */
async function resolveJourneyForLocalFallback(qc: QueryClient, tripId: string): Promise<Journey> {
  const cached = qc.getQueryData<Journey>(['journeys', tripId]);
  if (cached) return cached;
  const local = loadJourneys().find((j) => j.id === tripId);
  if (local) return local;
  if (!isMockMode()) return await fetchTrip(tripId);
  throw new Error('여정을 찾을 수 없어요.');
}

/**
 * 로컬 calcSettlement 결과 → 백엔드 SettlementData 스키마로 변환.
 * 화면 코드(ReportPage)는 이 스키마 하나만 알면 두 모드 모두 동작.
 */
function buildLocalSettlementFromJourney(journeyIn: Journey): SettlementData {
  const journey = withEffectiveTripFinance(journeyIn);
  const tripId = journey.id;
  const expenses = loadAllExpenses().filter((e) => e.journeyId === tripId);

  const data = calcSettlement(journey, expenses);
  const totalLocal = expenses.reduce((sum, e) => sum + e.amountLocal, 0);
  const totalAmountKrw = Math.round(totalLocal * journey.rate);

  const people = journey.participants.length ? journey.participants : ['나'];
  const settlementSummary = people.map((p) => {
    const totalPaidLocal = expenses
      .filter((e) => e.payer === p)
      .reduce((sum, e) => sum + e.amountLocal, 0);
    const owedLocal = expenses.reduce((sum, e) => {
      if (e.splitMode === 'personal') {
        return sum + (e.payer === p ? e.amountLocal : 0);
      }
      const splitPeople = splitNamesForExpense(e).filter((x) => people.includes(x));
      const list = splitPeople.length ? splitPeople : people;
      const n = Math.max(list.length, 1);
      return sum + (list.includes(p) ? e.amountLocal / n : 0);
    }, 0);
    const netLocal = data.nets.find((n) => n.person === p)?.netLocal ?? 0;
    return {
      participantId: p,
      name: p,
      totalPaidKrw: Math.round(totalPaidLocal * journey.rate),
      totalShareKrw: Math.round(owedLocal * journey.rate),
      netAmount: Math.round(netLocal * journey.rate),
    };
  });

  const remittances = data.transfers.map((t) => ({
    sender: { id: t.from, name: t.from },
    receiver: { id: t.to, name: t.to },
    amount: Math.round(t.amountLocal * journey.rate),
  }));

  return {
    tripId,
    totalAmountKrw,
    remittances,
    settlementSummary,
  };
}

function buildLocalSettlement(tripId: string): SettlementData {
  const journey = loadJourneys().find((j) => j.id === tripId);
  if (!journey) throw new Error('여정을 찾을 수 없어요.');
  return buildLocalSettlementFromJourney(journey);
}

/** 최종 정산 결과 조회 — 데모 모드면 localStorage, 인증 모드면 백엔드 API. */
export function useSettlementQuery(tripId: string | undefined, options?: { enabled?: boolean }) {
  const qc = useQueryClient();
  const extraEnabled = options?.enabled ?? true;
  return useQuery({
    queryKey: ['settlement', tripId],
    enabled: !!tripId && extraEnabled,
    queryFn: async (): Promise<SettlementData> => {
      if (isMockMode()) {
        await new Promise((r) => setTimeout(r, 100));
        return buildLocalSettlement(tripId!);
      }
      try {
        return await fetchSettlement(tripId!);
      } catch (e) {
        // 로컬 백엔드에 정산 라우트가 없거나(404)·권한/토큰(401·403)일 때도, 타임라인 캐시·로컬 여정이 있으면 클라이언트 정산표로 폴백
        if (
          e instanceof ApiError &&
          (e.status === 404 || e.status === 501 || e.status === 401 || e.status === 403)
        ) {
          const raw = await resolveJourneyForLocalFallback(qc, tripId!);
          return buildLocalSettlementFromJourney(raw);
        }
        throw e;
      }
    },
  });
}

/**
 * 메인 화면용 "나의 정산 요약" — 토큰 있으면 백엔드, 없으면 로컬 계산.
 */
function buildLocalSettlementSummaryFromJourney(journeyIn: Journey): SettlementSummaryData {
  const journey = withEffectiveTripFinance(journeyIn);
  const tripId = journey.id;
  const expenses = loadAllExpenses().filter((e) => e.journeyId === tripId);

  const me = ledgerSelfName(journey);
  const mySpentLocal = sumMySpendLocal(journey, expenses);
  const mySpentKrw = Math.round(sumMySpendKRW(journey, expenses));
  const netLocal =
    calcSettlement(journey, expenses).nets.find((n) => n.person === me)?.netLocal ?? 0;
  const netAmountKrw = Math.round(netLocal * journey.rate);

  return {
    tripId,
    tripTitle: journey.name,
    summary: {
      totalSpentOriginal: mySpentLocal,
      currencyCode: journey.currency,
      totalSpentKrw: mySpentKrw,
      netAmountKrw,
    },
  };
}

function buildLocalSettlementSummary(tripId: string): SettlementSummaryData {
  const journey = loadJourneys().find((j) => j.id === tripId);
  if (!journey) throw new Error('여정을 찾을 수 없어요.');
  return buildLocalSettlementSummaryFromJourney(journey);
}

export function useSettlementSummaryQuery(tripId: string | undefined) {
  const qc = useQueryClient();
  return useQuery({
    queryKey: ['settlementSummary', tripId],
    enabled: !!tripId,
    queryFn: async (): Promise<SettlementSummaryData> => {
      if (isMockMode()) {
        await new Promise((r) => setTimeout(r, 80));
        return buildLocalSettlementSummary(tripId!);
      }
      const id = tripId!;
      if (shouldSkipSettlementSummaryFetch(id)) {
        const journey = await resolveJourneyForLocalFallback(qc, id);
        return buildLocalSettlementSummaryFromJourney(journey);
      }
      try {
        return await fetchSettlementSummary(id);
      } catch (e) {
        if (e instanceof ApiError && (e.status === 404 || e.status === 501)) {
          settlementSummaryUseLocalOnly.add(id);
          const journey = await resolveJourneyForLocalFallback(qc, id);
          return buildLocalSettlementSummaryFromJourney(journey);
        }
        throw e;
      }
    },
  });
}
