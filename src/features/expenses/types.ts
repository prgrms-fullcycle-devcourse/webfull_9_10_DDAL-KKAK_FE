import type { CurrencyCode } from '@/types/common';

export type Expense = {
  id: string;
  journeyId: string;
  payerParticipantId?: string;

  emoji: string;
  storeName: string;
  category?: string;

  amountLocal: number;
  currency: CurrencyCode;
  /**
   * 현지 wall-clock ("YYYY-MM-DDTHH:mm:ss"). timezone 변환 없이 문자열 그대로 저장·표시.
   * 표시는 @/lib/datetime 의 dateKeyOf / timeLabelOf / hourOf 로만.
   */
  paidAt: string;

  payer: string;

  splitMode: 'personal' | 'shared';
  splitWith: string[];

  method: 'cash' | 'card';
  comment?: string;
  receiptId?: string;
  receiptImageUrl?: string;
  fxMode?: 'FIXED' | 'REALTIME';
  fxRateTripToKrw?: number;
  amountKrw?: number;

  createdAt: string;
  updatedAt: string;
};
