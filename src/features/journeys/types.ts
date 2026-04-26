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
};
