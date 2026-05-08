import type { CurrencyCode } from '@/types/common';
import { apiFetch } from '@/lib/api';

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
    case 'CNY':
      return 190;
    default:
      return 1;
  }
}

type CurrencyRateItem = {
  id: string;
  quoteCode: CurrencyCode;
  rate: number;
  provider: string;
  expiresAt: string;
};

type CurrencyRatesData = {
  baseCode: CurrencyCode;
  fetchedAt: string;
  rates: CurrencyRateItem[];
};

const FX_CACHE_KEY = (base: CurrencyCode, symbols: CurrencyCode[]) =>
  `tt_fx_v1:${base}:${symbols.slice().sort().join(',')}`;

function parseMs(iso: string | undefined): number | null {
  if (!iso) return null;
  const t = new Date(iso).getTime();
  return Number.isFinite(t) ? t : null;
}

export async function fetchExchangeRates(params?: {
  base?: CurrencyCode;
  symbols?: CurrencyCode[];
}): Promise<CurrencyRatesData> {
  const base = params?.base ?? 'KRW';
  const symbols = (params?.symbols ?? []).filter((s) => s !== base);

  const qs = new URLSearchParams();
  if (base) qs.set('base', base);
  if (symbols.length) qs.set('symbols', symbols.join(','));

  const path = `/currencies${qs.toString() ? `?${qs.toString()}` : ''}`;
  return apiFetch<CurrencyRatesData>(path);
}

/**
 * 실시간 환율 조회 (1 현지단위 → KRW).
 * - `/currencies` 응답의 expiresAt 기준으로 sessionStorage 캐시.
 * - 실패 시 demoRateForCurrency로 fallback.
 */
export async function getRealtimeRate(
  quote: CurrencyCode,
  base: CurrencyCode = 'KRW',
): Promise<number> {
  if (quote === base) return 1;

  const key = FX_CACHE_KEY(base, [quote]);
  try {
    const cachedRaw = sessionStorage.getItem(key);
    if (cachedRaw) {
      const cached = JSON.parse(cachedRaw) as { expiresAt?: string; rate?: number };
      const exp = parseMs(cached.expiresAt);
      if (typeof cached.rate === 'number' && exp && exp > Date.now()) return cached.rate;
    }
  } catch {
    // ignore
  }

  try {
    const data = await fetchExchangeRates({ base, symbols: [quote] });
    const item = data.rates.find((r) => r.quoteCode === quote);
    if (!item || typeof item.rate !== 'number') return demoRateForCurrency(quote);
    try {
      sessionStorage.setItem(key, JSON.stringify({ expiresAt: item.expiresAt, rate: item.rate }));
    } catch {
      // ignore quota errors
    }
    return item.rate;
  } catch {
    return demoRateForCurrency(quote);
  }
}
