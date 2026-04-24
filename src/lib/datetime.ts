/**
 * Travel-Tick의 paidAt 은 "현지 wall-clock" 으로 다룬다.
 * - 저장 형식: "YYYY-MM-DDTHH:mm[:ss[.sss]][Z]"  (뒤쪽 Z 유무는 무시)
 * - 절대로 new Date(...).toISOString() 으로 UTC 변환하지 않음.
 * - 표시는 문자열 슬라이스로 직접 뽑아서 timezone 영향을 0으로 만든다.
 *
 * 이렇게 하면: 도쿄 21:30 라멘은 어디서 열어도 21:30 으로 보인다.
 */

/** 지금 폰의 로컬 시각을 "YYYY-MM-DDTHH:mm" 으로 반환. datetime-local 기본값용. */
export function nowLocalIso(): string {
  const d = new Date();
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

/** paidAt → "YYYY-MM-DD" (그룹 키/라벨용). */
export function dateKeyOf(paidAt: string): string {
  return paidAt.slice(0, 10);
}

/** paidAt → "HH:mm" (표시용). */
export function timeLabelOf(paidAt: string): string {
  return paidAt.slice(11, 16);
}

/** paidAt 에서 시(hour)만 숫자로 (0-23). 인사이트의 밤/낮 분류 등에 사용. */
export function hourOf(paidAt: string): number {
  const h = Number(paidAt.slice(11, 13));
  return Number.isFinite(h) ? h : 0;
}

/** datetime-local 입력값("YYYY-MM-DDTHH:mm") 을 저장용으로 정규화. 초/밀리초는 00:00 으로 박아둔다. */
export function toStoredWallClock(localInputValue: string): string {
  // "2026-04-24T19:30" → "2026-04-24T19:30:00"
  // 이미 초까지 있으면 그대로 통과.
  if (/\d{2}:\d{2}:\d{2}/.test(localInputValue)) return localInputValue;
  return `${localInputValue}:00`;
}
