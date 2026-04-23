import { History, Settings } from 'lucide-react';
import { Link, useLocation } from 'react-router-dom';

export function BottomNav() {
  const { pathname } = useLocation();
  const isHome = pathname === '/';
  const isSettings = pathname.startsWith('/settings');

  return (
    <nav className="fixed inset-x-0 bottom-0 z-30 mx-auto h-20 w-full max-w-md border-t border-slate-100 bg-white/80 px-10 backdrop-blur">
      <div className="flex h-full items-center justify-around">
        <Link
          to="/"
          className={`flex flex-col items-center ${isHome ? 'text-blue-600' : 'text-slate-300'}`}
        >
          <History className="size-6" />
          <span className="mt-1 text-[9px] font-black uppercase tracking-widest">기록함</span>
        </Link>

        <div className="w-12" />

        <Link
          to="/settings"
          className={`flex flex-col items-center ${isSettings ? 'text-blue-600' : 'text-slate-300'}`}
        >
          <Settings className="size-6" />
          <span className="mt-1 text-[9px] font-black uppercase tracking-widest">설정</span>
        </Link>
      </div>
    </nav>
  );
}
