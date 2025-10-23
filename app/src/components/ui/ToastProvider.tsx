import {
  createContext,
  type ReactNode,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState
} from 'react';
import { createPortal } from 'react-dom';
import { MaterialIcon } from '../icons/MaterialIcon';

export interface ShowToastOptions {
  id?: string;
  title: string;
  message: string;
  note?: string;
  timeoutMs?: number;
  closeLabel: string;
}

interface ToastState extends ShowToastOptions {
  id: string;
  timeoutMs: number;
}

interface ToastContextValue {
  show: (options: ShowToastOptions) => void;
}

const ToastContext = createContext<ToastContextValue | null>(null);

const MIN_TIMEOUT_MS = 10_000;

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<ToastState[]>([]);
  const timersRef = useRef(new Map<string, number>());
  const counterRef = useRef(0);

  const remove = useCallback((id: string) => {
    setToasts((previous) => previous.filter((toast) => toast.id !== id));
    const timer = timersRef.current.get(id);
    if (timer !== undefined) {
      window.clearTimeout(timer);
      timersRef.current.delete(id);
    }
  }, []);

  const show = useCallback(
    (options: ShowToastOptions) => {
      const timeoutMs = Math.max(MIN_TIMEOUT_MS, options.timeoutMs ?? MIN_TIMEOUT_MS);
      const generatedId = `toast-${counterRef.current + 1}`;
      counterRef.current += 1;
      const toastId = options.id ?? generatedId;

      setToasts((previous) => {
        const withoutExisting = previous.filter((toast) => toast.id !== toastId);
        return [
          ...withoutExisting,
          {
            ...options,
            id: toastId,
            timeoutMs
          }
        ];
      });

      const existingTimer = timersRef.current.get(toastId);
      if (existingTimer !== undefined) {
        window.clearTimeout(existingTimer);
      }
      const handle = window.setTimeout(() => {
        remove(toastId);
      }, timeoutMs);
      timersRef.current.set(toastId, handle);
    },
    [remove]
  );

  useEffect(() => {
    const timers = timersRef.current;
    return () => {
      timers.forEach((timer) => window.clearTimeout(timer));
      timers.clear();
    };
  }, []);

  const value = useMemo(() => ({ show }), [show]);

  return (
    <ToastContext.Provider value={value}>
      {children}
      {createPortal(
        <div
          aria-live="polite"
          className="pointer-events-none fixed right-6 top-6 z-50 flex max-w-sm flex-col gap-3"
        >
          {toasts.map((toast) => (
            <div
              key={toast.id}
              role="status"
              className="pointer-events-auto rounded-lg border border-slate-700 bg-slate-900/95 p-4 text-sm text-slate-100 shadow-lg backdrop-blur"
              title={toast.note ?? undefined}
            >
              <div className="flex items-start gap-3">
                <div className="flex-1 space-y-2">
                  <p className="text-sm font-semibold text-slate-50">{toast.title}</p>
                  <p className="text-sm text-slate-100">{toast.message}</p>
                  {toast.note ? (
                    <p className="text-xs text-slate-300">{toast.note}</p>
                  ) : null}
                </div>
                <button
                  type="button"
                  onClick={() => remove(toast.id)}
                  className="inline-flex h-7 w-7 items-center justify-center rounded-md text-slate-300 transition hover:bg-slate-800 hover:text-slate-100 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-400"
                >
                  <span className="sr-only">{toast.closeLabel}</span>
                  <MaterialIcon icon="close" aria-hidden="true" />
                </button>
              </div>
            </div>
          ))}
        </div>,
        document.body
      )}
    </ToastContext.Provider>
  );
}

export function useToast(): ToastContextValue {
  const context = useContext(ToastContext);
  if (!context) {
    throw new Error('useToast must be used within a ToastProvider');
  }
  return context;
}
