import express from 'express';
import { chromium } from 'playwright';

const app = express();
app.use(express.json({ limit: '1mb' }));

// 기본값: 로컬 dev 서버
const FRONTEND_URL = process.env.FRONTEND_URL || 'http://localhost:5173';
const PORT = Number(process.env.SCREENSHOT_PORT || 8787);

function buildReportUrl(journeyId) {
  const u = new URL(`/journeys/${journeyId}/report`, FRONTEND_URL);
  // 캡처 전용 힌트(필요 시 프론트에서 상단/버튼 숨김 등 확장 가능)
  u.searchParams.set('capture', '1');
  return u.toString();
}

app.post('/__screenshot/report', async (req, res) => {
  try {
    const journeyId = String(req.body?.journeyId || '1');
    const url = buildReportUrl(journeyId);

    const browser = await chromium.launch();
    const ctx = await browser.newContext({
      viewport: { width: 430, height: 932 },
      deviceScaleFactor: 2,
    });

    // 로그인 통과(ProtectedRoute) + 데모 모드(백엔드 토큰 제거 → 로컬 정산 계산)
    await ctx.addInitScript(() => {
      localStorage.setItem('onboarding_done', 'true');
      localStorage.setItem(
        'tt_auth_v2',
        JSON.stringify({ status: 'logged_in', user: { id: 'demo-user', name: '데모' } }),
      );
      localStorage.removeItem('tt_access_token_v1');
    });

    const page = await ctx.newPage();
    await page.goto(url, { waitUntil: 'networkidle' });
    await page.waitForSelector('[data-tt-report-root]', { timeout: 30_000 });
    await page.waitForTimeout(300);

    const buf = await page.screenshot({ type: 'png', fullPage: true });

    await page.close();
    await ctx.close();
    await browser.close();

    res.setHeader('Content-Type', 'image/png');
    res.setHeader('Content-Disposition', `attachment; filename="travel-tick-report-${journeyId}.png"`);
    res.status(200).send(buf);
  } catch (e) {
    res.status(500).json({
      message: e instanceof Error ? e.message : 'Failed to create screenshot',
    });
  }
});

app.get('/__screenshot/health', (_, res) => res.status(200).send('ok'));

app.listen(PORT, () => {
  // eslint-disable-next-line no-console
  console.log(`Screenshot server listening on :${PORT} (FRONTEND_URL=${FRONTEND_URL})`);
});

