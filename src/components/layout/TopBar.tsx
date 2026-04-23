import type { ReactNode } from 'react';
import { ArrowLeft } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

export function TopBar({
  title,
  subtitle,
  right,
  backTo,
  onBack,
}: {
  title: ReactNode;
  subtitle?: string;
  right?: ReactNode;
  backTo?: string;
  onBack?: () => void;
}) {
  const nav = useNavigate();

  return (
    <header className="sticky top-0 z-20 border-b border-slate-100 bg-white/90 backdrop-blur">
      <div className="flex items-center gap-3 px-6 pt-12 pb-5">
        <button
          type="button"
          onClick={() => {
            if (onBack) onBack();
            else if (backTo) nav(backTo);
            else nav(-1);
          }}
          className="rounded-xl p-1 text-slate-400 active:scale-95"
          aria-label="뒤로가기"
        >
          <ArrowLeft className="size-5" />
        </button>

        <div className="min-w-0 flex-1">
          <h2 className="truncate text-lg font-black tracking-tight">{title}</h2>
          {subtitle ? (
            <p className="mt-0.5 truncate text-[10px] font-bold text-slate-400">{subtitle}</p>
          ) : null}
        </div>

        {right ? <div className="shrink-0">{right}</div> : <div className="w-8" />}
      </div>
    </header>
  );
}
