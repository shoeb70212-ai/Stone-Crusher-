import React, { createContext, useContext, useState, useCallback } from 'react';
import { CheckCircle2, AlertCircle, AlertTriangle, Info } from 'lucide-react';
import { hapticsSuccess, hapticsError, hapticsWarning } from '../../lib/haptics';
import { generateId } from '../../lib/utils';

type ToastType = 'success' | 'error' | 'warning' | 'info';

interface Toast {
  id: string;
  type: ToastType;
  message: string;
  duration?: number;
}

interface ToastContextType {
  toasts: Toast[];
  addToast: (type: ToastType, message: string, duration?: number) => void;
  removeToast: (id: string) => void;
}

const ToastContext = createContext<ToastContextType | undefined>(undefined);

export function useToast() {
  const context = useContext(ToastContext);
  if (!context) {
    throw new Error('useToast must be used within a ToastProvider');
  }
  return context;
}

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);

  const addToast = useCallback((type: ToastType, message: string, duration = 4000) => {
    const id = generateId();
    setToasts((prev) => [...prev, { id, type, message, duration }]);
    // Fire matching haptic feedback on native devices
    if (type === 'success') hapticsSuccess();
    else if (type === 'error') hapticsError();
    else if (type === 'warning') hapticsWarning();
  }, []);

  const removeToast = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  return (
    <ToastContext.Provider value={{ toasts, addToast, removeToast }}>
      {children}
      <ToastContainer toasts={toasts} removeToast={removeToast} />
    </ToastContext.Provider>
  );
}

/**
 * Toast container styled as a Material-style snackbar:
 * - Mobile: bottom-centered, sits above the bottom nav + safe area, full-bleed
 *   with margin so it reads as a transient surface (like Android Snackbar).
 * - Desktop: bottom-right, stacked.
 *
 * Pointer-events are scoped to each toast so the container itself never
 * blocks the FAB or bottom-nav even when toasts are stacked.
 */
function ToastContainer({
  toasts,
  removeToast,
}: {
  toasts: Toast[];
  removeToast: (id: string) => void;
}) {
  if (toasts.length === 0) return null;

  return (
    <div
      className="
        pointer-events-none fixed z-[60] flex flex-col gap-2
        left-1/2 -translate-x-1/2
        bottom-[calc(72px+env(safe-area-inset-bottom))]
        w-[calc(100vw-1.5rem)] max-w-md px-3
        md:left-auto md:right-4 md:translate-x-0 md:bottom-[calc(1rem+env(safe-area-inset-bottom))] md:w-auto md:px-0
      "
      role="status"
      aria-label="Notifications"
      aria-live="polite"
    >
      {toasts.map((toast) => (
        <ToastItem key={toast.id} toast={toast} onClose={() => removeToast(toast.id)} />
      ))}
    </div>
  );
}

/** Visual config per toast type — semantic tokens only. */
const TOAST_CONFIG: Record<
  ToastType,
  { Icon: React.ElementType; iconClass: string; ring: string }
> = {
  success: { Icon: CheckCircle2, iconClass: 'text-success', ring: 'ring-success/20' },
  error:   { Icon: AlertCircle,  iconClass: 'text-danger',  ring: 'ring-danger/20'  },
  warning: { Icon: AlertTriangle, iconClass: 'text-warning', ring: 'ring-warning/20' },
  info:    { Icon: Info,         iconClass: 'text-primary-600 dark:text-primary-400', ring: 'ring-primary-500/20' },
};

function ToastItem({ toast, onClose }: { toast: Toast; onClose: () => void }) {
  const { Icon, iconClass, ring } = TOAST_CONFIG[toast.type];

  React.useEffect(() => {
    if (toast.duration) {
      const timer = setTimeout(onClose, toast.duration);
      return () => clearTimeout(timer);
    }
    return undefined;
  }, [toast.duration, onClose]);

  return (
    <div
      className={`
        pointer-events-auto flex items-start gap-3 px-4 py-3
        rounded-2xl border border-border bg-surface
        shadow-elev-lg ring-1 ${ring}
        animate-slide-up
      `}
      role="alert"
      onClick={onClose}
    >
      <Icon className={`w-5 h-5 shrink-0 mt-0.5 ${iconClass}`} aria-hidden="true" />
      <p className="flex-1 text-sm text-foreground leading-snug min-w-0 break-words">
        {toast.message}
      </p>
    </div>
  );
}
