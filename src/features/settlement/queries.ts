import { useQuery } from '@tanstack/react-query';
import { loadAllExpenses } from '@/features/expenses/storage';
import { loadJourneys } from '@/features/journeys/storage';
import { fetchSettlement, fetchSettlementSummary, type SettlementData, type SettlementSummaryData } from './api';
import { calcSettlement, ledgerSelfName, sumMySpendLocal, sumMySpendKRW } from './calc';

/**
 * 토큰 있으면 백엔드 정산 API, 없으면 localStorage 기반 로컬 계산.
 * 데모 모드(데모 사용자 진입)에서도 결산표가 정상 동작하도록.
 */
function hasBackendAuth(): boolean {
  return !!localStorage.getItem('tt_access_token_v1');
}

/**
 * 로컬 calcSettlement 결과 → 백엔드 SettlementData 스키마로 변환.
 * 화면 코드(ReportPage)는 이 스키마 하나만 알면 두 모드 모두 동작.
 */
function buildLocalSettlement(tripId: string): SettlementData {
  const journey = loadJourneys().find((j) => j.id === tripId);
  if (!journey) throw new Error('여정을 찾을 수 없어요.');
  const expenses = loadAllExpenses().filter((e) => e.journeyId === tripId);

  const data = calcSettlement(journey, expenses);
  const totalLocal = expenses.reduce((sum, e) => sum + e.amountLocal, 0);
  const totalAmountKrw = Math.round(totalLocal * journey.rate);

  // 참가자별 paid / share / net 계산 (calc.ts에 paid/owed 직접 노출 안 돼서 재계산)
  const people = journey.participants.length ? journey.participants : ['나'];
  const settlementSummary = people.map((p) => {
    const totalPaidLocal = expenses
      .filter((e) => e.payer === p)
      .reduce((sum, e) => sum + e.amountLocal, 0);
    const owedLocal = expenses.reduce((sum, e) => {
      if (e.splitMode === 'personal') {
        return sum + (e.payer === p ? e.amountLocal : 0);
      }
      const splitPeople = e.splitWith.filter((x) => people.includes(x));
      const list = splitPeople.length ? splitPeople : people;
      const n = Math.max(list.length, 1);
      return sum + (list.includes(p) ? e.amountLocal / n : 0);
    }, 0);
    const netLocal = data.nets.find((n) => n.person === p)?.netLocal ?? 0;
    return {
      participantId: p, // 로컬엔 id 없어서 이름을 식별자로 사용
      name: p,
      totalPaidKrw: Math.round(totalPaidLocal * journey.rate),
      totalShareKrw: Math.round(owedLocal * journey.rate),
      netAmount: Math.round(netLocal * journey.rate),
    };
  });

  // transfers (from/to 이름 → sender/receiver 객체) 변환
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

/** 최종 정산 결과 조회 — 데모 모드면 localStorage, 인증 모드면 백엔드 API. */
export function useSettlementQuery(tripId: string | undefined) {
  return useQuery({
    queryKey: ['settlement', tripId],
    enabled: !!tripId,
    queryFn: async (): Promise<SettlementData> => {
      if (hasBackendAuth()) {
        try {
          return await fetchSettlement(tripId!);
        } catch {
          return buildLocalSettlement(tripId!);
        }
      }
      await new Promise((r) => setTimeout(r, 100));
      return buildLocalSettlement(tripId!);
    },
  });
}

/**
 * 메인 화면용 "나의 정산 요약" — 토큰 있으면 백엔드, 없으면 로컬 계산.
 */
function buildLocalSettlementSummary(tripId: string): SettlementSummaryData {
  const journey = loadJourneys().find((j) => j.id === tripId);
  if (!journey) throw new Error('여정을 찾을 수 없어요.');
  const expenses = loadAllExpenses().filter((e) => e.journeyId === tripId);

  const me = ledgerSelfName(journey);
  const mySpentLocal = sumMySpendLocal(journey, expenses);
  const mySpentKrw = Math.round(sumMySpendKRW(journey, expenses));
  const netLocal = calcSettlement(journey, expenses).nets.find((n) => n.person === me)?.netLocal ?? 0;
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

export function useSettlementSummaryQuery(tripId: string | undefined) {
  return useQuery({
    queryKey: ['settlementSummary', tripId],
    enabled: !!tripId,
    queryFn: async (): Promise<SettlementSummaryData> => {
      if (hasBackendAuth()) {
        try {
          return await fetchSettlementSummary(tripId!);
        } catch {
          return buildLocalSettlementSummary(tripId!);
        }
      }
      await new Promise((r) => setTimeout(r, 80));
      return buildLocalSettlementSummary(tripId!);
    },
  });
}
