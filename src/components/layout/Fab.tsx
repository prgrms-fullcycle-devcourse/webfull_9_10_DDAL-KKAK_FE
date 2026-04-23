import type { ReactNode } from 'react';

export function Fab({
  onClick,
  children,
  label,
}: {
  onClick: () => void;
  children: ReactNode;
  label: string;
}) {
  return (
    <div className="fixed bottom-24 right-6 z-40 mx-auto w-full max-w-md">
      <div className="pointer-events-none flex justify-end">
        <button
          type="button"
          onClick={onClick}
          aria-label={label}
          className="pointer-events-auto flex size-16 items-center justify-center rounded-full bg-blue-600 text-white shadow-xl shadow-blue-200 active:scale-90"
        >
          {children}
        </button>
      </div>
    </div>
  );
}
