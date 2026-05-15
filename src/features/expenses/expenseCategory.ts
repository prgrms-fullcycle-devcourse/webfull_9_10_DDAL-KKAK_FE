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

export const API_TO_DISPLAY: Record<ExpenseCategoryCode, string> = {
  FOOD: '음식',
  SHOPPING: '쇼핑',
  TRANSPORT: '교통',
  TOUR: '투어',
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

/** 카테고리별 대표 이모지 */
export const CATEGORY_EMOJI: Record<ExpenseCategoryCode, string> = {
  FOOD: '🍽️',
  SHOPPING: '🛍️',
  TRANSPORT: '🚌',
  TOUR: '🎵',
  ETC: '➕',
};

/** 카테고리 선택 UI용 목록 (코드·라벨·이모지) */
export const CATEGORY_OPTIONS: { code: ExpenseCategoryCode; label: string; emoji: string }[] = [
  { code: 'FOOD', label: '음식', emoji: '🍽️' },
  { code: 'SHOPPING', label: '쇼핑', emoji: '🛍️' },
  { code: 'TRANSPORT', label: '교통', emoji: '🚌' },
  { code: 'TOUR', label: '투어', emoji: '🎵' },
  { code: 'ETC', label: '기타', emoji: '➕' },
];

/** 카테고리(한글 라벨 or API 코드) → 대표 이모지 */
export function emojiForCategory(category: string | undefined): string {
  if (!category) return '🧾';
  const code = toApiExpenseCategory(category);
  return CATEGORY_EMOJI[code] ?? '🧾';
}

/** 이모지 → 카테고리 코드 매핑 (ExpenseForm의 EMOJI_LIST 전체 커버) */
export const EMOJI_TO_CATEGORY: Record<string, ExpenseCategoryCode> = {
  // 식비 FOOD
  '🍜': 'FOOD', '🍣': 'FOOD', '🍕': 'FOOD', '🍔': 'FOOD', '🌮': 'FOOD',
  '🍱': 'FOOD', '🥗': 'FOOD', '🍰': 'FOOD', '🍩': 'FOOD', '🧁': 'FOOD',
  '🍺': 'FOOD', '🍵': 'FOOD', '☕': 'FOOD', '🥤': 'FOOD', '🧃': 'FOOD',
  '🍶': 'FOOD', '🥂': 'FOOD', '🍷': 'FOOD', '🧋': 'FOOD', '🍦': 'FOOD',
  // 쇼핑 SHOPPING
  '🛍️': 'SHOPPING', '👗': 'SHOPPING', '👟': 'SHOPPING', '💄': 'SHOPPING',
  '🎒': 'SHOPPING', '⌚': 'SHOPPING', '📱': 'SHOPPING', '💊': 'SHOPPING',
  '🧴': 'SHOPPING', '🪥': 'SHOPPING',
  // 교통 TRANSPORT
  '🚕': 'TRANSPORT', '🚌': 'TRANSPORT', '🚇': 'TRANSPORT', '✈️': 'TRANSPORT',
  '🚂': 'TRANSPORT', '🚢': 'TRANSPORT', '🛵': 'TRANSPORT', '🚁': 'TRANSPORT',
  '🚡': 'TRANSPORT', '🛺': 'TRANSPORT',
  // 관광 TOUR
  '🏨': 'TOUR', '🏖️': 'TOUR', '🎡': 'TOUR', '🎭': 'TOUR', '🏛️': 'TOUR',
  '🎬': 'TOUR', '🎮': 'TOUR', '🎵': 'TOUR', '🎨': 'TOUR', '🏄': 'TOUR',
  // 기타 ETC
  '💰': 'ETC', '🧾': 'ETC', '🎁': 'ETC', '🌸': 'ETC', '🗺️': 'ETC',
  '📸': 'ETC', '🔑': 'ETC', '🧳': 'ETC', '⛽': 'ETC', '🏥': 'ETC',
};

/** 이모지 → 한글 카테고리 라벨 (카테고리 state용) */
export function categoryForEmoji(emoji: string | undefined): string {
  if (!emoji) return '기타';
  const code = EMOJI_TO_CATEGORY[emoji] ?? 'ETC';
  return API_TO_DISPLAY[code];
}
