import React, { useState } from "react";
import { Bell, Search, Shield, X } from "lucide-react";
import { format } from "date-fns";
import { useErp, UserRole } from "../context/ErpContext";

interface HeaderProps {
  onMenuClick?: () => void;
}

export function Header({ onMenuClick }: HeaderProps) {
  const { userRole, setUserRole } = useErp();
  const [isRoleDropdownOpen, setIsRoleDropdownOpen] = useState(false);
  const [isSearchOpen, setIsSearchOpen] = useState(false);

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
        {/* Mobile search toggle */}
        <button
          onClick={() => setIsSearchOpen(true)}
          className="md:hidden p-2 rounded-xl text-zinc-500 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-white hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors active:scale-95"
          aria-label="Search"
        >
          <Search className="w-5 h-5" />
        </button>

        {/* Desktop search */}
        <div className="relative hidden md:block">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400 dark:text-zinc-500" />
          <input
            type="text"
            placeholder="Search slips, customers..."
            className="pl-9 pr-4 py-2 bg-zinc-100 dark:bg-zinc-900 border border-transparent rounded-full text-sm focus:border-zinc-300 dark:focus:border-zinc-700 focus:bg-white dark:focus:bg-zinc-800 dark:text-white outline-none w-64 transition-all placeholder:text-zinc-400 dark:placeholder:text-zinc-500"
          />
        </div>

        {/* Notifications */}
        <button className="relative p-2 rounded-xl text-zinc-400 dark:text-zinc-500 hover:text-zinc-600 dark:hover:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors active:scale-95">
          <Bell className="w-5 h-5" />
          <span className="absolute top-2 right-2 w-1.5 h-1.5 bg-rose-500 rounded-full" />
        </button>

        {/* Role selector */}
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
                  Switch Role
                </div>
                {(["Admin", "Partner", "Manager"] as UserRole[]).map((role) => (
                  <button
                    key={role}
                    onClick={() => {
                      setUserRole(role);
                      setIsRoleDropdownOpen(false);
                    }}
                    className={`w-full text-left px-4 py-2.5 text-sm font-medium transition-colors ${
                      userRole === role
                        ? "text-primary-600 dark:text-primary-400 bg-primary-50/50 dark:bg-primary-500/10"
                        : "text-zinc-700 dark:text-zinc-300 hover:bg-zinc-50 dark:hover:bg-zinc-700"
                    }`}
                  >
                    {role}
                  </button>
                ))}
                <div className="border-t border-zinc-100 dark:border-zinc-700" />
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

      {/* Mobile full-screen search overlay */}
      {isSearchOpen && (
        <div className="md:hidden fixed inset-0 z-50 bg-white dark:bg-zinc-950 flex flex-col">
          <div className="flex items-center gap-3 px-4 h-14 border-b border-zinc-200 dark:border-zinc-800">
            <Search className="w-5 h-5 text-zinc-400 shrink-0" />
            <input
              autoFocus
              type="text"
              placeholder="Search slips, customers..."
              className="flex-1 bg-transparent text-base text-zinc-900 dark:text-white outline-none placeholder:text-zinc-400"
            />
            <button
              onClick={() => setIsSearchOpen(false)}
              className="p-1.5 rounded-lg text-zinc-400 hover:text-zinc-700 dark:hover:text-white active:scale-95 transition-transform"
              aria-label="Close search"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
          <div className="flex-1 flex items-start justify-center pt-16 text-zinc-400 text-sm">
            Start typing to search…
          </div>
        </div>
      )}
    </header>
  );
}
