import { chromium } from 'playwright';
import fs from 'node:fs/promises';
import path from 'node:path';

function arg(name, fallback) {
  const idx = process.argv.indexOf(`--${name}`);
  if (idx === -1) return fallback;
  const v = process.argv[idx + 1];
  return v ?? fallback;
}

const baseUrl = arg('url', process.env.BASE_URL || 'http://localhost:5173');
const journeyId = arg('journeyId', process.env.JOURNEY_ID || '1');
const outDir = arg('outDir', process.env.OUT_DIR || 'artifacts');

const targetUrl = new URL(`/journeys/${journeyId}/report`, baseUrl).toString();

await fs.mkdir(outDir, { recursive: true });
const outPath = path.join(outDir, `report-${journeyId}.png`);

const browser = await chromium.launch();
const context = await browser.newContext({
  viewport: { width: 430, height: 932 }, // iPhone-ish canvas size
  deviceScaleFactor: 2,
});

// ProtectedRoute를 통과하기 위해 "로그인 상태"만 localStorage에 주입.
// 토큰은 넣지 않아 정산은 로컬(mock) 계산 경로(useSettlementQuery)로 동작.
await context.addInitScript(() => {
  localStorage.setItem('onboarding_done', 'true');
  localStorage.setItem(
    'tt_auth_v2',
    JSON.stringify({
      status: 'logged_in',
      user: { id: 'demo-user', name: '데모' },
    }),
  );
  localStorage.removeItem('tt_access_token_v1');
});

const page = await context.newPage();
await page.goto(targetUrl, { waitUntil: 'networkidle' });

// 리포트 렌더 완료 대기
await page.waitForSelector('[data-tt-report-root]', { timeout: 30_000 });
await page.waitForTimeout(300); // 폰트/레이아웃 안정화

await page.screenshot({ path: outPath, fullPage: true });

await page.close();
await context.close();
await browser.close();

console.log(`Saved: ${outPath}`);

