import React from "react";
import { Check, X } from "lucide-react";
import { cn } from "../../lib/utils";
import { MobileModal } from "./MobileModal";

export interface MobileAction {
  label: string;
  description?: string;
  icon?: React.ReactNode;
  selected?: boolean;
  tone?: "default" | "primary" | "danger";
  onClick: () => void;
}

export function MobileActionSheet({
  isOpen,
  onClose,
  title,
  actions,
}: {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  actions: MobileAction[];
}) {
  return (
    <MobileModal
      isOpen={isOpen}
      onClose={onClose}
      title={title}
      mobileMode="compactSheet"
      maxWidth="max-w-sm"
    >
      <div className="p-3 space-y-1.5">
        {actions.map((action) => (
          <button
            key={action.label}
            type="button"
            onClick={() => {
              action.onClick();
              onClose();
            }}
            className={cn(
              "w-full min-h-12 rounded-xl px-3 py-2.5 text-left flex items-center gap-3 border transition-colors active:scale-[0.98]",
              action.selected
                ? "border-primary-200 dark:border-primary-500/30 bg-primary-50 dark:bg-primary-500/15 text-primary-700 dark:text-primary-300"
                : "border-border bg-surface text-foreground hover:bg-surface-2",
              action.tone === "danger" &&
                "border-danger/30 bg-danger-muted text-danger-foreground",
            )}
          >
            {action.icon && <span className="shrink-0 text-current">{action.icon}</span>}
            <span className="min-w-0 flex-1">
              <span className="block text-sm font-semibold leading-tight">{action.label}</span>
              {action.description && (
                <span className="mt-0.5 block text-xs text-muted-foreground">
                  {action.description}
                </span>
              )}
            </span>
            {action.selected && <Check className="h-4 w-4 shrink-0" />}
          </button>
        ))}
        {/* Cancel at the bottom — Material 3 dismissable bottom sheet */}
        <button
          type="button"
          onClick={onClose}
          className="w-full min-h-12 rounded-xl px-3 py-2.5 text-center text-sm font-semibold text-foreground bg-surface-2 border border-border hover:bg-muted transition-colors active:scale-[0.98] mt-2"
        >
          Cancel
        </button>
      </div>
    </MobileModal>
  );
}

export function MobileFilterSheet({
  isOpen,
  onClose,
  title,
  children,
  onClear,
  clearDisabled,
}: {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  children: React.ReactNode;
  onClear?: () => void;
  clearDisabled?: boolean;
}) {
  return (
    <MobileModal
      isOpen={isOpen}
      onClose={onClose}
      title={title}
      mobileMode="compactSheet"
      maxWidth="max-w-md"
      footer={
        <div className="grid grid-cols-2 gap-2">
          <button
            type="button"
            onClick={onClear}
            disabled={clearDisabled || !onClear}
            className="min-h-11 rounded-xl border border-border bg-surface px-3 text-sm font-semibold text-foreground hover:bg-surface-2 disabled:opacity-40 transition-colors active:scale-[0.99]"
          >
            Clear
          </button>
          <button
            type="button"
            onClick={onClose}
            className="min-h-11 rounded-xl bg-primary-600 hover:bg-primary-700 px-3 text-sm font-semibold text-white shadow-elev-sm transition-colors active:scale-[0.99]"
          >
            Apply
          </button>
        </div>
      }
    >
      <div className="p-3">{children}</div>
    </MobileModal>
  );
}

export function MobileStickyFooter({ children }: { children: React.ReactNode }) {
  return (
    <div className="sticky bottom-0 z-10 -mx-1 border-t border-border bg-surface/95 p-2 pb-[calc(0.5rem+env(safe-area-inset-bottom))] backdrop-blur md:hidden">
      {children}
    </div>
  );
}

export function MobileChip({
  children,
  onRemove,
}: {
  children: React.ReactNode;
  onRemove?: () => void;
}) {
  return (
    <span className="inline-flex min-h-8 items-center gap-1.5 rounded-full border border-primary-200 dark:border-primary-500/20 bg-primary-50 dark:bg-primary-500/10 px-2.5 text-xs font-semibold text-primary-700 dark:text-primary-300">
      {children}
      {onRemove && (
        <button
          type="button"
          onClick={onRemove}
          className="-mr-1 flex h-6 w-6 items-center justify-center rounded-full text-primary-500 hover:text-primary-700 dark:hover:text-primary-300 transition-colors"
          aria-label="Remove filter"
        >
          <X className="h-3 w-3" />
        </button>
      )}
    </span>
  );
}
