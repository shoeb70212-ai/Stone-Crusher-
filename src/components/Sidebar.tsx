import React, { useState } from "react";
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
  CheckSquare,
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
  { id: "tasks", label: "Tasks", icon: CheckSquare },
  { id: "dispatch", label: "Dispatch (Slips)", icon: Truck },
  { id: "invoices", label: "Invoicing", icon: Receipt },
  { id: "vehicles", label: "Vehicles", icon: Truck },
  { id: "customers", label: "Customers", icon: Users },
  { id: "ledger", label: "Ledger", icon: BookOpen },
  { id: "settings", label: "Settings", icon: Settings },
];

export function Sidebar({
  currentView,
  onChangeView,
  isOpen,
  setIsOpen,
}: SidebarProps) {
  const { userRole } = useErp();
  const [isCollapsed, setIsCollapsed] = useState(false);

  const filteredNavItems = navItems.filter((item) => {
    if (
      userRole === "Manager" &&
      (item.id === "ledger" || item.id === "settings")
    )
      return false;
    if (userRole === "Partner" && item.id === "settings") return false;
    return true;
  });

  return (
    <>
      <div
        className={cn(
          "fixed inset-0 bg-black/50 z-20 md:hidden transition-opacity",
          isOpen ? "opacity-100" : "opacity-0 pointer-events-none",
        )}
        onClick={() => setIsOpen(false)}
      />
      <aside
        className={cn(
          "fixed md:static inset-y-0 left-0 z-30 shrink-0 bg-white dark:bg-zinc-950 text-zinc-600 dark:text-zinc-300 flex flex-col border-r border-zinc-200 dark:border-zinc-800 transition-all duration-300",
          isOpen ? "translate-x-0" : "-translate-x-full md:translate-x-0",
          isCollapsed ? "md:w-20 w-64" : "w-64"
        )}
      >
        <div className="h-16 flex items-center justify-between px-5 border-b border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-900/50">
          <div className="flex items-center">
            <Mountain className="text-primary-600 dark:text-primary-500 w-6 h-6 flex-shrink-0" />
            {!isCollapsed && (
              <h1 className="text-zinc-900 dark:text-white font-bold font-display text-lg tracking-wide uppercase ml-3 whitespace-nowrap hidden md:block">
                CrushTrack
              </h1>
            )}
            {/* Always show text on mobile since mobile is never collapsed */}
            <h1 className="text-zinc-900 dark:text-white font-bold font-display text-lg tracking-wide uppercase ml-3 whitespace-nowrap md:hidden">
              CrushTrack
            </h1>
          </div>
          <button
            className="md:hidden text-zinc-400 hover:text-zinc-900 dark:hover:text-white"
            onClick={() => setIsOpen(false)}
          >
            <X className="w-6 h-6" />
          </button>
        </div>

        <nav className="flex-1 py-6 px-3 space-y-1 overflow-y-auto mt-2">
          {filteredNavItems.map((item) => {
            const Icon = item.icon;
            const isActive = currentView === item.id;

            return (
              <button
                key={item.id}
                title={isCollapsed ? item.label : undefined}
                onClick={() => {
                  onChangeView(item.id);
                  setIsOpen(false);
                }}
                className={cn(
                  "w-full flex items-center px-3 py-2.5 rounded-xl text-sm font-medium transition-all duration-200 group relative",
                  isActive
                    ? "bg-zinc-100 dark:bg-zinc-800 text-zinc-900 dark:text-white shadow-sm"
                    : "hover:bg-zinc-50 dark:hover:bg-zinc-800/50 text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-white",
                  isCollapsed ? "justify-center" : "justify-start"
                )}
              >
                {isActive && (
                  <div className="absolute left-0 top-1/2 -translate-y-1/2 w-1 h-6 bg-primary-500 rounded-r-full" />
                )}
                <Icon
                  className={cn(
                    "w-5 h-5 flex-shrink-0 transition-transform duration-200 group-hover:scale-110",
                    isActive ? "text-primary-500" : "text-zinc-400 group-hover:text-zinc-900 dark:group-hover:text-white",
                    !isCollapsed && "mr-3"
                  )}
                />
                {!isCollapsed && (
                  <span className="truncate hidden md:block transition-transform duration-200 group-hover:translate-x-1">{item.label}</span>
                )}
                <span className="truncate md:hidden transition-transform duration-200 group-hover:translate-x-1">{item.label}</span>
              </button>
            );
          })}
        </nav>

        <div className="p-4 border-t border-zinc-200 dark:border-zinc-800">
          {!isCollapsed && (
             <div className="mb-4 px-3 text-xs font-semibold text-zinc-500 uppercase tracking-widest hidden md:block">
               Role: {userRole}
             </div>
          )}
          <div className="mb-4 px-3 text-xs font-semibold text-zinc-500 uppercase tracking-widest md:hidden">
            Role: {userRole}
          </div>
          
          <button 
            onClick={() => window.location.reload()}
            title={isCollapsed ? "Logout" : undefined}
            className={cn(
              "flex items-center text-sm font-medium text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-white w-full rounded-xl hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-all group",
              isCollapsed ? "p-3 justify-center mb-4" : "px-3 py-2.5 mb-2"
            )}
          >
            <LogOut className={cn("w-5 h-5 flex-shrink-0 group-hover:scale-110 transition-transform", !isCollapsed && "mr-3")} />
            {!isCollapsed && <span className="hidden md:inline">Logout</span>}
            <span className="md:hidden">Logout</span>
          </button>

          <button
            onClick={() => setIsCollapsed(!isCollapsed)}
            className="hidden md:flex items-center justify-center w-full px-3 py-2 text-zinc-500 hover:text-zinc-900 dark:hover:text-white hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded-xl transition-colors"
          >
            {isCollapsed ? <ChevronRight className="w-5 h-5" /> : <ChevronLeft className="w-5 h-5" />}
          </button>
        </div>
      </aside>
    </>
  );
}
