import type { CurrencyCode, PaymentMethod } from '@/types/common';

export type OcrDraft = {
  storeName: string;
  amountLocal: number;
  currency: CurrencyCode;
  /** 현지 wall-clock ("YYYY-MM-DDTHH:mm[:ss]"). UTC 변환 안 함. */
  paidAt: string;
  category: string;
  splitMode: 'shared' | 'personal';
  /** 공동일 때: 같이 나눌 사람 목록. shared면 splitWith.length가 1/n 기준. */
  splitWith?: string[];
  method?: PaymentMethod;
  payer: string;
  emoji: string;
  comment: string;
};
