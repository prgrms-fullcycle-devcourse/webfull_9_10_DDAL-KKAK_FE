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
