import React, { useState } from "react";
import { Bell, Shield, Loader2, AlertTriangle } from "lucide-react";
import { format } from "date-fns";
import { useErp } from "../context/ErpContext";

interface HeaderProps {
  onMenuClick?: () => void;
}

export function Header({ onMenuClick }: HeaderProps) {
  const { userRole, syncStatus } = useErp();
  const [isRoleDropdownOpen, setIsRoleDropdownOpen] = useState(false);

  return (
    <header className="flex h-12 md:h-16 bg-white/95 dark:bg-zinc-950/95 backdrop-blur-md border-b border-zinc-200 dark:border-zinc-800 px-2 md:px-8 items-center justify-between shrink-0 transition-colors z-20 mobile-header">
      {/* Left: date (desktop) / app name (mobile) */}
      <div className="flex items-center gap-2 flex-1 min-w-0">
        <span className="text-xs md:text-sm font-medium text-zinc-500 dark:text-zinc-400 hidden sm:block truncate">
          {format(new Date(), "EEE, dd MMM yyyy")}
        </span>
        <span className="text-sm font-bold text-zinc-900 dark:text-white sm:hidden tracking-tight mobile-header-title">
          CrushTrack
        </span>
      </div>

      {/* Right actions */}
      <div className="flex items-center gap-1 md:gap-3 shrink-0">

        {/* Notifications */}
        <button className="relative p-2 rounded-xl text-zinc-400 dark:text-zinc-500 hover:text-zinc-600 dark:hover:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors active:scale-95">
          <Bell className="w-5 h-5" />
        </button>

        {/* Sync status indicator */}
        {syncStatus === 'syncing' && (
          <span
            className="p-2 text-zinc-400 dark:text-zinc-500"
            aria-label="Saving changes…"
            title="Saving changes…"
          >
            <Loader2 className="w-4 h-4 animate-spin" />
          </span>
        )}
        {syncStatus === 'error' && (
          <span
            className="p-2 text-rose-500"
            aria-label="Sync failed — changes may not be saved"
            title="Sync failed — changes may not be saved"
            role="alert"
          >
            <AlertTriangle className="w-4 h-4" />
          </span>
        )}

        {/* Role badge + Sign Out */}
        <div className="relative">
          <button
            onClick={() => setIsRoleDropdownOpen(!isRoleDropdownOpen)}
            className="h-9 pl-2.5 pr-2 rounded-xl bg-primary-50 dark:bg-primary-500/10 flex items-center gap-1.5 text-primary-700 dark:text-primary-300 font-semibold text-sm border border-primary-100 dark:border-primary-500/20 hover:bg-primary-100 dark:hover:bg-primary-500/20 transition-colors active:scale-95"
          >
            <Shield className="w-3.5 h-3.5 shrink-0" />
            <span className="hidden sm:inline">{userRole}</span>
            <div className="w-6 h-6 rounded-lg bg-primary-200 dark:bg-primary-500/30 flex items-center justify-center text-primary-800 dark:text-primary-200 text-xs font-bold">
              {userRole.charAt(0)}
            </div>
          </button>

          {isRoleDropdownOpen && (
            <>
              <div
                className="fixed inset-0 z-40"
                onClick={() => setIsRoleDropdownOpen(false)}
              />
              <div className="absolute top-11 right-0 z-50 w-48 bg-white dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-xl shadow-lg overflow-hidden">
                <div className="px-4 py-2.5 text-xs font-semibold text-zinc-500 dark:text-zinc-400 bg-zinc-50 dark:bg-zinc-900/50 border-b border-zinc-100 dark:border-zinc-700 uppercase tracking-wider">
                  Signed in as {userRole}
                </div>
                <button
                  onClick={() => {
                    localStorage.removeItem("erp_auth_token");
                    window.location.reload();
                  }}
                  className="w-full text-left px-4 py-2.5 text-sm font-medium text-rose-600 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-500/10 transition-colors"
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
