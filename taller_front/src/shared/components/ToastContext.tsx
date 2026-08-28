import { createContext, useCallback, useContext, useState, type ReactNode } from 'react';
import { CheckCircle2, AlertTriangle, Info, XCircle, X } from 'lucide-react';

export type ToastType = 'success' | 'warning' | 'danger' | 'info';

export interface ToastMessage {
  id: string;
  type: ToastType;
  title: string;
  description?: string;
  durationMs?: number;
}

interface ToastContextValue {
  showToast: (type: ToastType, title: string, description?: string, durationMs?: number) => void;
  success: (title: string, description?: string) => void;
  warning: (title: string, description?: string) => void;
  danger: (title: string, description?: string) => void;
  info: (title: string, description?: string) => void;
}

const ToastContext = createContext<ToastContextValue | undefined>(undefined);

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<ToastMessage[]>([]);

  const removeToast = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const showToast = useCallback(
    (type: ToastType, title: string, description?: string, durationMs = 4500) => {
      const id = Math.random().toString(36).substring(2, 9);
      setToasts((prev) => [...prev, { id, type, title, description, durationMs }]);
      if (durationMs > 0) {
        setTimeout(() => removeToast(id), durationMs);
      }
    },
    [removeToast],
  );

  const success = useCallback(
    (title: string, description?: string) => showToast('success', title, description),
    [showToast],
  );
  const warning = useCallback(
    (title: string, description?: string) => showToast('warning', title, description),
    [showToast],
  );
  const danger = useCallback(
    (title: string, description?: string) => showToast('danger', title, description),
    [showToast],
  );
  const info = useCallback(
    (title: string, description?: string) => showToast('info', title, description),
    [showToast],
  );

  const icons: Record<ToastType, ReactNode> = {
    success: <CheckCircle2 className="w-5 h-5 text-[#22C55E] shrink-0 mt-0.5" />,
    warning: <AlertTriangle className="w-5 h-5 text-[#F59E0B] shrink-0 mt-0.5" />,
    danger: <XCircle className="w-5 h-5 text-[#EF4444] shrink-0 mt-0.5" />,
    info: <Info className="w-5 h-5 text-[#3B82F6] shrink-0 mt-0.5" />,
  };

  const styles: Record<ToastType, string> = {
    success: 'bg-[#16191F] border-[#22C55E40] text-[#E0E2E6]',
    warning: 'bg-[#16191F] border-[#F59E0B40] text-[#E0E2E6]',
    danger: 'bg-[#16191F] border-[#EF444440] text-[#E0E2E6]',
    info: 'bg-[#16191F] border-[#3B82F640] text-[#E0E2E6]',
  };

  return (
    <ToastContext.Provider value={{ showToast, success, warning, danger, info }}>
      {children}
      <div className="fixed bottom-5 right-5 z-[60] flex flex-col gap-2.5 max-w-md w-full pointer-events-none px-4 sm:px-0">
        {toasts.map((toast) => (
          <div
            key={toast.id}
            className={`pointer-events-auto p-4 rounded-2xl border shadow-lg flex items-start justify-between gap-3 ${styles[toast.type]}`}
          >
            <div className="flex items-start gap-3">
              {icons[toast.type]}
              <div>
                <h4 className="text-sm font-bold text-white">{toast.title}</h4>
                {toast.description && (
                  <p className="text-xs text-[#8E949F] mt-0.5 leading-relaxed">{toast.description}</p>
                )}
              </div>
            </div>
            <button
              type="button"
              onClick={() => removeToast(toast.id)}
              aria-label="Cerrar notificación"
              className="p-1 rounded-lg text-[#8E949F] hover:text-white transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast(): ToastContextValue {
  const context = useContext(ToastContext);
  if (!context) {
    throw new Error('useToast debe ser utilizado dentro de un ToastProvider');
  }
  return context;
}