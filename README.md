# Travel-Tick (Frontend)

`Vite + React + TypeScript + TailwindCSS(v4) + TanStack Query + html2canvas` 기반 프론트 초기 작업본입니다.

## 실행

```bash
npm install
npm run dev
```

## 현재 포함된 화면(초기 스캐폴딩)

- `/login`: 로그인/온보딩(임시 버튼)
- `/`: 홈(여행 리스트/예산/정산 요약, 플로팅 스캔 버튼)
- `/journeys/new`: 여정 생성 폼
- `/journeys/:journeyId`: 여행 상세 타임라인
- `/journeys/:journeyId/scan`: 영수증 스캔(모킹)
- `/journeys/:journeyId/ocr-preview`: OCR 결과 확인/분류(모킹)
- `/journeys/:journeyId/report`: 최종 정산 + AI 리포트, 이미지 저장(다운로드)
- `/settings`: 설정(임시)

## 데이터 흐름

현재는 `src/mocks/data.ts`의 mock 데이터로 동작하며, 조회는 TanStack Query 훅(`src/features/journeys/queries.ts`)으로 감싸져 있습니다.  
백엔드 API가 준비되면 queryFn만 교체하면 됩니다.
