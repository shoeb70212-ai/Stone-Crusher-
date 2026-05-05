import React from "react";
import { LucideIcon } from "lucide-react";

interface EmptyStateProps {
  icon: LucideIcon;
  title: string;
  description?: string;
  action?: React.ReactNode;
  className?: string;
}

/** Consistent empty state placeholder used across all list pages. */
export function EmptyState({ icon: Icon, title, description, action, className = "" }: EmptyStateProps) {
  return (
    <div className={`flex flex-col items-center justify-center py-12 px-4 text-center ${className}`}>
      {/* Soft halo + crisp tile = a calm, dignified empty state. */}
      <div className="relative mb-5">
        <div
          aria-hidden="true"
          className="absolute inset-0 rounded-3xl bg-primary-500/10 blur-xl"
        />
        <div className="relative w-14 h-14 rounded-2xl bg-surface-2 border border-border flex items-center justify-center">
          <Icon className="w-6 h-6 text-muted-foreground" strokeWidth={1.75} />
        </div>
      </div>
      <p className="text-base font-display font-semibold text-foreground tracking-tight mb-1">
        {title}
      </p>
      {description && (
        <p className="text-sm text-muted-foreground max-w-xs leading-relaxed">{description}</p>
      )}
      {action && <div className="mt-5">{action}</div>}
    </div>
  );
}
