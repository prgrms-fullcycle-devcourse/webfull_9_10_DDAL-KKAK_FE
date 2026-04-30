import { useEffect, useState } from 'react';

interface ToastItem {
  id: number;
  message: string;
  type: 'error' | 'success' | 'info';
}

export function ToastPortal({ toasts }: { toasts: ToastItem[] }) {
  return (
    <div className="pointer-events-none fixed bottom-28 left-0 right-0 z-50 flex flex-col items-center gap-2 px-6">
      {toasts.map((t) => (
        <ToastBubble key={t.id} toast={t} />
      ))}
    </div>
  );
}

function ToastBubble({ toast }: { toast: ToastItem }) {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const t = setTimeout(() => setVisible(true), 10);
    return () => clearTimeout(t);
  }, []);

  const bg =
    toast.type === 'error'
      ? 'bg-red-500'
      : toast.type === 'success'
        ? 'bg-green-500'
        : 'bg-slate-800';

  return (
    <div
      className={`pointer-events-auto rounded-2xl px-5 py-3 text-[13px] font-black text-white shadow-lg transition-all duration-300 ${bg} ${
        visible ? 'translate-y-0 opacity-100' : 'translate-y-2 opacity-0'
      }`}
    >
      {toast.message}
    </div>
  );
}
