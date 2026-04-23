export type Journey = {
  id: string;
  name: string;
  country: string;
  currency: CurrencyCode;
  rate: number; // 현지통화 -> KRW 환산 비율 (예: 1 JPY = 9.0 KRW)
  rateMode: RateMode;
  startDate: string; // YYYY-MM-DD
  endDate: string; // YYYY-MM-DD
  participants: string[];
  /** 1/n·개인지출 집계 시 "나"로 쓸 이름(participants 중 하나). 없으면 participants[0] */
  selfParticipant?: string;
  status: 'active' | 'planned' | 'ended';
};
