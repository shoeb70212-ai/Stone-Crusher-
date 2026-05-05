import React, { useRef, useEffect, useState, useCallback } from "react";
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

  // ────────────────────────────────────────────────────────────────────────
  // Drag-to-dismiss gesture (mobile only).
  //
  // Native Android/iOS bottom sheets can be flicked closed. We wire a simple
  // pointer-based gesture here on the drag handle area: track vertical delta,
  // translate the sheet, snap back if the user releases below threshold,
  // call onClose() with a slide-out animation if past it.
  // ────────────────────────────────────────────────────────────────────────
  const [dragY, setDragY] = useState(0);
  const dragStartY = useRef<number | null>(null);

  const onDragStart = useCallback((e: React.PointerEvent) => {
    // Don't start drag on desktop or for fullscreen-style sheets
    if (window.matchMedia('(min-width: 768px)').matches) return;
    if (mobileMode === 'previewSheet') return;
    dragStartY.current = e.clientY;
    (e.target as Element).setPointerCapture?.(e.pointerId);
  }, [mobileMode]);

  const onDragMove = useCallback((e: React.PointerEvent) => {
    if (dragStartY.current === null) return;
    const delta = e.clientY - dragStartY.current;
    // Only allow downward drag, with some rubber-banding past 0
    setDragY(delta > 0 ? delta : delta / 4);
  }, []);

  const onDragEnd = useCallback((e: React.PointerEvent) => {
    if (dragStartY.current === null) return;
    const delta = e.clientY - dragStartY.current;
    dragStartY.current = null;
    (e.target as Element).releasePointerCapture?.(e.pointerId);
    // Threshold: 25% of viewport height closes
    if (delta > window.innerHeight * 0.25) {
      onCloseRef.current();
    }
    setDragY(0);
  }, []);

  if (!isOpen) return null;

  const mobilePanelClass =
    mobileMode === "compactSheet"
      ? "w-full rounded-t-3xl max-h-[76dvh]"
      : mobileMode === "previewSheet"
        ? "w-full h-[100dvh] max-h-[100dvh] rounded-none"
        : "w-full rounded-t-3xl max-h-[92dvh]";

  return (
    <div className="fixed inset-0 z-[70] flex flex-col justify-end md:justify-center md:items-center md:p-4 overflow-hidden">
      {/* Backdrop — fades on enter */}
      <div
        className="absolute inset-0 bg-black/55 backdrop-blur-sm animate-fade-in"
        onClick={onClose}
        aria-hidden="true"
      />

      {/* Sheet / Modal */}
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="mobile-modal-title"
        style={{
          // Apply live drag offset only while the user is dragging.
          transform: dragY > 0 ? `translateY(${dragY}px)` : undefined,
          transition: dragY === 0 ? 'transform 220ms cubic-bezier(0.22, 1, 0.36, 1)' : 'none',
        }}
        className={cn(
          "relative flex flex-col bg-surface text-foreground shadow-elev-xl",
          mobilePanelClass,
          // Mobile entrance animation (only if not a fullscreen preview sheet)
          mobileMode !== 'previewSheet' && 'animate-sheet-up md:animate-scale-in',
          // Desktop: centred modal
          `md:rounded-2xl md:max-h-[90vh] md:w-auto md:border md:border-border ${mdMaxWidth}`,
          panelClassName,
        )}
      >
        {/* Drag handle — mobile only, doubles as the gesture target */}
        <div
          className="md:hidden flex justify-center pt-3 pb-2 shrink-0 cursor-grab active:cursor-grabbing touch-none"
          onPointerDown={onDragStart}
          onPointerMove={onDragMove}
          onPointerUp={onDragEnd}
          onPointerCancel={onDragEnd}
          aria-hidden="true"
        >
          <div className="w-10 h-1 bg-border-strong rounded-full" />
        </div>

        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 md:px-6 md:py-4 border-b border-border bg-surface-2/60 shrink-0 md:rounded-t-2xl">
          <div className="flex-1 min-w-0 pr-3">
            <h3 id="mobile-modal-title" className="text-base md:text-lg font-display font-bold text-foreground tracking-tight truncate">
              {title}
            </h3>
            {subtitle && (
              <p className="text-xs text-muted-foreground mt-0.5 break-words">
                {subtitle}
              </p>
            )}
          </div>
          <div className="flex items-center gap-2 shrink-0">
            {headerRight}
            <button
              onClick={onClose}
              className="w-10 h-10 inline-flex items-center justify-center rounded-xl text-muted-foreground hover:text-foreground hover:bg-muted transition-colors active:scale-95"
              aria-label="Close"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Scrollable body */}
        <div
          ref={scrollRef}
          className={cn("flex-1 overflow-y-auto overscroll-contain scroll-smooth", bodyClassName)}
        >
          {children}
        </div>
        {footer && (
          <div className="shrink-0 border-t border-border bg-surface/95 backdrop-blur p-3 pb-[calc(0.75rem+env(safe-area-inset-bottom))] md:p-4 md:pb-4">
            {footer}
          </div>
        )}
      </div>
    </div>
  );
}
