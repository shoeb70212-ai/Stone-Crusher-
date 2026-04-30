import React, { useState, useEffect } from "react";
import {
  Truck,
  BookOpen,
  LayoutDashboard,
  Settings,
  LogOut,
  Mountain,
  Users,
  CalendarDays,
  X,
  Receipt,
  ChevronLeft,
  ChevronRight,
  MoreHorizontal,
} from "lucide-react";
import { cn } from "../lib/utils";
import { useErp } from "../context/ErpContext";

interface SidebarProps {
  currentView: string;
  onChangeView: (view: string) => void;
  isOpen: boolean;
  setIsOpen: (isOpen: boolean) => void;
}

const navItems = [
  { id: "dashboard", label: "Dashboard", icon: LayoutDashboard },
  { id: "daybook", label: "Daybook", icon: CalendarDays },
  { id: "dispatch", label: "Dispatch (Slips)", icon: Truck },
  { id: "invoices", label: "Invoicing", icon: Receipt },
  { id: "vehicles", label: "Vehicles", icon: Truck },
  { id: "customers", label: "Customers", icon: Users },
  { id: "ledger", label: "Ledger", icon: BookOpen },
  { id: "settings", label: "Settings", icon: Settings },
];

/** Items shown directly in the mobile bottom bar */
const bottomBarItems = [
  { id: "dashboard", label: "Home", icon: LayoutDashboard },
  { id: "dispatch", label: "Slips", icon: Truck },
  { id: "daybook", label: "Daybook", icon: CalendarDays },
  { id: "invoices", label: "Invoices", icon: Receipt },
];

