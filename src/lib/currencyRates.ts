import type { CurrencyCode } from '../types/types';

/** 실시간 환율 API 연동 전, 화면·합계용 데모 기준 (1 현지단위 → KRW) */
export function demoRateForCurrency(currency: CurrencyCode): number {
  switch (currency) {
    case 'JPY':
      return 9.0;
    case 'USD':
      return 1350;
    case 'EUR':
      return 1500;
    case 'KRW':
      return 1;
    default:
      return 1;
  }
}
