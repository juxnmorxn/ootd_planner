import { createContext, useContext, useState, useCallback, useEffect } from 'react';
import type { ReactNode } from 'react';

export type ToastType = 'success' | 'error' | 'info';

export interface ToastOptions {
  type?: ToastType;
  title?: string;
  message: string;
  durationMs?: number;
}

interface ToastContextValue {
  showToast: (options: ToastOptions) => void;
}

const ToastContext = createContext<ToastContextValue | undefined>(undefined);

export function useToast() {
  const ctx = useContext(ToastContext);
  if (!ctx) {
    throw new Error('useToast must be used within ToastProvider');
  }
  return ctx;
}

interface ToastProviderProps {
  children: ReactNode;
}

export function ToastProvider({ children }: ToastProviderProps) {
  const [toast, setToast] = useState<ToastOptions | null>(null);

  const showToast = useCallback((options: ToastOptions) => {
    setToast({
      type: options.type ?? 'info',
      durationMs: options.durationMs ?? 2500,
      ...options,
    });
  }, []);

  useEffect(() => {
    if (!toast) return;
    const timeout = setTimeout(() => setToast(null), toast.durationMs);
    return () => clearTimeout(timeout);
  }, [toast]);

  const typeStyles: Record<ToastType, string> = {
    success: 'bg-emerald-600 text-white',
    error: 'bg-red-600 text-white',
    info: 'bg-slate-900 text-white',
  };

  return (
    <ToastContext.Provider value={{ showToast }}>
      {children}
      {toast && (
        <div className="fixed inset-0 pointer-events-none flex items-start justify-center sm:items-end sm:justify-end z-[999]">
          <div className="w-full sm:w-auto px-4 py-6 flex justify-center sm:justify-end">
            <div
              className={`pointer-events-auto rounded-2xl shadow-lg shadow-black/25 px-4 py-3 text-sm font-medium flex flex-col gap-1 ${
                typeStyles[toast.type ?? 'info']
              }`}
            >
              {toast.title && <div className="text-xs uppercase tracking-wide opacity-80">{toast.title}</div>}
              <div>{toast.message}</div>
            </div>
          </div>
        </div>
      )}
    </ToastContext.Provider>
  );
}
