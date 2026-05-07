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
        '/auth': { target: API_BASE, changeOrigin: true },
        '/api': { target: API_BASE, changeOrigin: true },
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
