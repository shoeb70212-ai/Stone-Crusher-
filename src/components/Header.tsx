import React, { useState } from "react";
import { Bell, Search, Shield, Menu } from "lucide-react";
import { format } from "date-fns";
import { useErp, UserRole } from "../context/ErpContext";

interface HeaderProps {
  onMenuClick?: () => void;
}

export function Header({ onMenuClick }: HeaderProps) {
  const { userRole, setUserRole } = useErp();
  const [isRoleDropdownOpen, setIsRoleDropdownOpen] = useState(false);

  return (
    <header className="flex h-16 bg-white/80 dark:bg-zinc-950/80 backdrop-blur-md border-b border-zinc-200 dark:border-zinc-800 px-4 md:px-8 items-center justify-between shrink-0 transition-colors z-20">
      <div className="flex items-center gap-3 md:gap-4 flex-1 md:flex-none">
        <div className="flex items-center text-zinc-500 dark:text-zinc-400">
          <span className="text-sm font-medium hidden sm:inline-block">
            {format(new Date(), "EEEE, dd MMMM yyyy")}
          </span>
          <span className="text-sm font-medium sm:hidden ml-1 text-zinc-900 dark:text-white tracking-tight">
            CrushTrack
          </span>
        </div>
      </div>

      <div className="flex items-center space-x-3 md:space-x-6 relative">
        <div className="relative hidden md:block">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -tranzinc-y-1/2 text-zinc-400 dark:text-zinc-500" />
          <input
            type="text"
            placeholder="Search slips, customers..."
            className="pl-9 pr-4 py-2 bg-zinc-100 dark:bg-zinc-900 border border-transparent rounded-full text-sm focus:border-zinc-300 dark:focus:border-zinc-700 focus:bg-white dark:focus:bg-zinc-800 dark:text-white outline-none w-64 transition-all placeholder:text-zinc-400 dark:placeholder:text-zinc-500"
          />
        </div>

        <button className="relative p-2 rounded-full text-zinc-400 dark:text-zinc-500 hover:text-zinc-600 dark:hover:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-700 transition-colors">
          <Bell className="w-5 h-5" />
          <span className="absolute top-1.5 right-1.5 w-2 h-2 bg-rose-500 rounded-full border-2 border-white dark:border-zinc-800"></span>
        </button>

        <div className="relative">
          <button
            onClick={() => setIsRoleDropdownOpen(!isRoleDropdownOpen)}
            className="h-8 pl-3 pr-1 rounded-full bg-primary-50 dark:bg-primary-500/10 flex items-center justify-center text-primary-700 dark:text-primary-300 font-bold text-sm border border-primary-100 dark:border-primary-500/20 hover:bg-primary-100 dark:hover:bg-primary-500/20 transition-colors"
          >
            <Shield className="w-3.5 h-3.5 mr-2" />
            {userRole}
            <div className="ml-2 w-6 h-6 rounded-full bg-primary-200 dark:bg-primary-500/30 flex items-center justify-center text-primary-800 dark:text-primary-200">
              {userRole.charAt(0)}
            </div>
          </button>

          {isRoleDropdownOpen && (
            <div className="absolute top-10 right-0 mt-1 w-48 bg-white dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-lg shadow-lg overflow-hidden z-50">
              <div className="px-4 py-2 text-xs font-semibold text-zinc-500 dark:text-zinc-400 bg-zinc-50 dark:bg-zinc-900/50 border-b border-zinc-100 dark:border-zinc-700 uppercase tracking-wider">
                Test Switch Role
              </div>
              {(["Admin", "Partner", "Manager"] as UserRole[]).map((role) => (
                <button
                  key={role}
                  onClick={() => {
                    setUserRole(role);
                    setIsRoleDropdownOpen(false);
                  }}
                  className={`w-full text-left px-4 py-2 text-sm font-medium transition-colors ${
                    userRole === role 
                      ? "text-primary-600 dark:text-primary-400 bg-primary-50/50 dark:bg-primary-500/10" 
                      : "text-zinc-700 dark:text-zinc-300 hover:bg-zinc-50 dark:hover:bg-zinc-700"
                  }`}
                >
                  {role}
                </button>
              ))}
            </div>
          )}
        </div>
      </div>
    </header>
  );
}