export function Sidebar({
  currentView,
  onChangeView,
  isOpen,
  setIsOpen,
}: SidebarProps) {
  const { userRole } = useErp();
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [isMoreOpen, setIsMoreOpen] = useState(false);

  // Lock body scroll when the More drawer is open on mobile
  useEffect(() => {
    if (isMoreOpen) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "";
    }
    return () => {
      document.body.style.overflow = "";
    };
  }, [isMoreOpen]);

  const filteredNavItems = navItems.filter((item) => {
    if (
      userRole === "Manager" &&
      (item.id === "ledger" || item.id === "settings")
    )
      return false;
    if (userRole === "Partner" && item.id === "settings") return false;
    return true;
  });

  const handleNavigate = (view: string) => {
    onChangeView(view);
    setIsOpen(false);
    setIsMoreOpen(false);
  };

  return (
    <>
      {/* ── Desktop sidebar backdrop (mobile overlay) ── */}
      <div
        className={cn(
          "fixed inset-0 bg-black/50 z-20 md:hidden transition-opacity",
          isOpen ? "opacity-100" : "opacity-0 pointer-events-none",
        )}
        onClick={() => setIsOpen(false)}
      />

      {/* ── Desktop Sidebar ── */}
      <aside
        className={cn(
          "fixed md:static inset-y-0 left-0 z-30 shrink-0 bg-white dark:bg-zinc-950 text-zinc-600 dark:text-zinc-300 flex flex-col border-r border-zinc-200 dark:border-zinc-800 transition-all duration-300",
          isOpen ? "translate-x-0" : "-translate-x-full md:translate-x-0",
          isCollapsed ? "md:w-20 w-64" : "w-64",
        )}
      >
        {/* Logo */}
        <div className="h-14 md:h-16 flex items-center justify-between px-5 border-b border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-900/50 shrink-0">
          <div className="flex items-center">
            <Mountain className="text-primary-600 dark:text-primary-500 w-6 h-6 shrink-0" />
            {!isCollapsed && (
              <h1 className="text-zinc-900 dark:text-white font-bold font-display text-lg tracking-wide uppercase ml-3 whitespace-nowrap hidden md:block">
                CrushTrack
              </h1>
            )}
            <h1 className="text-zinc-900 dark:text-white font-bold font-display text-lg tracking-wide uppercase ml-3 whitespace-nowrap md:hidden">
              CrushTrack
            </h1>
          </div>
          <button
            className="md:hidden text-zinc-400 hover:text-zinc-900 dark:hover:text-white p-1 rounded-lg active:scale-95 transition-transform"
            onClick={() => setIsOpen(false)}
            aria-label="Close menu"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Nav items */}
        <nav className="flex-1 py-4 px-3 space-y-0.5 overflow-y-auto">
          {filteredNavItems.map((item) => {
            const Icon = item.icon;
            const isActive = currentView === item.id;

            return (
              <button
                key={item.id}
                title={isCollapsed ? item.label : undefined}
                onClick={() => handleNavigate(item.id)}
                className={cn(
                  "w-full flex items-center px-3 py-2.5 rounded-xl text-sm font-medium transition-all duration-150 group relative",
                  isActive
                    ? "bg-primary-50 dark:bg-primary-500/10 text-primary-700 dark:text-primary-300"
                    : "hover:bg-zinc-100 dark:hover:bg-zinc-800/60 text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-white",
                  isCollapsed ? "justify-center" : "justify-start",
                )}
              >
                {isActive && (
                  <div className="absolute left-0 top-1/2 -translate-y-1/2 w-1 h-6 bg-primary-500 rounded-r-full" />
                )}
                <Icon
                  className={cn(
                    "w-5 h-5 shrink-0",
                    isActive
                      ? "text-primary-500"
                      : "text-zinc-400 group-hover:text-zinc-700 dark:group-hover:text-white",
                    !isCollapsed && "mr-3",
                  )}
                />
                {!isCollapsed && (
                  <span className="truncate hidden md:block">{item.label}</span>
                )}
                <span className="truncate md:hidden">{item.label}</span>
              </button>
            );
          })}
        </nav>

        {/* Bottom section */}
        <div className="p-3 border-t border-zinc-200 dark:border-zinc-800 shrink-0">
          {!isCollapsed && (
            <div className="mb-3 px-3 text-xs font-semibold text-zinc-400 dark:text-zinc-500 uppercase tracking-widest hidden md:block">
              Role: {userRole}
            </div>
          )}
          <div className="mb-3 px-3 text-xs font-semibold text-zinc-400 dark:text-zinc-500 uppercase tracking-widest md:hidden">
            Role: {userRole}
          </div>

          <button
            onClick={() => {
              localStorage.removeItem("erp_auth_token");
              window.location.reload();
            }}
            title={isCollapsed ? "Logout" : undefined}
            className={cn(
              "flex items-center text-sm font-medium text-zinc-600 dark:text-zinc-400 hover:text-rose-600 dark:hover:text-rose-400 w-full rounded-xl hover:bg-rose-50 dark:hover:bg-rose-500/10 transition-all group active:scale-[0.98]",
              isCollapsed ? "p-3 justify-center mb-3" : "px-3 py-2.5 mb-2",
            )}
          >
            <LogOut
              className={cn(
                "w-5 h-5 shrink-0",
                !isCollapsed && "mr-3",
              )}
            />
            {!isCollapsed && <span className="hidden md:inline">Sign Out</span>}
            <span className="md:hidden">Sign Out</span>
          </button>

          {/* Collapse toggle – desktop only */}
          <button
            onClick={() => setIsCollapsed(!isCollapsed)}
            className="hidden md:flex items-center justify-center w-full px-3 py-2 text-zinc-500 hover:text-zinc-900 dark:hover:text-white hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded-xl transition-colors"
            aria-label={isCollapsed ? "Expand sidebar" : "Collapse sidebar"}
          >
            {isCollapsed ? (
              <ChevronRight className="w-5 h-5" />
            ) : (
              <ChevronLeft className="w-5 h-5" />
            )}
          </button>
        </div>
      </aside>

      {/* ═══════════════════════════════════════════════════════════
          Mobile Bottom Navigation Bar - Thumb Zone Optimized
          ═══════════════════════════════════════════════════════════ */}
      <nav className="md:hidden fixed bottom-0 left-0 right-0 bg-white/95 dark:bg-zinc-950/95 backdrop-blur-md border-t border-zinc-200 dark:border-zinc-800 z-40 flex items-stretch shadow-[0_-1px_0_0_rgba(0,0,0,0.06),0_-4px_16px_-4px_rgba(0,0,0,0.08)] pb-[env(safe-area-inset-bottom)] min-h-[64px]">
        {bottomBarItems.map((item) => {
          const Icon = item.icon;
          const isActive = currentView === item.id;
          return (
            <button
              key={item.id}
              onClick={() => handleNavigate(item.id)}
              className={cn(
                "flex-1 flex flex-col items-center justify-center gap-0.5 py-2 min-h-[56px] transition-all duration-150 active:scale-95 active:bg-primary-50/50 dark:active:bg-primary-500/10",
                isActive
                  ? "text-primary-600 dark:text-primary-400"
                  : "text-zinc-500 dark:text-zinc-400",
              )}
              aria-label={item.label}
            >
              {isActive && (
                <div className="absolute top-0 left-1/2 -translate-x-1/2 w-10 h-0.5 bg-primary-500 rounded-b-full" />
              )}
              <Icon
                className="w-5 h-5"
                strokeWidth={isActive ? 2.5 : 2}
              />
              <span
                className={cn(
                  "text-[10px] font-medium leading-none",
                  isActive ? "font-semibold" : "",
                )}
              >
                {item.label}
              </span>
            </button>
          );
        })}

        {/* "More" button */}
        <button
          onClick={() => setIsMoreOpen(true)}
          className={cn(
            "flex-1 flex flex-col items-center justify-center gap-0.5 py-2 min-h-[56px] transition-all duration-150 active:scale-95 active:bg-zinc-100 dark:active:bg-zinc-800",
            isMoreOpen
              ? "text-primary-600 dark:text-primary-400"
              : "text-zinc-500 dark:text-zinc-400",
          )}
          aria-label="More"
        >
          <MoreHorizontal className="w-5 h-5" strokeWidth={2} />
          <span className="text-[10px] font-medium leading-none">More</span>
        </button>
      </nav>

      {/* ═══════════════════════════════════════════════════════════
          Mobile "More" Drawer (slide-up sheet)
          ═══════════════════════════════════════════════════════════ */}
      {isMoreOpen && (
        <div className="md:hidden fixed inset-0 z-50 flex flex-col justify-end">
          {/* Backdrop */}
          <div
            className="absolute inset-0 bg-black/40 backdrop-blur-sm"
            onClick={() => setIsMoreOpen(false)}
          />
          {/* Sheet */}
          <div className="relative bg-white dark:bg-zinc-900 rounded-t-2xl shadow-2xl pb-[env(safe-area-inset-bottom)]">
            {/* Handle */}
            <div className="flex justify-center pt-3 pb-2">
              <div className="w-10 h-1 bg-zinc-300 dark:bg-zinc-600 rounded-full" />
            </div>

            {/* Header */}
            <div className="flex items-center justify-between px-5 pb-3 border-b border-zinc-100 dark:border-zinc-800">
              <div className="flex items-center gap-2">
                <Mountain className="text-primary-500 w-5 h-5" />
                <span className="font-bold text-zinc-900 dark:text-white text-base tracking-wide uppercase">
                  CrushTrack
                </span>
              </div>
              <button
                onClick={() => setIsMoreOpen(false)}
                className="p-2 rounded-xl text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors active:scale-95"
                aria-label="Close"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Nav grid */}
            <div className="px-4 py-4 grid grid-cols-3 gap-3">
              {filteredNavItems.map((item) => {
                const Icon = item.icon;
                const isActive = currentView === item.id;
                return (
                  <button
                    key={item.id}
                    onClick={() => handleNavigate(item.id)}
                    className={cn(
                      "flex flex-col items-center gap-2 py-4 px-2 rounded-2xl transition-all active:scale-95",
                      isActive
                        ? "bg-primary-50 dark:bg-primary-500/15 text-primary-600 dark:text-primary-400"
                        : "bg-zinc-50 dark:bg-zinc-800/60 text-zinc-600 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-700",
                    )}
                  >
                    <Icon
                      className="w-6 h-6"
                      strokeWidth={isActive ? 2.5 : 2}
                    />
                    <span className="text-xs font-medium text-center leading-tight">
                      {item.label.replace(" (Slips)", "")}
                    </span>
                  </button>
                );
              })}
            </div>

            {/* Role + sign out */}
            <div className="px-4 pb-4 pt-1 border-t border-zinc-100 dark:border-zinc-800 flex items-center justify-between">
              <span className="text-xs font-semibold text-zinc-400 uppercase tracking-widest">
                Role: {userRole}
              </span>
              <button
                onClick={() => {
                  localStorage.removeItem("erp_auth_token");
                  window.location.reload();
                }}
                className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-rose-600 dark:text-rose-400 bg-rose-50 dark:bg-rose-500/10 rounded-xl hover:bg-rose-100 dark:hover:bg-rose-500/20 transition-colors active:scale-95"
              >
                <LogOut className="w-4 h-4" />
                Sign Out
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
