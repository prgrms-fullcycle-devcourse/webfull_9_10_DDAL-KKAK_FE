import { useCallback, useEffect, useRef, useState } from 'react';

interface ToastItem {
  id: number;
  message: string;
  type: 'error' | 'success' | 'info';
}

export function useToast() {
  const [toasts, setToasts] = useState<ToastItem[]>([]);
  const counter = useRef(0);

  const showToast = useCallback((message: string, type: ToastItem['type'] = 'error') => {
    const id = ++counter.current;
    setToasts((prev) => [...prev, { id, message, type }]);
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, 2500);
  }, []);

  const ToastPortal = useCallback(
    () => (
      <div className="pointer-events-none fixed bottom-28 left-0 right-0 z-50 flex flex-col items-center gap-2 px-6">
        {toasts.map((t) => (
          <ToastItem key={t.id} toast={t} />
        ))}
      </div>
    ),
    [toasts],
  );

  return { showToast, ToastPortal };
}

function ToastItem({ toast }: { toast: ToastItem }) {
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
