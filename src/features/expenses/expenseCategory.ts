/** 백엔드 ExpenseCategory enum과 동일 */
export const EXPENSE_CATEGORY_CODES = ['FOOD', 'SHOPPING', 'TRANSPORT', 'TOUR', 'ETC'] as const;
export type ExpenseCategoryCode = (typeof EXPENSE_CATEGORY_CODES)[number];

const API_CODE_SET = new Set<string>(EXPENSE_CATEGORY_CODES);

const LABEL_TO_API: Record<string, ExpenseCategoryCode> = {
  기타: 'ETC',
  식비: 'FOOD',
  음식: 'FOOD',
  식당: 'FOOD',
  카페: 'FOOD',
  커피: 'FOOD',
  쇼핑: 'SHOPPING',
  쇼핑비: 'SHOPPING',
  교통: 'TRANSPORT',
  교통비: 'TRANSPORT',
  관광: 'TOUR',
  여행: 'TOUR',
  액티비티: 'TOUR',
  투어: 'TOUR',
};

const API_TO_DISPLAY: Record<ExpenseCategoryCode, string> = {
  FOOD: '식비',
  SHOPPING: '쇼핑',
  TRANSPORT: '교통',
  TOUR: '관광',
  ETC: '기타',
};

/** POST/PATCH 요청용: UI·로컬 문자열 → 서버 enum */
export function toApiExpenseCategory(value: string | undefined): ExpenseCategoryCode {
  if (value === undefined || value === null) return 'ETC';
  const v = String(value).trim();
  if (!v) return 'ETC';
  if (API_CODE_SET.has(v)) return v as ExpenseCategoryCode;
  const lower = v.toLowerCase();
  if (lower === 'food') return 'FOOD';
  if (lower === 'shopping') return 'SHOPPING';
  if (lower === 'transport') return 'TRANSPORT';
  if (lower === 'tour') return 'TOUR';
  if (lower === 'etc') return 'ETC';
  return LABEL_TO_API[v] ?? 'ETC';
}

/** GET 응답 등: 서버 enum → 화면용 한글 라벨 */
export function displayExpenseCategory(code: string | undefined): string {
  if (code === undefined || code === null || !String(code).trim()) return '기타';
  const v = String(code).trim();
  if (API_CODE_SET.has(v)) return API_TO_DISPLAY[v as ExpenseCategoryCode] ?? '기타';
  return v;
}
