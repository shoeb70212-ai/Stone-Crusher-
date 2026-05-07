import React, { useState, useEffect } from "react";
import { Bell, Shield, Loader2, AlertTriangle, Sun, Moon, Monitor, ArrowLeft } from "lucide-react";
import { format } from "date-fns";
import { useErp } from "../context/ErpContext";
import { clearAuthSession } from "../lib/session";
import { NAVIGATE_EVENT } from "./Layout";

const PAGE_TITLES: Record<string, string> = {
  dashboard: "Dashboard",
  dispatch: "Dispatch",
  invoices: "Invoices",
  quotations: "Quotations",
  customers: "Customers",
  employees: "Employees",
  daybook: "Daybook",
  ledger: "Ledger",
  vehicles: "Vehicles",
  settings: "Settings",
  audit: "Audit Log",
};

interface HeaderProps {
  onMenuClick?: () => void;
  currentView?: string;
}

export function Header({ onMenuClick: _onMenuClick, currentView: currentViewProp }: HeaderProps) {
  const { userRole, syncStatus, pendingSyncCount, companySettings, updateCompanySettings } = useErp();
  const [isRoleDropdownOpen, setIsRoleDropdownOpen] = useState(false);
  // eventView tracks navigation driven by the legacy NAVIGATE_EVENT custom event.
  // When the caller passes currentViewProp (from wouter), that takes precedence.
  const [eventView, setEventView] = useState("dashboard");
  const currentView = currentViewProp ?? eventView;

  useEffect(() => {
    const handler = (e: Event) => setEventView((e as CustomEvent<string>).detail);
    window.addEventListener(NAVIGATE_EVENT, handler);
    return () => window.removeEventListener(NAVIGATE_EVENT, handler);
  }, []);

  const theme = companySettings.theme ?? "system";
  const cycleTheme = () => {
    const next = theme === "light" ? "dark" : theme === "dark" ? "system" : "light";
    void updateCompanySettings({ ...companySettings, theme: next as "light" | "dark" | "system" });
  };
  const ThemeIcon = theme === "dark" ? Moon : theme === "light" ? Sun : Monitor;

  const showBack = currentView !== "dashboard";

  return (
    <header
      className="flex h-14 md:h-16 bg-background/85 backdrop-blur-xl border-b border-border px-3 md:px-6 items-center justify-between shrink-0 transition-colors sticky top-0 z-30 mobile-header"
      style={{ paddingTop: 'max(4px, env(safe-area-inset-top))' }}
    >
      {/* Left: date (desktop) / page title or back (mobile) */}
      <div className="flex items-center gap-3 flex-1 min-w-0">
        {showBack ? (
          <button
            onClick={() => window.dispatchEvent(new CustomEvent(NAVIGATE_EVENT, { detail: "dashboard" }))}
            className="sm:hidden flex items-center gap-1.5 text-sm font-display font-bold text-foreground tracking-tight active:scale-95 transition-transform"
            aria-label="Back to dashboard"
          >
            <ArrowLeft className="w-5 h-5 shrink-0" />
            <span className="mobile-header-title truncate">{PAGE_TITLES[currentView] ?? "CrushTrack"}</span>
          </button>
        ) : (
          /* On the dashboard, show app name + today's date so mobile users
             always have a temporal anchor without opening a calendar. */
          <div className="sm:hidden flex flex-col leading-tight">
            <span className="text-sm font-display font-bold text-foreground tracking-tight">
              CrushTrack
            </span>
            <span className="text-[10px] text-muted-foreground tabular-nums">
              {format(new Date(), "EEE, dd MMM")}
            </span>
          </div>
        )}
        {/* Desktop date — refined typography */}
        <div className="hidden sm:flex flex-col leading-tight">
          <span className="text-[10px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">
            Today
          </span>
          <span className="text-sm font-medium text-foreground tabular-nums">
            {format(new Date(), "EEE, dd MMM yyyy")}
          </span>
        </div>
      </div>

      {/* Right actions — consistent 40×40 hit targets, semantic colors */}
      <div className="flex items-center gap-1 shrink-0">

        {/* Sync status — only renders when syncing/error so it doesn't take
            up space when idle. Now sits inline with the icon row. */}
        {pendingSyncCount > 0 && syncStatus !== 'syncing' && syncStatus !== 'error' && (
          <span
            className="hidden sm:inline-flex items-center gap-1.5 px-2.5 h-8 rounded-full bg-muted text-muted-foreground text-xs font-medium"
            title={`${pendingSyncCount} messages pending to sync`}
          >
            <Loader2 className="w-3.5 h-3.5 opacity-50" />
            {pendingSyncCount} pending
          </span>
        )}
        {syncStatus === 'syncing' && (
          <span
            className="hidden sm:inline-flex items-center gap-1.5 px-2.5 h-8 rounded-full bg-muted text-muted-foreground text-xs font-medium"
            title={`Syncing ${pendingSyncCount} messages…`}
          >
            <Loader2 className="w-3.5 h-3.5 animate-spin" />
            {pendingSyncCount > 0 ? `Syncing ${pendingSyncCount}` : 'Saving'}
          </span>
        )}
        {syncStatus === 'error' && (
          <span
            className="hidden sm:inline-flex items-center gap-1.5 px-2.5 h-8 rounded-full bg-danger-muted text-danger text-xs font-semibold"
            title={`${pendingSyncCount} changes failed to sync`}
            role="alert"
          >
            <AlertTriangle className="w-3.5 h-3.5" />
            Error ({pendingSyncCount})
          </span>
        )}
        {/* Mobile-only compact sync indicator — icon + badge only to preserve
            header space. Full text label is shown on sm+ screens above. */}
        {pendingSyncCount > 0 && syncStatus !== 'syncing' && syncStatus !== 'error' && (
          <span
            className="sm:hidden relative w-10 h-10 inline-flex items-center justify-center"
            title={`${pendingSyncCount} change${pendingSyncCount === 1 ? '' : 's'} pending sync`}
          >
            <Loader2 className="w-4 h-4 text-muted-foreground opacity-60" />
            <span className="absolute top-1.5 right-1.5 w-4 h-4 bg-primary-500 text-white text-[9px] font-bold rounded-full flex items-center justify-center leading-none">
              {pendingSyncCount > 9 ? '9+' : pendingSyncCount}
            </span>
          </span>
        )}
        {syncStatus === 'syncing' && (
          <span
            className="sm:hidden relative w-10 h-10 inline-flex items-center justify-center"
            title={`Syncing${pendingSyncCount > 0 ? ` ${pendingSyncCount} change${pendingSyncCount === 1 ? '' : 's'}` : ''}…`}
          >
            <Loader2 className="w-4 h-4 text-muted-foreground animate-spin" />
          </span>
        )}
        {syncStatus === 'error' && (
          <span
            className="sm:hidden relative w-10 h-10 inline-flex items-center justify-center"
            title={`Sync error${pendingSyncCount > 0 ? ` — ${pendingSyncCount} change${pendingSyncCount === 1 ? '' : 's'} pending` : ''}`}
            role="alert"
          >
            <AlertTriangle className="w-4 h-4 text-danger" />
            {pendingSyncCount > 0 && (
              <span className="absolute top-1.5 right-1.5 w-4 h-4 bg-danger text-white text-[9px] font-bold rounded-full flex items-center justify-center leading-none">
                {pendingSyncCount > 9 ? '9+' : pendingSyncCount}
              </span>
            )}
          </span>
        )}

        {/* Theme toggle — cycles light → dark → system */}
        <button
          onClick={cycleTheme}
          title={`Theme: ${theme}. Click to cycle.`}
          className="w-10 h-10 inline-flex items-center justify-center rounded-xl text-muted-foreground hover:text-foreground hover:bg-muted transition-colors active:scale-95"
          aria-label={`Switch theme (current: ${theme})`}
        >
          <ThemeIcon className="w-[18px] h-[18px]" />
        </button>

        {/* Notifications */}
        <button
          className="relative w-10 h-10 inline-flex items-center justify-center rounded-xl text-muted-foreground hover:text-foreground hover:bg-muted transition-colors active:scale-95"
          aria-label="View notifications"
          title="Notifications"
        >
          <Bell className="w-[18px] h-[18px]" />
        </button>

        {/* Subtle vertical divider before role pill */}
        <div className="w-px h-6 bg-border mx-1.5 hidden sm:block" aria-hidden="true" />

        {/* Role badge — refined, dignified, less visually loud */}
        <div className="relative">
          <button
            onClick={() => setIsRoleDropdownOpen(!isRoleDropdownOpen)}
            aria-haspopup="menu"
            aria-expanded={isRoleDropdownOpen}
            className="h-10 sm:h-9 pl-1 pr-1 sm:pl-1 sm:pr-2.5 rounded-full sm:rounded-xl flex items-center gap-2 text-sm font-medium text-foreground hover:bg-muted transition-colors active:scale-95"
          >
            <span
              className="w-8 h-8 sm:w-7 sm:h-7 rounded-full sm:rounded-lg bg-primary-600 text-white flex items-center justify-center text-xs font-bold tracking-wide shadow-elev-xs"
              aria-hidden="true"
            >
              {userRole?.charAt(0) ?? '?'}
            </span>
            <span className="hidden sm:inline-flex items-center gap-1 text-foreground">
              <span className="font-medium">{userRole ?? '—'}</span>
            </span>
          </button>

          {isRoleDropdownOpen && (
            <>
              <div
                className="fixed inset-0 z-40"
                onClick={() => setIsRoleDropdownOpen(false)}
              />
              <div
                role="menu"
                className="absolute top-12 right-0 z-50 w-56 card-surface shadow-elev-lg overflow-hidden animate-scale-in origin-top-right"
              >
                <div className="px-4 pt-3 pb-2 border-b border-border">
                  <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-[0.1em]">
                    Signed in as
                  </p>
                  <div className="flex items-center gap-2 mt-1">
                    <Shield className="w-3.5 h-3.5 text-primary-600" />
                    <p className="text-sm font-semibold text-foreground">{userRole}</p>
                  </div>
                </div>
                <button
                  role="menuitem"
                  onClick={async () => {
                    await clearAuthSession();
                    window.location.reload();
                  }}
                  className="w-full text-left px-4 py-2.5 text-sm font-medium text-danger hover:bg-danger-muted transition-colors"
                >
                  Sign Out
                </button>
              </div>
            </>
          )}
        </div>
      </div>

    </header>
  );
}
