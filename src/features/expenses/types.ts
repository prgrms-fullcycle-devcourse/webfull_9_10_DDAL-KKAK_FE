import type { CurrencyCode } from '@/types/common';

/** GET/POST/PATCH 응답의 splitWith 항목과 동일 */
export type ExpenseSplitParticipant = { participantId: string; name: string };

export type Expense = {
  id: string;
  journeyId: string;
  payerParticipantId?: string;
  /** 서버가 내려주는 결제자 표시명 (있으면 UI·정산에서 우선) */
  payerName?: string;

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
  /** 서버 splitWith (id+이름). 있으면 정산 시 이름 목록으로 우선 사용 */
  splitWithParticipants?: ExpenseSplitParticipant[];

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
