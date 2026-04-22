import { LogOut, Sparkles } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { BottomNav } from '../components/BottomNav'
import { TopBar } from '../components/TopBar'
import { useAuth } from '../features/auth/AuthProvider'

export function SettingsPage() {
  const nav = useNavigate()
  const { logout } = useAuth()

  return (
    <div className="min-h-dvh bg-white pb-20">
      <TopBar title="설정" backTo="/" />

      <main className="space-y-4 px-6 py-6">
        <div className="rounded-3xl border border-slate-100 bg-slate-50 p-6">
          <div className="flex items-center gap-3">
            <div className="grid size-10 place-items-center rounded-2xl bg-white text-slate-900 shadow-sm">
              <Sparkles className="size-5" />
            </div>
            <div>
              <p className="text-sm font-black">초기 버전</p>
              <p className="text-xs font-bold text-slate-400">
                5/15 마감용 최소 기능만 남겨뒀어요.
              </p>
            </div>
          </div>
        </div>

        <button
          type="button"
          onClick={() => {
            logout()
            nav('/login', { replace: true })
          }}
          className="flex w-full items-center justify-between rounded-3xl border border-slate-100 bg-white p-5 text-left shadow-sm active:scale-[0.99]"
        >
          <div>
            <p className="text-sm font-black text-slate-900">로그아웃</p>
            <p className="mt-1 text-xs font-bold text-slate-400">
              소셜 로그인 연동 전 임시 버튼
            </p>
          </div>
          <LogOut className="size-5 text-slate-300" />
        </button>
      </main>

      <BottomNav />
    </div>
  )
}

