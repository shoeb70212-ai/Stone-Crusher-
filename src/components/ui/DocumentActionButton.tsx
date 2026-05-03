import React from "react";
import { Loader2 } from "lucide-react";

export type DocumentAction = "download" | "whatsapp" | "print";

interface DocumentActionButtonProps {
  /** The entity ID used to match against the active action. */
  entityId: string;
  /** Used in the aria-label: e.g. "slip abc123" or "invoice INV-001". */
  entityLabel: string;
  action: DocumentAction;
  label: string;
  icon: React.ReactNode;
  className: string;
  /** Currently in-flight action for any entity, or null when idle. */
  activeAction: { id: string; action: DocumentAction } | null;
  onClick: (action: DocumentAction) => void;
}

/** Renders a single document action button (Download / WhatsApp / Print) with
 *  a spinner while the PDF is being generated for this specific entity+action. */
export function DocumentActionButton({
  entityId,
  entityLabel,
  action,
  label,
  icon,
  className,
  activeAction,
  onClick,
}: DocumentActionButtonProps) {
  const isActive = activeAction?.id === entityId && activeAction.action === action;
  const isBusy = activeAction?.id === entityId;

  return (
    <button
      type="button"
      onClick={() => onClick(action)}
      disabled={isBusy}
      aria-label={`${label} ${entityLabel}`}
      title={label}
      className={`inline-flex min-h-9 items-center justify-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs font-semibold transition-colors active:scale-95 disabled:cursor-wait disabled:opacity-60 ${className}`}
    >
      {isActive ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : icon}
      <span>{label}</span>
    </button>
  );
}
