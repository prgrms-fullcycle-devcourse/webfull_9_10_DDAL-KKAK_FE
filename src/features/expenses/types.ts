import type { CurrencyCode } from '@/types/common';

export type Expense = {
  id: string;
  journeyId: string;

  emoji: string;
  storeName: string;

  amountLocal: number;
  currency: CurrencyCode;
  amountKRW: number; // 저장 시점 스냅샷

  paidAt: string; // ISO datetime

  payer: string; // 참여자 이름 (journey.participants 중 하나)

  splitMode: 'personal' | 'shared';
  splitWith: string[]; // 분담하는 사람 이름 배열
  // personal이면 [payer] 혼자
  // shared면 나눠내는 사람들 (payer 포함)

  method: 'cash' | 'card';
  comment?: string;
  receiptImageUrl?: string;
  createdAt: string;
  updatedAt: string;
};
