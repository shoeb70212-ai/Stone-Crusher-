import React, { useEffect, useRef } from "react";
import { AlertCircle, X } from "lucide-react";

const FOCUSABLE = [
  'a[href]',
  'button:not([disabled])',
  'input:not([disabled])',
  'select:not([disabled])',
  'textarea:not([disabled])',
  '[tabindex]:not([tabindex="-1"])',
].join(", ");

interface ConfirmationModalProps {
  isOpen: boolean;
  title: string;
  message: string;
  confirmText?: string;
  cancelText?: string;
  onConfirm: () => void;
  onCancel: () => void;
  isDestructive?: boolean;
}

export function ConfirmationModal({ 
  isOpen, 
  title, 
  message, 
  confirmText = "Confirm", 
  cancelText = "Cancel", 
  onConfirm, 
  onCancel,
  isDestructive = true
}: ConfirmationModalProps) {
  const panelRef = useRef<HTMLDivElement>(null);
  const cancelButtonRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!isOpen) return;
    const previouslyFocused = document.activeElement as HTMLElement | null;
    cancelButtonRef.current?.focus();

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        onCancel();
        return;
      }

      if (event.key !== "Tab" || !panelRef.current) return;
      const focusable = Array.from(panelRef.current.querySelectorAll<HTMLElement>(FOCUSABLE));
      if (focusable.length === 0) return;

      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };

    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("keydown", handleKeyDown);
      previouslyFocused?.focus();
    };
  }, [isOpen, onCancel]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm sm:p-6">
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="confirmation-modal-title"
        aria-describedby="confirmation-modal-message"
        className="bg-white dark:bg-zinc-900 rounded-2xl w-full max-w-sm shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-200"
      >
        <div className="p-6">
          <div className="flex items-start justify-between mb-4">
            <div className={`p-3 rounded-full ${isDestructive ? 'bg-red-100 text-red-600 dark:bg-red-500/20 dark:text-red-400' : 'bg-primary-100 text-primary-600 dark:bg-primary-500/20 dark:text-primary-400'}`}>
              <AlertCircle size={24} />
            </div>
            <button
              onClick={onCancel}
              className="text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-300 transition-colors"
              aria-label="Close confirmation"
            >
              <X size={20} />
            </button>
          </div>
          <h3 id="confirmation-modal-title" className="text-lg font-bold text-zinc-900 dark:text-white mb-2">
            {title}
          </h3>
          <p id="confirmation-modal-message" className="text-sm text-zinc-500 dark:text-zinc-400">
            {message}
          </p>
        </div>
        <div className="bg-zinc-50 dark:bg-zinc-900/50 px-6 py-4 flex items-center justify-end gap-3 flex-wrap sm:flex-nowrap">
          <button
            ref={cancelButtonRef}
            onClick={onCancel}
            className="w-full sm:w-auto px-4 py-2 text-sm font-medium text-zinc-700 dark:text-zinc-300 hover:bg-zinc-200 dark:hover:bg-zinc-800 rounded-xl transition-colors"
          >
            {cancelText}
          </button>
          <button
            onClick={() => {
              onConfirm();
              onCancel();
            }}
            className={`w-full sm:w-auto px-4 py-2 text-sm font-semibold text-white rounded-xl transition-colors shadow-sm ${
              isDestructive 
                ? 'bg-red-600 hover:bg-red-700 dark:bg-red-500 dark:hover:bg-red-600' 
                : 'bg-primary-600 hover:bg-primary-700 dark:bg-primary-500 dark:hover:bg-primary-600'
            }`}
          >
            {confirmText}
          </button>
        </div>
      </div>
    </div>
  );
}
