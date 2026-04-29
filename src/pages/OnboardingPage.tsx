import { useState } from 'react';
import { useNavigate } from 'react-router-dom';

const SLIDES = [
  {
    emoji: '📸',
    gradient: 'from-blue-500 to-violet-500',
    glow: 'bg-blue-400/20',
    tag: '딱 3초면 기록 완료',
    tagColor: 'bg-blue-50 text-blue-500',
    title: '영수증 찍으면 끝',
    desc: 'AI가 가게명·금액·통화를\n자동으로 읽어요',
  },
  {
    emoji: '🤝',
    gradient: 'from-teal-400 to-blue-500',
    glow: 'bg-teal-400/20',
    tag: '최소 횟수로 정산 완료',
    tagColor: 'bg-teal-50 text-teal-600',
    title: '여러명이 여행해도\n정산은 걱정 없어',
    desc: '공동/개인 구분 한 번이면\n최적 송금 루트를 자동으로 계산해요',
  },
  {
    emoji: '🤖',
    gradient: 'from-orange-400 to-red-500',
    glow: 'bg-orange-400/20',
    tag: '여행 후 자동 생성',
    tagColor: 'bg-orange-50 text-orange-500',
    title: '나의 여행 스타일\nAI가 분석해줘요',
    desc: '"밤을 잊은 미식가" 같은\n위트 있는 리포트로 여행을 기억해요',
  },
];

export function OnboardingPage() {
  const nav = useNavigate();
  const [current, setCurrent] = useState(0);

  const isLast = current === SLIDES.length - 1;
  const slide = SLIDES[current];

  const handleNext = () => {
    if (isLast) {
      localStorage.setItem('onboarding_done', 'true');
      nav('/login', { replace: true });
    } else {
      setCurrent((v) => v + 1);
    }
  };

  // 터치 스와이프
  let touchStartX = 0;
  const handleTouchStart = (e: React.TouchEvent) => {
    touchStartX = e.touches[0].clientX;
  };
  const handleTouchEnd = (e: React.TouchEvent) => {
    const diff = touchStartX - e.changedTouches[0].clientX;
    if (diff > 50 && !isLast) setCurrent((v) => v + 1);
    if (diff < -50 && current > 0) setCurrent((v) => v - 1);
  };

  return (
    <div
      className="flex min-h-dvh flex-col bg-white"
      onTouchStart={handleTouchStart}
      onTouchEnd={handleTouchEnd}
    >
      {/* 상단 아이콘 영역 */}
      <div className="flex flex-1 flex-col items-center justify-center px-8 pt-16">
        {/* 아이콘 */}
        <div className="relative mb-10">
          <div className={`absolute inset-0 scale-110 rounded-[40px] blur-2xl ${slide.glow}`} />
          <div
            className={`relative flex size-36 items-center justify-center rounded-[40px] bg-gradient-to-br text-6xl shadow-xl ${slide.gradient}`}
          >
            {slide.emoji}
          </div>
        </div>

        {/* 태그 */}
        <span className={`rounded-full px-4 py-1.5 text-[12px] font-black ${slide.tagColor}`}>
          {slide.tag}
        </span>

        {/* 제목 */}
        <h1 className="mt-5 whitespace-pre-line text-center text-[28px] font-black leading-tight tracking-tight text-slate-900">
          {slide.title}
        </h1>

        {/* 설명 */}
        <p className="mt-4 whitespace-pre-line text-center text-[14px] font-bold leading-relaxed text-slate-400">
          {slide.desc}
        </p>
      </div>

      {/* 하단 고정 영역 */}
      <div className="px-6 pb-10">
        {/* 도트 인디케이터 */}
        <div className="mb-8 flex items-center justify-center gap-2">
          {SLIDES.map((_, i) => (
            <button
              key={i}
              type="button"
              onClick={() => setCurrent(i)}
              className={`rounded-full transition-all duration-300 ${
                i === current ? 'w-6 bg-blue-600 h-2' : 'w-2 h-2 bg-slate-200'
              }`}
            />
          ))}
        </div>

        {/* CTA 버튼 */}
        <button
          type="button"
          onClick={handleNext}
          className="w-full rounded-3xl bg-blue-600 py-5 text-[15px] font-black text-white shadow-lg shadow-blue-200 active:scale-[0.99]"
        >
          {isLast ? 'Travel-Tick 시작하기 🧾' : '다음 →'}
        </button>
      </div>
    </div>
  );
}
