import type { CurrencyCode, RateMode } from '@/types/common';

export type Journey = {
  id: string;
  name: string;
  country: string;
  currency: CurrencyCode;
  rate: number;
  rateMode: RateMode;
  startDate: string;
  endDate: string;
  participants: string[];
  selfParticipant?: string;
  status: 'active' | 'planned' | 'ended';
  /**
   * 목표 예산(원화 기준). 설정 시 홈 카드에 남은 예산/진행률 표시.
   * undefined면 예산 블록 자체를 숨긴다.
   */
  budgetKRW?: number;
  /**
   * 결산표에서 사용자가 "송금 완료"로 마킹한 송금 건 식별자들.
   * key 포맷: `${from}->${to}-${amountLocal}` (calcSettlement transfers와 동일).
   * 현재 모든 transfers가 이 배열에 포함되면 정산 완료로 간주.
   * 지출이 변동되면 stale key가 남을 수 있지만 무해 (현재 transfers와 매칭만 검사).
   */
  settledTransferKeys?: string[];
};
