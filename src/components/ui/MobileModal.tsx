import React, { useRef, useEffect } from "react";
import { X } from "lucide-react";
import { cn } from "../../lib/utils";
import { useBodyScrollLock } from "../../lib/use-body-scroll-lock";

const FOCUSABLE = [
  'a[href]',
  'button:not([disabled])',
  'input:not([disabled])',
  'select:not([disabled])',
  'textarea:not([disabled])',
  '[tabindex]:not([tabindex="-1"])',
].join(', ');

interface MobileModalProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  children: React.ReactNode;
  /** Shown below title, left side */
  subtitle?: string;
  /** Extra content in the header row (e.g. action buttons) */
  headerRight?: React.ReactNode;
  /** Max width on desktop – defaults to max-w-2xl */
  maxWidth?: string;
  mobileMode?: "compactSheet" | "taskSheet" | "previewSheet";
  footer?: React.ReactNode;
  bodyClassName?: string;
  panelClassName?: string;
}

/** Static map so Tailwind JIT can statically analyse all md:max-w-* classes. */
const MD_MAX_WIDTH: Record<string, string> = {
  "max-w-sm":  "md:max-w-sm",
  "max-w-md":  "md:max-w-md",
  "max-w-lg":  "md:max-w-lg",
  "max-w-xl":  "md:max-w-xl",
  "max-w-2xl": "md:max-w-2xl",
  "max-w-3xl": "md:max-w-3xl",
  "max-w-4xl": "md:max-w-4xl",
};

/**
 * On mobile  → slides up as a bottom sheet (90vh, rounded top corners, drag handle).
 * On desktop → centred overlay modal (max-h-[90vh], rounded-2xl, backdrop blur).
 */
export function MobileModal({
  isOpen,
  onClose,
  title,
  subtitle,
  headerRight,
  children,
  maxWidth = "max-w-2xl",
  mobileMode = "taskSheet",
  footer,
  bodyClassName,
  panelClassName,
}: MobileModalProps) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const onCloseRef = useRef(onClose);
  const mdMaxWidth = MD_MAX_WIDTH[maxWidth] ?? "md:max-w-2xl";

  useBodyScrollLock(isOpen);

  useEffect(() => {
    onCloseRef.current = onClose;
  }, [onClose]);

  // Reset scroll position when re-opened
  useEffect(() => {
    if (isOpen && scrollRef.current) {
      scrollRef.current.scrollTop = 0;
    }
  }, [isOpen]);

  // Focus trap: save/restore focus and intercept Tab when open.
  useEffect(() => {
    if (!isOpen) return;
    const previously = document.activeElement as HTMLElement | null;

    const focusTimer = window.setTimeout(() => {
      const firstBodyControl = scrollRef.current?.querySelector<HTMLElement>(FOCUSABLE);
      const firstPanelControl = panelRef.current?.querySelector<HTMLElement>(FOCUSABLE);
      (firstBodyControl ?? firstPanelControl)?.focus({ preventScroll: true });
    }, 0);

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onCloseRef.current();
        return;
      }
      const panel = panelRef.current;
      if (e.key !== 'Tab' || !panel) return;
      const focusable = Array.from(panel.querySelectorAll<HTMLElement>(FOCUSABLE));
      if (focusable.length === 0) return;
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (e.shiftKey) {
        if (document.activeElement === first) { e.preventDefault(); last.focus(); }
      } else {
        if (document.activeElement === last) { e.preventDefault(); first.focus(); }
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => {
      window.clearTimeout(focusTimer);
      document.removeEventListener('keydown', handleKeyDown);
      if (previously && document.contains(previously)) {
        previously.focus({ preventScroll: true });
      }
    };
  }, [isOpen]);

  if (!isOpen) return null;

  const mobilePanelClass =
    mobileMode === "compactSheet"
      ? "w-full rounded-t-2xl max-h-[76dvh]"
      : mobileMode === "previewSheet"
        ? "w-full h-[100dvh] max-h-[100dvh] rounded-none"
        : "w-full rounded-t-2xl max-h-[92dvh]";

  return (
    <div className="fixed inset-0 z-[70] flex flex-col justify-end md:justify-center md:items-center md:p-4 overflow-hidden">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/50 backdrop-blur-sm"
        onClick={onClose}
      />

      {/* Sheet / Modal */}
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="mobile-modal-title"
        className={cn(
          "relative flex flex-col bg-white dark:bg-zinc-900 shadow-2xl",
          mobilePanelClass,
          // Desktop: centred modal
          `md:rounded-2xl md:max-h-[90vh] md:w-auto ${mdMaxWidth}`,
          panelClassName,
        )}
      >
        {/* Drag handle – mobile only */}
        <div className="md:hidden flex justify-center pt-3 pb-1 shrink-0">
          <div className="w-10 h-1 bg-zinc-300 dark:bg-zinc-600 rounded-full" />
        </div>

        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 md:px-6 md:py-4 border-b border-zinc-100 dark:border-zinc-700/70 bg-zinc-50/80 dark:bg-zinc-900/80 shrink-0 md:rounded-t-2xl">
          <div className="flex-1 min-w-0 pr-3">
            <h3 id="mobile-modal-title" className="text-base md:text-lg font-bold text-zinc-900 dark:text-white truncate">
              {title}
            </h3>
            {subtitle && (
              <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-0.5 wrap-break-word">
                {subtitle}
              </p>
            )}
          </div>
          <div className="flex items-center gap-2 shrink-0">
            {headerRight}
            <button
              onClick={onClose}
              className="p-3 rounded-xl text-zinc-400 dark:text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-200 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors active:scale-95"
              aria-label="Close"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Scrollable body */}
        <div
          ref={scrollRef}
          className={cn("flex-1 overflow-y-auto overscroll-contain", bodyClassName)}
        >
          {children}
        </div>
        {footer && (
          <div className="shrink-0 border-t border-zinc-100 dark:border-zinc-800 bg-white/95 dark:bg-zinc-900/95 p-3 pb-[calc(0.75rem+env(safe-area-inset-bottom))] md:p-4 md:pb-4">
            {footer}
          </div>
        )}
      </div>
    </div>
  );
}
