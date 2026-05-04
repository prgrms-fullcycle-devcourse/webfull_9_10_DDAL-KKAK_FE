import type { Journey } from '@/features/journeys/types';
import type { OcrParsedResult } from '@/features/ocr/ocrApi';
import type { OcrDraft } from '@/features/ocr/types';
import { nowLocalIso } from '@/lib/datetime';
import type { CurrencyCode } from '@/types/common';

const VALID_CURRENCY = new Set<string>(['JPY', 'USD', 'EUR', 'KRW']);

/** 서버 ISO 문자열 → 브라우저 로컬 기준 `YYYY-MM-DDTHH:mm` (표시/저장용 wall-clock 근사) */
function purchasedAtToPaidAtWallClock(iso: string): string {
  const s = iso.trim();
  if (!s) return nowLocalIso();
  const d = new Date(s);
  if (Number.isNaN(d.getTime())) {
    if (s.length >= 16 && s[10] === 'T') return s.slice(0, 16);
    return nowLocalIso();
  }
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function normalizeCurrency(code: string): CurrencyCode {
  const u = code.trim().toUpperCase();
  if (VALID_CURRENCY.has(u)) return u as CurrencyCode;
  return 'KRW';
}

export function buildOcrDraftFromParsed(journey: Journey, parsed: OcrParsedResult): OcrDraft {
  const self = journey.selfParticipant ?? journey.participants[0] ?? '나';
  const currency = normalizeCurrency(parsed.currency);

  return {
    storeName: parsed.merchantName.trim() || '지출',
    amountLocal: Number.isFinite(parsed.totalAmount) ? parsed.totalAmount : 0,
    currency,
    paidAt: purchasedAtToPaidAtWallClock(parsed.purchasedAt),
    category: '기타',
    splitMode: 'shared',
    splitWith: journey.participants.length ? [...journey.participants] : [self],
    method: 'card',
    payer: self,
    emoji: '🧾',
    comment: '',
  };
}

/** 여행 국가 라벨 → OCR `receiptLocale` (선택) */
export function countryToReceiptLocale(country: string): string | undefined {
  const c = country.trim();
  if (/일본|japan|jp/i.test(c)) return 'JP';
  if (/한국|대한민국|korea|kr/i.test(c)) return 'KR';
  if (/대만|taiwan|tw/i.test(c)) return 'TW';
  if (/중국|china|cn/i.test(c)) return 'CN';
  if (/미국|usa|us\b/i.test(c)) return 'US';
  return undefined;
}
