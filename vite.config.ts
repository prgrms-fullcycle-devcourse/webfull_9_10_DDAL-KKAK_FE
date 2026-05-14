import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import { VitePWA } from 'vite-plugin-pwa';
import path from 'node:path';

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '');
  const API_BASE = env.VITE_API_BASE_URL || 'http://localhost:4000';

  return {
    resolve: {
      alias: { '@': path.resolve(__dirname, './src') },
    },
    // dev 서버에서 /auth, /api 경로를 백엔드로 포워딩 (CORS 우회).
    // 배포 환경에선 실제 백엔드 URL로 직접 호출 (현재 환경변수 기준).
    server: {
      proxy: {
        // NOTE: 프론트 라우트 `/auth/callback`(OAuth 콜백 페이지)은 SPA에서 처리해야 하므로
        // `/auth/**` 전체를 프록시하면 `/auth/callback`이 백엔드로 넘어가 `Cannot GET`가 뜬다.
        // 필요한 auth API만 명시적으로 프록시한다.
        '^/auth/(kakao|google)/': { target: API_BASE, changeOrigin: true },
        '^/auth/(refresh|logout|withdraw)$': { target: API_BASE, changeOrigin: true },
        // app APIs (CORS 우회). 프론트 라우트(`/journeys/...`)와 겹치지 않는 prefix만 프록시한다.
        '^/(trips|expenses|users|currencies)(/|$)': { target: API_BASE, changeOrigin: true },
        '/api': { target: API_BASE, changeOrigin: true },
        // 로컬 스크린샷 서버 (Playwright) 프록시
        '/__screenshot': { target: 'http://localhost:8787', changeOrigin: true },
      },
    },
    plugins: [
      react(),
      tailwindcss(),
      VitePWA({
        registerType: 'autoUpdate',
        includeAssets: ['favicon.svg', 'icons/apple-touch-icon.png'],
        manifest: {
          name: 'Travel-Tick',
          short_name: 'TravelTick',
          description: '영수증 한 장으로 완성되는 AI 여행 소비 기록',
          theme_color: '#007BFF',
          background_color: '#F8F9FA',
          display: 'standalone',
          start_url: '/',
          icons: [
            { src: '/icons/icon-192.png', sizes: '192x192', type: 'image/png' },
            { src: '/icons/icon-512.png', sizes: '512x512', type: 'image/png' },
            {
              src: '/icons/icon-maskable.png',
              sizes: '512x512',
              type: 'image/png',
              purpose: 'maskable',
            },
          ],
        },
        devOptions: { enabled: true }, // dev에서도 SW 등록 테스트 가능
      }),
    ],
  };
});
