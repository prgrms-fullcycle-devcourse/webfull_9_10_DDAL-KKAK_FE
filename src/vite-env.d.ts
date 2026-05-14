/// <reference types="vite/client" />
/// <reference types="vite-plugin-pwa/client" />

interface ImportMetaEnv {
  /** Playwright 스크린샷 서비스 베이스 URL (예: https://tt-screenshots.onrender.com) */
  readonly VITE_SCREENSHOT_SERVER_URL?: string;
  /** 스크린샷 서버 `SCREENSHOT_SECRET`과 동일하면 요청 헤더에 실음 (번들에 노출됨) */
  readonly VITE_SCREENSHOT_SECRET?: string;
}
