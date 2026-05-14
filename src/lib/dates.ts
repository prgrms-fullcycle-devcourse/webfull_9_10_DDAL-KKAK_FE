/**
 * `YYYY-MM-DD`만 있을 때 `new Date("2026-05-12")`는 UTC 자정이라 KST 등에서는
 * 같은 달력 날이 로컬 자정보다 늦게 잡혀 "다가오는 여행"으로 오분류된다.
 * 달력 기준 비교는 로컬 0시로 맞춘다.
 */
function startOfLocalDayFromDateKey(dateKey: string): Date {
  const trimmed = dateKey.trim().slice(0, 10);
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(trimmed);
  if (m) {
    const y = Number(m[1]);
    const mo = Number(m[2]) - 1;
    const d = Number(m[3]);
    return new Date(y, mo, d, 0, 0, 0, 0);
  }
  const fallback = new Date(dateKey);
  if (!Number.isNaN(fallback.getTime())) {
    fallback.setHours(0, 0, 0, 0);
    return fallback;
  }
  return new Date(NaN);
}

export function getTripStatusLabel(startDate: string, endDate: string) {
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const start = startOfLocalDayFromDateKey(startDate);
  const end = startOfLocalDayFromDateKey(endDate);

  if (today < start) {
    const diffTime = start.getTime() - today.getTime();
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    return { label: `D-${diffDays}`, tone: 'planned' as const, text: '여행 준비 중' };
  }

  if (today <= end) {
    const diffTime = today.getTime() - start.getTime();
    const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24)) + 1;
    return { label: `${diffDays}일차`, tone: 'active' as const, text: '여행 중' };
  }

  return { label: '종료', tone: 'ended' as const, text: '지난 여행' };
}

/** 대시보드 섹션 분류용 */
export type JourneyPhase = 'ongoing' | 'upcoming' | 'past';

export function getJourneyPhase(startDate: string, endDate: string): JourneyPhase {
  const s = getTripStatusLabel(startDate, endDate);
  if (s.tone === 'planned') return 'upcoming';
  if (s.tone === 'active') return 'ongoing';
  return 'past';
}

/** API `status`와 무관하게 달력만으로 여행 단계를 맞출 때 (백엔드 기본값 active 오분류 방지) */
export type JourneyCalendarStatus = 'planned' | 'active' | 'ended';

export function journeyStatusFromDates(
  startDate: string,
  endDate: string,
): JourneyCalendarStatus | null {
  const start = startOfLocalDayFromDateKey(startDate);
  const end = startOfLocalDayFromDateKey(endDate);
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) return null;
  return getTripStatusLabel(startDate, endDate).tone;
}

/** 여행 총 일수 (시작일/종료일 포함) */
export function getTripDays(startDate: string, endDate: string): number {
  const s = startOfLocalDayFromDateKey(startDate);
  const e = startOfLocalDayFromDateKey(endDate);
  if (Number.isNaN(s.getTime()) || Number.isNaN(e.getTime())) return 1;
  const diff = Math.floor((e.getTime() - s.getTime()) / 86_400_000) + 1;
  return Math.max(1, diff);
}

/** 여행 시작일부터 오늘까지 경과 일수 (1일차부터). 시작 전이면 0, 종료 후면 총 일수. */
export function getElapsedDays(startDate: string, endDate: string): number {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const s = startOfLocalDayFromDateKey(startDate);
  const e = startOfLocalDayFromDateKey(endDate);
  if (today < s) return 0;
  if (today > e) return getTripDays(startDate, endDate);
  return Math.floor((today.getTime() - s.getTime()) / 86_400_000) + 1;
}
