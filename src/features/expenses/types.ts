import type { CurrencyCode } from '@/types/common';

export type Expense = {
  id: string;
  journeyId: string;

  emoji: string;
  store: string;
  category: string;
  date: string; // YYYY-MM-DD
  time: string; // HH:mm

  amountLocal: number;
  currency: CurrencyCode;
  amountKRW?: number; // 저장 시점 스냅샷

  paidAt?: string; // ISO datetime

  payer: string; // 참여자 이름 (journey.participants 중 하나)

  // 기존 화면/정산 로직 호환
  type: 'shared' | 'private';
  splitAmong?: number;
  splitWith?: string[]; // 분담하는 사람 이름 배열
  // shared면 나눠내는 사람들 (payer 포함)

  method: 'cash' | 'card';
  memo?: string;
  receiptImageUrl?: string;
  createdAt?: string;
  updatedAt?: string;

  // 신규 폼 스키마 호환 필드 (선택)
  storeName?: string;
  splitMode?: 'personal' | 'shared';
  comment?: string;
};
