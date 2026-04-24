import type { ReactNode } from 'react';

/**
 * FAB 스택 컨테이너.
 * PhoneFrame(max-w-md) 기준 우측 하단에 고정.
 * 홈/타임라인 등 어디서 써도 같은 자리에 뜨게 하는 역할.
 */
export function FabStack({ children }: { children: ReactNode }) {
  return (
    <div className="pointer-events-none fixed inset-x-0 bottom-24 z-40 mx-auto flex w-full max-w-md flex-col items-end gap-3 pr-6">
      {children}
    </div>
  );
}

type FabVariant = 'primary' | 'secondary';

/**
 * 단일 FAB 버튼.
 * - primary: 큰 파란 버튼 (대표 액션, 예: 영수증 스캔)
 * - secondary: 작은 흰 버튼 (보조 액션, 예: 수기 입력)
 * 반드시 FabStack 안에 넣어 사용. 혼자 쓰면 레이아웃이 없어서 좌표가 안 잡힘.
 */
export function Fab({
  onClick,
  children,
  label,
  variant = 'primary',
}: {
  onClick: () => void;
  children: ReactNode;
  label: string;
  variant?: FabVariant;
}) {
  const styles =
    variant === 'primary'
      ? 'size-16 bg-blue-600 text-white shadow-xl shadow-blue-200'
      : 'size-12 bg-white text-blue-600 shadow-lg shadow-slate-200 ring-1 ring-slate-100';

  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      className={`pointer-events-auto flex items-center justify-center rounded-full active:scale-90 ${styles}`}
    >
      {children}
    </button>
  );
}
