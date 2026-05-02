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
      <div className="w-14 h-14 rounded-2xl bg-zinc-100 dark:bg-zinc-800 flex items-center justify-center mb-4">
        <Icon className="w-7 h-7 text-zinc-400 dark:text-zinc-500" />
      </div>
      <p className="text-sm font-semibold text-zinc-700 dark:text-zinc-300 mb-1">{title}</p>
      {description && (
        <p className="text-xs text-zinc-500 dark:text-zinc-400 max-w-xs leading-relaxed">{description}</p>
      )}
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}
