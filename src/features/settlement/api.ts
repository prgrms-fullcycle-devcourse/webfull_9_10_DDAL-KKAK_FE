import { apiFetch } from '@/lib/api';

/** 송금 한 건 — 누가 누구에게 얼마(KRW) 보낼지 */
export type SettlementRemittance = {
  sender: { id: string; name: string };
  receiver: { id: string; name: string };
  /** 한화 기준. 서버가 환산까지 끝낸 결과. */
  amount: number;
};

/** 참가자 1명의 정산 요약 */
export type SettlementParticipant = {
  participantId: string;
  name: string;
  /** 본인이 직접 결제한 총액 (KRW) */
  totalPaidKrw: number;
  /** 본인이 부담해야 하는 총액 (KRW) — 분담 결과 */
  totalShareKrw: number;
  /** 최종 손익. 양수=받을 돈, 음수=보낼 돈 */
  netAmount: number;
};

export type SettlementData = {
  tripId: string;
  /** 여행 전체 총 소비액 (KRW) */
  totalAmountKrw: number;
  remittances: SettlementRemittance[];
  settlementSummary: SettlementParticipant[];
};

export type SettlementSummaryData = {
  tripId: string;
  tripTitle: string;
  summary: {
    /** 내가 소비한 외화 총액(현지 통화) */
    totalSpentOriginal: number;
    currencyCode: string;
    /** 내가 소비한 금액의 한화 환산 총액 */
    totalSpentKrw: number;
    /** 최종 정산 예정액 (+ 받을 돈, - 줄 돈) */
    netAmountKrw: number;
  };
};

/**
 * 최종 정산 결과 조회.
 * 경로: GET /trips/{tripId}/settlement
 *
 * apiFetch가 백엔드 envelope({ success, status, data })을 자동으로 unwrap해서
 * data만 반환하므로 별도 처리 불필요.
 */
export async function fetchSettlement(tripId: string): Promise<SettlementData> {
  return apiFetch<SettlementData>(`/trips/${tripId}/settlement`);
}

/**
 * 나의 정산 요약 조회 (메인 카드/대시보드용)
 * 경로: GET /trips/{tripId}/settlement/summary
 */
export async function fetchSettlementSummary(tripId: string): Promise<SettlementSummaryData> {
  return apiFetch<SettlementSummaryData>(`/trips/${tripId}/settlement/summary`);
}
