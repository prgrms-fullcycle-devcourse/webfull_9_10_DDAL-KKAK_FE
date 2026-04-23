export function formatKRW(value: number) {
  return new Intl.NumberFormat('ko-KR').format(Math.round(value));
}

export function formatLocal(value: number) {
  return new Intl.NumberFormat('ko-KR').format(Math.round(value));
}
