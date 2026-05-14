import express from 'express';
import { chromium } from 'playwright';

const app = express();
app.use(express.json({ limit: '1mb' }));

// 기본값: 로컬 dev 서버 (배포 시 반드시 실제 프론트 URL로 설정)
const FRONTEND_URL = process.env.FRONTEND_URL || 'http://localhost:5173';
const PORT = Number(process.env.SCREENSHOT_PORT || 8787);
/** 설정 시 요청 헤더 `X-Screenshot-Secret`과 일치해야 함 (배포 남용 방지) */
const SCREENSHOT_SECRET = (process.env.SCREENSHOT_SECRET || '').trim();
/** 브라우저 Origin 허용. 예: `https://my-app.vercel.app` (쉼표로 여러 개) */
const SCREENSHOT_CORS_ORIGIN = (process.env.SCREENSHOT_CORS_ORIGIN || '*').trim();

const DEMO_AUTH_JSON = JSON.stringify({
  status: 'logged_in',
  user: { id: 'demo-user', name: '데모' },
});

app.use((req, res, next) => {
  const origin = req.headers.origin;
  if (SCREENSHOT_CORS_ORIGIN === '*') {
    res.setHeader('Access-Control-Allow-Origin', '*');
  } else if (origin) {
    const list = SCREENSHOT_CORS_ORIGIN.split(',').map((s) => s.trim()).filter(Boolean);
    if (list.includes(origin)) {
      res.setHeader('Access-Control-Allow-Origin', origin);
    }
  }
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, X-Screenshot-Secret');

  const allowed =
    SCREENSHOT_CORS_ORIGIN === '*' ||
    !origin ||
    SCREENSHOT_CORS_ORIGIN.split(',').map((s) => s.trim()).includes(origin);

  if (req.method === 'OPTIONS') {
    res.status(allowed ? 204 : 403).end();
    return;
  }
  if (!allowed && origin) {
    res.status(403).json({ message: 'Origin not allowed for screenshot API' });
    return;
  }
  next();
});

function buildReportUrl(journeyId) {
  const u = new URL(`/journeys/${journeyId}/report`, FRONTEND_URL);
  // 캡처 전용 힌트(필요 시 프론트에서 상단/버튼 숨김 등 확장 가능)
  u.searchParams.set('capture', '1');
  return u.toString();
}

function resolveAuthPayload(body) {
  const accessToken = typeof body?.accessToken === 'string' ? body.accessToken : '';
  let authV2Json = '';
  if (body?.authV2 != null) {
    authV2Json = typeof body.authV2 === 'string' ? body.authV2 : JSON.stringify(body.authV2);
  }
  if (!accessToken.trim() && !authV2Json) {
    return { accessToken: '', authV2Json: DEMO_AUTH_JSON };
  }
  if (accessToken.trim() && !authV2Json) {
    authV2Json = JSON.stringify({
      status: 'logged_in',
      user: { id: 'screenshot', name: 'Traveler' },
    });
  }
  return { accessToken: accessToken.trim(), authV2Json };
}

app.post('/__screenshot/report', async (req, res) => {
  try {
    if (SCREENSHOT_SECRET) {
      const got = String(req.headers['x-screenshot-secret'] || '');
      if (got !== SCREENSHOT_SECRET) {
        res.status(403).json({ message: 'Invalid or missing X-Screenshot-Secret' });
        return;
      }
    }

    const journeyId = String(req.body?.journeyId || '1');
    const url = buildReportUrl(journeyId);
    const { accessToken, authV2Json } = resolveAuthPayload(req.body);

    const viewW = Number(process.env.SCREENSHOT_VIEWPORT_WIDTH || 900);
    const viewH = Number(process.env.SCREENSHOT_VIEWPORT_HEIGHT || 1200);
    const dpr = Number(process.env.SCREENSHOT_DEVICE_SCALE || 2);

    const browser = await chromium.launch();
    const ctx = await browser.newContext({
      viewport: { width: viewW, height: viewH },
      deviceScaleFactor: Math.min(3, Math.max(1, dpr)),
      // 리포트는 라이트 UI 고정이 자연스러움
      colorScheme: 'light',
    });

    const initSrc = `(() => {
      localStorage.setItem('onboarding_done', 'true');
      const t = ${JSON.stringify(accessToken)};
      const a = ${JSON.stringify(authV2Json)};
      if (t) localStorage.setItem('tt_access_token_v1', t);
      else localStorage.removeItem('tt_access_token_v1');
      if (a) localStorage.setItem('tt_auth_v2', a);
    })();`;
    await ctx.addInitScript(initSrc);

    const page = await ctx.newPage();
    await page.goto(url, { waitUntil: 'networkidle' });
    await page.waitForSelector('[data-tt-report-root]', { timeout: 30_000 });
    await page.evaluate(() => (document.fonts && document.fonts.ready ? document.fonts.ready : Promise.resolve()));
    await page.waitForTimeout(600);

    const buf = await page.screenshot({
      type: 'png',
      fullPage: true,
      animations: 'disabled',
    });

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
  console.log(
    `Screenshot server :${PORT} FRONTEND_URL=${FRONTEND_URL} CORS=${SCREENSHOT_CORS_ORIGIN} secret=${SCREENSHOT_SECRET ? 'on' : 'off'}`,
  );
});

