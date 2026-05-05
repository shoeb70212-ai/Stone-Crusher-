import React, { useEffect, useRef } from "react";
import { AlertTriangle, X } from "lucide-react";
import { useBodyScrollLock } from "../../lib/use-body-scroll-lock";
import { hapticsLight } from "../../lib/haptics";

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

/**
 * A native-feeling confirmation dialog.
 *
 * Mobile: slides up as a bottom sheet with a drag handle and a tall hit area —
 *   matches Android's Material 3 modal-bottom-sheet pattern.
 * Desktop: stays a centered card.
 *
 * Both variants share semantic tokens, focus trap, scroll lock, and a light
 * haptic tap on the destructive confirm so the action feels acknowledged.
 */
export function ConfirmationModal({
  isOpen,
  title,
  message,
  confirmText = "Confirm",
  cancelText = "Cancel",
  onConfirm,
  onCancel,
  isDestructive = true,
}: ConfirmationModalProps) {
  const panelRef = useRef<HTMLDivElement>(null);
  const cancelButtonRef = useRef<HTMLButtonElement>(null);

  useBodyScrollLock(isOpen);

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
      if (previouslyFocused && document.contains(previouslyFocused)) {
        previouslyFocused.focus();
      }
    };
  }, [isOpen, onCancel]);

  if (!isOpen) return null;

  const handleConfirm = () => {
    void hapticsLight();
    onConfirm();
    onCancel();
  };

  const iconTone = isDestructive
    ? "bg-danger-muted text-danger"
    : "bg-primary-50 dark:bg-primary-500/15 text-primary-600 dark:text-primary-400";

  const confirmTone = isDestructive
    ? "bg-danger hover:opacity-90 text-white"
    : "bg-primary-600 hover:bg-primary-700 text-white";

  return (
    <div
      className="fixed inset-0 z-50 flex flex-col justify-end md:items-center md:justify-center md:p-4"
      role="presentation"
    >
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/55 backdrop-blur-sm animate-fade-in"
        onClick={onCancel}
        aria-hidden="true"
      />

      {/* Sheet on mobile / centered card on desktop */}
      <div
        ref={panelRef}
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="confirmation-modal-title"
        aria-describedby="confirmation-modal-message"
        className="
          relative w-full max-w-sm bg-surface text-foreground
          rounded-t-3xl md:rounded-2xl
          pb-[env(safe-area-inset-bottom)]
          shadow-elev-xl border-t border-border md:border md:border-border
          animate-sheet-up md:animate-scale-in origin-bottom md:origin-center
        "
      >
        {/* Drag handle — mobile only */}
        <div className="md:hidden flex justify-center pt-3 pb-1" aria-hidden="true">
          <div className="w-10 h-1 rounded-full bg-border-strong" />
        </div>

        <div className="px-6 pt-4 pb-5 md:p-6">
          <div className="flex items-start justify-between mb-4">
            <div className={`p-3 rounded-2xl ${iconTone}`} aria-hidden="true">
              <AlertTriangle size={22} strokeWidth={2.25} />
            </div>
            <button
              onClick={onCancel}
              className="-mr-2 p-2 rounded-xl text-muted-foreground hover:text-foreground hover:bg-muted transition-colors active:scale-95"
              aria-label="Close confirmation"
            >
              <X size={20} />
            </button>
          </div>

          <h3
            id="confirmation-modal-title"
            className="text-lg md:text-xl font-display font-bold text-foreground tracking-tight mb-1.5"
          >
            {title}
          </h3>
          <p
            id="confirmation-modal-message"
            className="text-sm text-muted-foreground leading-relaxed"
          >
            {message}
          </p>
        </div>

        {/* Actions — stacked full-width on mobile (Material 3 bottom-dialog
            pattern); side-by-side on desktop. */}
        <div
          className="
            px-4 pb-4 md:px-6 md:pb-5
            flex flex-col-reverse gap-2
            md:flex-row md:justify-end md:gap-3
          "
        >
          <button
            ref={cancelButtonRef}
            onClick={onCancel}
            className="w-full md:w-auto h-11 px-5 text-sm font-semibold text-foreground bg-surface-2 hover:bg-muted rounded-xl transition-colors active:scale-[0.99]"
          >
            {cancelText}
          </button>
          <button
            onClick={handleConfirm}
            className={`w-full md:w-auto h-11 px-5 text-sm font-semibold rounded-xl transition-all shadow-elev-sm active:scale-[0.99] ${confirmTone}`}
          >
            {confirmText}
          </button>
        </div>
      </div>
    </div>
  );
}
