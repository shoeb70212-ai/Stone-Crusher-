import React, { useState, useEffect } from "react";
import {
  Truck,
  BookOpen,
  LayoutDashboard,
  Settings,
  LogOut,
  Mountain,
  Users,
  Briefcase,
  CalendarDays,
  X,
  Receipt,
  ChevronLeft,
  ChevronRight,
  MoreHorizontal,
  History,
} from "lucide-react";
import { cn } from "../lib/utils";
import { useErp } from "../context/ErpContext";
import { clearAuthSession } from "../lib/session";
import { useHapticFeedback } from "../lib/use-haptic-feedback";

interface SidebarProps {
  currentView: string;
  onChangeView: (view: string) => void;
  isOpen: boolean;
  setIsOpen: (isOpen: boolean) => void;
}

/** Grouped nav structure — gives the sidebar a clearer hierarchy and
 *  makes long lists easier to scan than one flat column of 10 items. */
const navGroups: { label: string; items: { id: string; label: string; icon: typeof LayoutDashboard }[] }[] = [
  {
    label: "Overview",
    items: [
      { id: "dashboard", label: "Dashboard", icon: LayoutDashboard },
      { id: "daybook", label: "Daybook", icon: CalendarDays },
    ],
  },
  {
    label: "Operations",
    items: [
      { id: "dispatch", label: "Dispatch", icon: Truck },
      { id: "invoices", label: "Invoicing", icon: Receipt },
      { id: "vehicles", label: "Vehicles", icon: Truck },
    ],
  },
  {
    label: "Records",
    items: [
      { id: "customers", label: "Customers", icon: Users },
      { id: "employees", label: "Employees", icon: Briefcase },
      { id: "ledger", label: "Ledger", icon: BookOpen },
    ],
  },
  {
    label: "Account",
    items: [
      { id: "audit", label: "Audit Log", icon: History },
      { id: "settings", label: "Settings", icon: Settings },
    ],
  },
];

/** Flat list used by the mobile More-drawer filtering logic. */
const navItems = navGroups.flatMap((g) => g.items);

/** Items shown directly in the mobile bottom bar */
const bottomBarItems = [
  { id: "dashboard", label: "Home", icon: LayoutDashboard },
  { id: "dispatch", label: "Slips", icon: Truck },
  { id: "daybook", label: "Daybook", icon: CalendarDays },
  { id: "invoices", label: "Invoices", icon: Receipt },
];

/** IDs of items already in the bottom bar - used to filter the More drawer */
const bottomBarIds = new Set(bottomBarItems.map(item => item.id));

