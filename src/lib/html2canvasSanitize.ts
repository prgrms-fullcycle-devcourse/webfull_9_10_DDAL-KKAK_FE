/**
 * html2canvas 1.x가 `oklch()`, `color-mix()`, `lab()` 등을 파싱하지 못해
 * "unsupported color function" 으로 실패하는 경우가 있어, 클론 문서에서만 해당 규칙이 담긴 스타일을 제거한다.
 * (캡처용 iframe 클론이므로 실제 페이지 DOM에는 영향 없음)
 */
export function stripUnsupportedColorStylesFromClone(clonedDoc: Document): void {
  clonedDoc.querySelectorAll('link[rel="stylesheet"]').forEach((el) => el.remove());
  clonedDoc.querySelectorAll('style').forEach((el) => {
    const t = el.textContent ?? '';
    if (
      t.includes('oklch(') ||
      t.includes('color-mix(') ||
      t.includes('lab(') ||
      t.includes('lch(')
    ) {
      el.remove();
    }
  });
}
