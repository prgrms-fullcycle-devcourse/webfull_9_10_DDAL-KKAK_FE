export function getTripStatusLabel(startDate: string, endDate: string) {
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const start = new Date(startDate);
  const end = new Date(endDate);

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

/** 여행 총 일수 (시작일/종료일 포함) */
export function getTripDays(startDate: string, endDate: string): number {
  const s = new Date(startDate);
  const e = new Date(endDate);
  if (Number.isNaN(s.getTime()) || Number.isNaN(e.getTime())) return 1;
  const diff = Math.floor((e.getTime() - s.getTime()) / 86_400_000) + 1;
  return Math.max(1, diff);
}

/** 여행 시작일부터 오늘까지 경과 일수 (1일차부터). 시작 전이면 0, 종료 후면 총 일수. */
export function getElapsedDays(startDate: string, endDate: string): number {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const s = new Date(startDate);
  const e = new Date(endDate);
  if (today < s) return 0;
  if (today > e) return getTripDays(startDate, endDate);
  return Math.floor((today.getTime() - s.getTime()) / 86_400_000) + 1;
}
