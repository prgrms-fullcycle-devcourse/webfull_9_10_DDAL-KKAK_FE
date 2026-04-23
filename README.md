# ✈️ Travel-Tick

> **여행은 내가 할게, 기록은 네가 할래?**  
> 영수증 한 장으로 완성되는 AI 기반 여행 소비 기록 서비스

---

## 🧭 프로젝트 소개

**Travel-Tick**은 여행 중 발생하는 소비 기록의 번거로움을 줄이기 위해 기획된  
**OCR 기반 자동 기록 + 스마트 정산 서비스**입니다.

사용자는 영수증을 촬영하는 것만으로  
가게명, 금액, 통화, 결제 시각 등의 정보를 자동으로 입력받고,  
이를 여행 단위로 관리하며 공동 정산까지 한 번에 처리할 수 있습니다.

단순한 가계부를 넘어  
**“기록 → 정리 → 정산 → 회고”까지 이어지는 여행 소비 경험**을 만드는 것을 목표로 합니다.

---

## 🎯 문제 정의

기존 여행 가계부는 다음과 같은 불편함이 존재합니다.

- ✍️ 이동 중 수기로 소비를 기록해야 하는 번거로움
- 💱 현지 통화를 한화로 환산해야 하는 피로도
- 🧾 시간이 지나면 소비의 맥락이 사라지는 문제
- 💸 공동 경비와 개인 지출이 섞여 정산이 복잡해지는 문제

👉 Travel-Tick은 이를 해결하기 위해  
**“입력 최소화”와 “정산 자동화”**에 집중했습니다.

---

## ✨ 핵심 기능

### 📸 OCR 기반 자동 기록

- 영수증 촬영 시 AI가 금액, 가게명, 통화 등을 자동 추출
- 사용자는 결과를 확인 후 즉시 저장 가능
- 입력 과정을 최소화한 “딸깍 UX” 구현

---

### 🧳 여행 단위 소비 아카이브

- 여행별 폴더 구조로 소비 데이터 관리
- 이모지 + 한 줄 메모로 소비의 맥락까지 기록
- 단순 지출이 아닌 **추억 기록 형태로 확장**

---

### 💱 하이브리드 환율 시스템

- 실시간 환율 / 고정 환율 선택 가능
- 현지 통화 + 한화 동시 표기
- 여행 중 소비 감각 유지 가능

---

### 🤝 스마트 정산 시스템

- 개인 / 공동 지출 즉시 분리
- 공동 지출 자동 분배 (N분의 1)
- 최종적으로 **최소 송금 횟수 기준 정산 루트 제공**

---

### 📊 AI 소비 리포트

- 시간대 / 카테고리 기반 소비 패턴 분석
- “미식가형”, “올빼미형” 등 사용자 유형 리포트 생성
- 단순 데이터가 아닌 **해석된 결과 제공**

---

## 🧠 기술 선택 이유

### React + Vite

- 빠른 개발 환경과 컴포넌트 기반 UI 구성
- 초기 세팅과 개발 속도를 고려한 선택

### TanStack Query

- 서버 상태를 효율적으로 관리하고 캐싱 처리
- 지출 데이터, 정산 결과 등 실시간 데이터 관리에 적합

### Tailwind CSS

- 일관된 디자인 시스템 유지
- 빠른 UI 개발을 위한 유틸리티 기반 스타일링

### Vite PWA Plugin

- 웹을 앱처럼 사용할 수 있도록 지원
- 홈 화면 설치 및 향후 오프라인 기능 확장 고려

---

## 🏗️ 아키텍처

- **Server State:** TanStack Query
- **Client State:** React Hooks (useState, useMemo)
- **Routing:** React Router
- **Structure:** Feature-based architecture

👉 기능 단위로 코드를 분리하여 유지보수성과 확장성을 고려했습니다.

---

## 📂 프로젝트 구조

본 프로젝트는 기능 단위로 코드를 분리하는 **feature-based architecture**를 기반으로 구성했습니다.

````bash
src/
├── assets/             # 이미지, 아이콘 등 정적 에셋
├── components/
│   ├── common/         # 공통 컴포넌트
│   ├── layout/         # 레이아웃 컴포넌트
│   └── ui/             # 버튼, 입력창 등 UI 컴포넌트
├── config/
│   └── env.ts          # 환경 변수 설정 및 관리
├── features/           # 기능 단위 모듈
│   ├── auth/           # 인증 관련 기능
│   ├── expenses/       # 소비 기록 기능
│   ├── journeys/       # 여행 생성 및 관리
│   ├── ocr/            # OCR 스캔 및 데이터 처리
│   └── settlement/     # 정산 로직 및 결과 처리
├── lib/                # 공통 유틸 및 헬퍼 함수
├── mocks/              # 목업 데이터 및 테스트용 데이터
├── pages/              # 페이지 단위 컴포넌트
├── routes/             # 라우팅 설정
├── types/              # 공통 타입 정의
├── App.tsx             # 루트 컴포넌트
├── main.tsx            # 앱 진입점

```md
👉 공통 UI(`components`), 기능 로직(`features`), 페이지(`pages`)를 분리하여
확장성과 유지보수성을 고려한 구조로 설계했습니다.



🔄 사용자 흐름
로그인 (소셜 로그인)
여행 생성 (여행지, 인원, 환율 설정)
영수증 촬영 → OCR 자동 입력
개인 / 공동 지출 분류
실시간 지출 및 정산 상태 확인
여행 종료 후 최종 정산 및 리포트 확인


⚙️ 개발 포인트
1. OCR 결과를 바로 저장하지 않는 UX 설계
OCR의 오인식을 고려하여
사용자가 빠르게 검수할 수 있는 흐름을 설계했습니다.

2. 정산 로직 구조화
공동 지출을 기반으로 개인별 금액 계산
최소 송금 횟수로 최적화된 정산 결과 제공

3. PWA 기반 앱 경험 제공
웹 환경에서도 앱처럼 사용할 수 있도록 설계
향후 오프라인 기록 기능 확장 고려


🔗 연동 예정 백엔드
Node.js (Express)
PostgreSQL (Supabase)
Prisma
Naver Clova OCR
GPT-4o (AI 리포트)
Google Maps API (루트맵 기능)


🚀 시작하기
git clone <repository-url>
cd travel-tick
npm install
npm run dev


📜 스크립트
npm run dev
npm run build
npm run preview
npm run lint
npm run lint:fix
npm run format


📌 향후 개선 예정
IndexedDB 기반 오프라인 기록 기능
지도 기반 여행 동선 시각화
OCR 정확도 개선 및 후처리 로직 추가
AI 리포트 고도화


📦 배포
Vercel 배포 예정



# Travel-Tick (Frontend)

`Vite + React + TypeScript + TailwindCSS(v4) + TanStack Query + html2canvas` 기반 프론트 초기 작업본입니다.

## 실행

```bash
npm install
npm run dev
````

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
