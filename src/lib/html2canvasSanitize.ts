/**
 * html2canvas 1.x가 `oklch()`, `color-mix()` 등을 파싱하지 못해 실패할 수 있어,
 * 캡처용 클론 문서의 CSS 문자열만 안전한 값으로 바꾼다. (외부 stylesheet 링크는 제거하지 않음)
 */

const DANGEROUS_COLOR_CSS = /oklch|color-mix|\blab\(|\blch\(|\bhwb\(|display-p3|color\(display-p3/i;

/** `func(` … 짝 맞는 `)` 까지 한 덩어를 `replacement`으로 바꾼다 (중첩 괄호 대응). */
function replaceCssFunctionCalls(css: string, name: string, replacement: string): string {
  const needle = `${name.toLowerCase()}(`;
  let i = 0;
  let out = '';
  const lower = css.toLowerCase();
  while (i < css.length) {
    const idx = lower.indexOf(needle, i);
    if (idx === -1) {
      out += css.slice(i);
      break;
    }
    out += css.slice(i, idx);
    const open = idx + needle.length - 1;
    let depth = 0;
    let j = open;
    for (; j < css.length; j++) {
      const ch = css[j];
      if (ch === '(') depth++;
      else if (ch === ')') {
        depth--;
        if (depth === 0) {
          j++;
          break;
        }
      }
    }
    out += replacement;
    i = j;
  }
  return out;
}

function neutralizeModernColorCss(css: string): string {
  let s = css;
  s = replaceCssFunctionCalls(s, 'oklch', 'rgb(100, 116, 139)');
  s = replaceCssFunctionCalls(s, 'color-mix', 'rgb(148, 163, 184)');
  s = replaceCssFunctionCalls(s, 'lab', 'rgb(100, 116, 139)');
  s = replaceCssFunctionCalls(s, 'lch', 'rgb(100, 116, 139)');
  s = replaceCssFunctionCalls(s, 'hwb', 'rgb(100, 116, 139)');
  s = s.replace(/color\(display-p3[^)]*\)/gi, 'rgb(100, 116, 139)');
  return s;
}

function sanitizeInlineStyleAttr(style: string): string {
  if (!DANGEROUS_COLOR_CSS.test(style)) return style;
  return neutralizeModernColorCss(style);
}

/**
 * html2canvas `onclone(document)` · dom-to-image `onclone(root)` 공통.
 * 스타일시트 링크는 유지하고, 인라인 `<style>`·`style=""` 안의 현대 색 함수만 중화한다.
 */
export function stripUnsupportedColorStylesFromClone(clonedDoc: Document): void {
  clonedDoc.querySelectorAll('style').forEach((el) => {
    const t = el.textContent ?? '';
    if (!DANGEROUS_COLOR_CSS.test(t)) return;
    el.textContent = neutralizeModernColorCss(t);
  });
  clonedDoc.querySelectorAll('[style]').forEach((el) => {
    const s = el.getAttribute('style') ?? '';
    if (!DANGEROUS_COLOR_CSS.test(s)) return;
    const next = sanitizeInlineStyleAttr(s).trim();
    if (next) el.setAttribute('style', next);
    else el.removeAttribute('style');
  });
}
