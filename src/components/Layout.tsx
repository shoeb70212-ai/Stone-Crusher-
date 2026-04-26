import React, { useState, useEffect } from "react";
import { Sidebar } from "./Sidebar";
import { Header } from "./Header";
import { Dashboard } from "../pages/Dashboard";
import { Dispatch } from "../pages/Dispatch";
import { Ledger } from "../pages/Ledger";
import { Vehicles } from "../pages/Vehicles";
import { Customers } from "../pages/Customers";
import { Daybook } from "../pages/Daybook";
import { Settings } from "../pages/Settings";
import { Invoices } from "../pages/Invoices";
import { Menu, ShieldAlert } from "lucide-react";
import { useErp } from "../context/ErpContext";

export function Layout() {
  const [currentView, setCurrentView] = useState("dashboard");
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const { userRole, companySettings } = useErp();

  // Apply visual theme to HTML root
  useEffect(() => {
    const root = document.documentElement;
    // Handle dark mode
    if (companySettings.theme === "dark") {
      root.classList.add("dark");
    } else if (companySettings.theme === "light") {
      root.classList.remove("dark");
    } else {
      // System
      if (window.matchMedia("(prefers-color-scheme: dark)").matches) {
        root.classList.add("dark");
      } else {
        root.classList.remove("dark");
      }
    }

    // Handle primary color theme
    root.classList.remove(
      "theme-emerald",
      "theme-blue",
      "theme-violet",
      "theme-rose",
      "theme-amber"
    );
    if (companySettings.primaryColor) {
      root.classList.add(`theme-${companySettings.primaryColor}`);
    } else {
      root.classList.add("theme-emerald");
    }
  }, [companySettings.theme, companySettings.primaryColor]);

  // Route protection
  useEffect(() => {
    if (
      userRole === "Manager" &&
      (currentView === "ledger" || currentView === "settings")
    ) {
      setCurrentView("dashboard");
    }
    if (userRole === "Partner" && currentView === "settings") {
      setCurrentView("dashboard");
    }
  }, [userRole, currentView]);

  let content = null;
  switch (currentView) {
    case "dashboard":
      content = <Dashboard />;
      break;
    case "daybook":
      content = <Daybook />;
      break;
    case "dispatch":
      content = <Dispatch />;
      break;
    case "invoices":
      content = <Invoices />;
      break;
    case "vehicles":
      content = <Vehicles />;
      break;
    case "customers":
      content = <Customers />;
      break;
    case "ledger":
      if (userRole === "Manager") {
        content = (
          <div className="flex flex-col items-center justify-center h-full text-zinc-500">
            <ShieldAlert className="w-12 h-12 mb-4 text-rose-400" />
            <h2 className="text-xl font-bold text-zinc-900">Access Denied</h2>
            <p>Managers cannot view the ledger.</p>
          </div>
        );
      } else {
        content = <Ledger />;
      }
      break;
    case "settings":
      if (userRole !== "Admin") {
        content = (
          <div className="flex flex-col items-center justify-center h-full text-zinc-500">
            <ShieldAlert className="w-12 h-12 mb-4 text-rose-400" />
            <h2 className="text-xl font-bold text-zinc-900">Access Denied</h2>
            <p>Only Admins can view settings.</p>
          </div>
        );
      } else {
        content = <Settings />;
      }
      break;
    default:
      content = <Dashboard />;
  }

  return (
    <div className="flex h-screen bg-zinc-50 dark:bg-zinc-900 transition-colors duration-200 font-sans">
      <Sidebar
        currentView={currentView}
        onChangeView={setCurrentView}
        isOpen={isSidebarOpen}
        setIsOpen={setIsSidebarOpen}
      />
      <div className="flex-1 flex flex-col overflow-hidden w-full relative">
        <Header onMenuClick={() => setIsSidebarOpen(!isSidebarOpen)} />
        <main className="flex-1 overflow-auto p-2 sm:p-4 lg:p-6 pb-[calc(5rem+env(safe-area-inset-bottom))] md:pb-6">{content}</main>
      </div>
    </div>
  );
}
