import type { CurrencyCode, ExpenseType, PaymentMethod } from '@/types/common';

export type OcrDraft = {
  store: string;
  amountLocal: number;
  currency: CurrencyCode;
  time: string;
  category: string;
  type: ExpenseType;
  /** 공동일 때 n명 1/n (기본: 동행자 수) */
  splitAmong?: number;
  /** 공동일 때: 같이 나눌 사람 목록 */
  splitWith?: string[];
  method?: PaymentMethod;
  payer: string;
  emoji: string;
  memo: string;
};
