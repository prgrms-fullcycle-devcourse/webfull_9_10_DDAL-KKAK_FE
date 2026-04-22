import type { ReactNode } from 'react'

export function PhoneFrame({ children }: { children: ReactNode }) {
  return (
    <div className="mx-auto min-h-dvh w-full max-w-md bg-slate-50 text-slate-900 shadow-2xl ring-1 ring-black/5">
      {children}
    </div>
  )
}