export function Sidebar({
  currentView,
  onChangeView,
  isOpen,
  setIsOpen,
}: SidebarProps) {
  const { userRole } = useErp();
  const { tap } = useHapticFeedback();
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
      (item.id === "ledger" || item.id === "settings" || item.id === "employees")
    )
      return false;
    if (userRole !== "Admin" && item.id === "employees") return false;
    if (userRole === "Partner" && item.id === "settings") return false;
    if (userRole !== "Admin" && item.id === "audit") return false;
    return true;
  });

  const handleNavigate = (view: string) => {
    tap();
    onChangeView(view);
    setIsOpen(false);
    setIsMoreOpen(false);
  };

  return (
    <>
      {/* ── Mobile overlay backdrop ── */}
      <div
        className={cn(
          "fixed inset-0 bg-foreground/40 backdrop-blur-sm z-20 md:hidden transition-opacity",
          isOpen ? "opacity-100" : "opacity-0 pointer-events-none",
        )}
        onClick={() => setIsOpen(false)}
      />

      {/* ── Desktop Sidebar ── */}
      <aside
        className={cn(
          "fixed md:static inset-y-0 left-0 z-30 shrink-0 bg-surface text-foreground flex flex-col border-r border-border transition-[width,transform] duration-300",
          isOpen ? "translate-x-0" : "-translate-x-full md:translate-x-0",
          isCollapsed ? "md:w-[72px] w-72" : "w-72",
        )}
      >
        {/* ── Brand mark ── */}
        <div className="h-14 md:h-16 flex items-center justify-between px-5 border-b border-border shrink-0">
          <div className="flex items-center min-w-0">
            <div className="w-8 h-8 rounded-lg bg-primary-600 flex items-center justify-center shrink-0 shadow-elev-sm">
              <Mountain className="text-white w-[18px] h-[18px]" strokeWidth={2.25} />
            </div>
            {!isCollapsed && (
              <div className="ml-3 hidden md:block leading-tight">
                <h1 className="text-foreground font-display font-bold text-base tracking-tight whitespace-nowrap">
                  CrushTrack
                </h1>
                <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">
                  Stone Crusher ERP
                </p>
              </div>
            )}
            {/* Mobile: always show full title */}
            <div className="ml-3 md:hidden leading-tight">
              <h1 className="text-foreground font-display font-bold text-base tracking-tight whitespace-nowrap">
                CrushTrack
              </h1>
              <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">
                Stone Crusher ERP
              </p>
            </div>
          </div>
          <button
            className="md:hidden text-muted-foreground hover:text-foreground p-1.5 rounded-lg hover:bg-muted active:scale-95 transition-all"
            onClick={() => setIsOpen(false)}
            aria-label="Close menu"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* ── Nav (grouped sections) ── */}
        <nav className="flex-1 py-3 px-3 overflow-y-auto" aria-label="Primary">
          {navGroups.map((group, gi) => {
            const groupItems = group.items.filter((item) =>
              filteredNavItems.some((f) => f.id === item.id),
            );
            if (groupItems.length === 0) return null;

            return (
              <div key={group.label} className={cn(gi > 0 && "mt-5")}>
                {/* Group label — hidden when collapsed */}
                {!isCollapsed && (
                  <div className="px-3 mb-1.5 text-[10px] font-semibold text-muted-foreground uppercase tracking-[0.12em]">
                    {group.label}
                  </div>
                )}
                {/* When collapsed on desktop, render a thin divider instead */}
                {isCollapsed && gi > 0 && (
                  <div className="hidden md:block mx-3 mb-2 h-px bg-border" aria-hidden="true" />
                )}

                <div className="space-y-0.5">
                  {groupItems.map((item) => {
                    const Icon = item.icon;
                    const isActive = currentView === item.id;
                    return (
                      <button
                        key={item.id}
                        title={isCollapsed ? item.label : undefined}
                        onClick={() => handleNavigate(item.id)}
                        aria-current={isActive ? "page" : undefined}
                        className={cn(
                          "w-full flex items-center h-10 rounded-lg text-sm font-medium transition-colors group relative",
                          isCollapsed ? "md:justify-center md:px-0 px-3" : "px-3",
                          isActive
                            ? "bg-muted text-foreground"
                            : "text-muted-foreground hover:bg-muted hover:text-foreground",
                        )}
                      >
                        {/* Active indicator — single subtle vertical bar */}
                        {isActive && (
                          <span
                            aria-hidden="true"
                            className="absolute left-0 top-1.5 bottom-1.5 w-[3px] bg-primary-600 rounded-r-full animate-indicator"
                          />
                        )}
                        <Icon
                          className={cn(
                            "w-[18px] h-[18px] shrink-0 transition-colors",
                            isActive
                              ? "text-primary-600"
                              : "text-muted-foreground group-hover:text-foreground",
                            !isCollapsed && "mr-3",
                          )}
                          strokeWidth={isActive ? 2.25 : 2}
                        />
                        {!isCollapsed && (
                          <span className="truncate hidden md:block">{item.label}</span>
                        )}
                        <span className="truncate md:hidden">{item.label}</span>
                      </button>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </nav>

        {/* ── Footer: role card + sign out + collapse toggle ── */}
        <div className="p-3 border-t border-border shrink-0 space-y-1.5">
          {/* Role card — clean, semantic, dignified */}
          {!isCollapsed && (
            <div className="hidden md:flex items-center gap-2.5 px-3 py-2 rounded-lg bg-muted">
              <div className="w-7 h-7 rounded-md bg-primary-600 text-white flex items-center justify-center text-xs font-bold shrink-0">
                {userRole?.charAt(0) ?? '?'}
              </div>
              <div className="min-w-0 leading-tight">
                <p className="text-[10px] font-semibold uppercase tracking-[0.1em] text-muted-foreground">
                  Signed in
                </p>
                <p className="text-xs font-semibold text-foreground truncate">{userRole ?? '—'}</p>
              </div>
            </div>
          )}
          {/* Mobile sidebar role row */}
          <div className="md:hidden flex items-center gap-2.5 px-3 py-2 rounded-lg bg-muted">
            <div className="w-7 h-7 rounded-md bg-primary-600 text-white flex items-center justify-center text-xs font-bold shrink-0">
              {userRole?.charAt(0) ?? '?'}
            </div>
            <div className="min-w-0 leading-tight">
              <p className="text-[10px] font-semibold uppercase tracking-[0.1em] text-muted-foreground">
                Signed in
              </p>
              <p className="text-xs font-semibold text-foreground truncate">{userRole ?? '—'}</p>
            </div>
          </div>

          <button
            onClick={async () => {
              await clearAuthSession();
              window.location.reload();
            }}
            title={isCollapsed ? "Sign out" : undefined}
            className={cn(
              "flex items-center text-sm font-medium text-muted-foreground hover:text-danger w-full rounded-lg hover:bg-danger-muted transition-colors active:scale-[0.98]",
              isCollapsed ? "md:p-2.5 md:justify-center px-3 py-2" : "px-3 py-2",
            )}
          >
            <LogOut
              className={cn(
                "w-[18px] h-[18px] shrink-0",
                !isCollapsed && "mr-3",
              )}
            />
            {!isCollapsed && <span className="hidden md:inline">Sign Out</span>}
            <span className="md:hidden">Sign Out</span>
          </button>

          {/* Collapse toggle — desktop only */}
          <button
            onClick={() => setIsCollapsed(!isCollapsed)}
            className="hidden md:flex items-center justify-center w-full h-9 text-muted-foreground hover:text-foreground hover:bg-muted rounded-lg transition-colors"
            aria-label={isCollapsed ? "Expand sidebar" : "Collapse sidebar"}
          >
            {isCollapsed ? (
              <ChevronRight className="w-[18px] h-[18px]" />
            ) : (
              <>
                <ChevronLeft className="w-[18px] h-[18px] mr-1.5" />
                <span className="text-xs font-medium">Collapse</span>
              </>
            )}
          </button>
        </div>
      </aside>

      {/* ═══════════════════════════════════════════════════════════
          Mobile Bottom Navigation Bar — refined active state
          (subtle dot + bolder icon + color, no full pill background).
          Sits on a translucent surface so content gently blurs behind it.
          ═══════════════════════════════════════════════════════════ */}
      <nav
        className="md:hidden fixed bottom-0 left-0 right-0 backdrop-blur-xl bg-surface/90 border-t border-border z-40 flex items-stretch pb-[env(safe-area-inset-bottom)] min-h-16"
        aria-label="Primary"
      >
        {bottomBarItems.map((item) => {
          const Icon = item.icon;
          const isActive = currentView === item.id;
          return (
            <button
              key={item.id}
              onClick={() => handleNavigate(item.id)}
              aria-current={isActive ? "page" : undefined}
              className={cn(
                "flex-1 flex flex-col items-center justify-center gap-0.5 py-2 min-h-14 transition-colors duration-150 active:scale-95 relative",
                isActive
                  ? "text-primary-600 dark:text-primary-400"
                  : "text-muted-foreground hover:text-foreground",
              )}
              aria-label={item.label}
            >
              {/* Active indicator: small dot above icon */}
              <span
                aria-hidden="true"
                className={cn(
                  "absolute top-1.5 w-1 h-1 rounded-full bg-primary-600 dark:bg-primary-400 transition-all",
                  isActive ? "opacity-100 scale-100" : "opacity-0 scale-50",
                )}
              />
              <Icon className="w-[22px] h-[22px]" strokeWidth={isActive ? 2.25 : 2} />
              <span className={cn(
                "text-[10px] tracking-wide leading-none mt-1",
                isActive ? "font-semibold" : "font-medium"
              )}>
                {item.label}
              </span>
            </button>
          );
        })}

        {/* "More" button — same treatment as nav items */}
        <button
          onClick={() => { tap(); setIsMoreOpen(true); }}
          className={cn(
            "flex-1 flex flex-col items-center justify-center gap-0.5 py-2 min-h-14 transition-colors duration-150 active:scale-95 relative",
            isMoreOpen
              ? "text-foreground"
              : "text-muted-foreground hover:text-foreground",
          )}
          aria-label="More"
          aria-expanded={isMoreOpen}
        >
          <span
            aria-hidden="true"
            className={cn(
              "absolute top-1.5 w-1 h-1 rounded-full bg-foreground transition-all",
              isMoreOpen ? "opacity-100 scale-100" : "opacity-0 scale-50",
            )}
          />
          <MoreHorizontal className="w-[22px] h-[22px]" strokeWidth={isMoreOpen ? 2.25 : 2} />
          <span className={cn(
            "text-[10px] tracking-wide leading-none mt-1",
            isMoreOpen ? "font-semibold" : "font-medium"
          )}>
            More
          </span>
        </button>
      </nav>



      {/* ═══════════════════════════════════════════════════════════
          Mobile "More" Drawer (slide-up sheet) — semantic tokens,
          tile-style nav items, clearer hierarchy.
          ═══════════════════════════════════════════════════════════ */}
      {isMoreOpen && (
        <div
          className="md:hidden fixed inset-0 z-50 flex flex-col justify-end"
          role="dialog"
          aria-modal="true"
          aria-label="More navigation"
        >
          {/* Backdrop */}
          <div
            className="absolute inset-0 bg-foreground/40 backdrop-blur-sm animate-backdrop-in"
            onClick={() => setIsMoreOpen(false)}
          />
          {/* Sheet */}
          <div className="relative bg-surface border-t border-border rounded-t-2xl shadow-elev-xl pb-[env(safe-area-inset-bottom)] animate-sheet-up">
            {/* Handle */}
            <div className="flex justify-center pt-3 pb-1">
              <div className="w-10 h-1 bg-border-strong rounded-full" />
            </div>

            {/* Header */}
            <div className="flex items-center justify-between px-5 pb-3">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-lg bg-primary-600 flex items-center justify-center">
                  <Mountain className="text-white w-[18px] h-[18px]" strokeWidth={2.25} />
                </div>
                <div className="leading-tight">
                  <p className="font-display font-bold text-foreground text-sm tracking-tight">CrushTrack</p>
                  <p className="text-[10px] font-semibold uppercase tracking-[0.1em] text-muted-foreground">All Sections</p>
                </div>
              </div>
              <button
                onClick={() => setIsMoreOpen(false)}
                className="w-9 h-9 inline-flex items-center justify-center rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted transition-colors active:scale-95"
                aria-label="Close"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Nav grid - only show items NOT in bottom bar */}
            <div className="px-4 pb-4 grid grid-cols-3 gap-2.5">
              {filteredNavItems.filter(item => !bottomBarIds.has(item.id)).map((item) => {
                const Icon = item.icon;
                const isActive = currentView === item.id;
                return (
                  <button
                    key={item.id}
                    onClick={() => handleNavigate(item.id)}
                    aria-current={isActive ? "page" : undefined}
                    className={cn(
                      "flex flex-col items-center gap-2 py-4 px-2 rounded-xl border transition-colors active:scale-95",
                      isActive
                        ? "bg-primary-50 dark:bg-primary-500/10 border-primary-200 dark:border-primary-500/30 text-primary-700 dark:text-primary-300"
                        : "bg-surface-2 border-border text-foreground hover:border-border-strong",
                    )}
                  >
                    <Icon
                      className={cn(
                        "w-[22px] h-[22px]",
                        isActive ? "text-primary-600 dark:text-primary-400" : "text-muted-foreground",
                      )}
                      strokeWidth={isActive ? 2.25 : 2}
                    />
                    <span className="text-xs font-medium text-center leading-tight">
                      {item.label}
                    </span>
                  </button>
                );
              })}
            </div>

            {/* Role + sign out */}
            <div className="mx-4 mt-2 mb-4 p-3 rounded-xl border border-border bg-surface-2 flex items-center justify-between gap-3">
              <div className="flex items-center gap-2.5 min-w-0">
                <div className="w-8 h-8 rounded-lg bg-primary-600 text-white flex items-center justify-center text-xs font-bold shrink-0">
                  {userRole?.charAt(0) ?? '?'}
                </div>
                <div className="leading-tight min-w-0">
                  <p className="text-[10px] font-semibold uppercase tracking-[0.1em] text-muted-foreground">Signed in</p>
                  <p className="text-sm font-semibold text-foreground truncate">{userRole}</p>
                </div>
              </div>
              <button
                onClick={async () => {
                  await clearAuthSession();
                  window.location.reload();
                }}
                className="flex items-center gap-1.5 px-3.5 py-2 text-sm font-semibold text-danger bg-danger-muted rounded-lg hover:opacity-90 transition-opacity active:scale-95 shrink-0"
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
