import React, { useEffect, useRef } from "react";
import { X } from "lucide-react";
import { cn } from "../../lib/utils";

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
}

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
}: MobileModalProps) {
  const scrollRef = useRef<HTMLDivElement>(null);

  // Lock body scroll when open
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "";
    }
    return () => {
      document.body.style.overflow = "";
    };
  }, [isOpen]);

  // Reset scroll position when re-opened
  useEffect(() => {
    if (isOpen && scrollRef.current) {
      scrollRef.current.scrollTop = 0;
    }
  }, [isOpen]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex flex-col justify-end md:justify-center md:items-center md:p-4 overflow-hidden">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/50 backdrop-blur-sm"
        onClick={onClose}
      />

      {/* Sheet / Modal */}
      <div
        className={cn(
          "relative flex flex-col bg-white dark:bg-zinc-900 shadow-2xl",
          // Mobile: bottom sheet - use maxWidth but can be narrower
          "rounded-t-2xl max-h-[92dvh] w-full max-w-[90vw]",
          // Desktop: centred modal
          `md:rounded-2xl md:max-h-[90vh] md:w-auto md:${maxWidth}`,
        )}
      >
        {/* Drag handle – mobile only */}
        <div className="md:hidden flex justify-center pt-3 pb-1 shrink-0">
          <div className="w-10 h-1 bg-zinc-300 dark:bg-zinc-600 rounded-full" />
        </div>

        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 md:px-6 md:py-4 border-b border-zinc-100 dark:border-zinc-700/70 bg-zinc-50/80 dark:bg-zinc-900/80 shrink-0 md:rounded-t-2xl">
          <div className="flex-1 min-w-0 pr-3">
            <h3 className="text-base md:text-lg font-bold text-zinc-900 dark:text-white truncate">
              {title}
            </h3>
            {subtitle && (
              <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-0.5 truncate">
                {subtitle}
              </p>
            )}
          </div>
          <div className="flex items-center gap-2 shrink-0">
            {headerRight}
            <button
              onClick={onClose}
              className="p-2 rounded-xl text-zinc-400 dark:text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-200 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors active:scale-95"
              aria-label="Close"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Scrollable body */}
        <div
          ref={scrollRef}
          className="flex-1 overflow-y-auto overscroll-contain"
        >
          {children}
        </div>
      </div>
    </div>
  );
}
