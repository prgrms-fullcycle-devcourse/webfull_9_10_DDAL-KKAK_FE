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
};
