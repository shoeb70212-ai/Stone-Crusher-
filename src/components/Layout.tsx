import React, { useState, useEffect, lazy, Suspense } from "react";
import { useLocation } from "wouter";
import { Sidebar } from "./Sidebar";
import { Header } from "./Header";
import { PageSkeleton } from "./ui/Skeleton";
import { Plus } from "lucide-react";

const Dashboard = lazy(() => import("../pages/Dashboard").then(m => ({ default: m.Dashboard })));
const Dispatch = lazy(() => import("../pages/Dispatch").then(m => ({ default: m.Dispatch })));
const Ledger = lazy(() => import("../pages/Ledger").then(m => ({ default: m.Ledger })));
const Vehicles = lazy(() => import("../pages/Vehicles").then(m => ({ default: m.Vehicles })));
const Customers = lazy(() => import("../pages/Customers").then(m => ({ default: m.Customers })));
const Employees = lazy(() => import("../pages/Employees").then(m => ({ default: m.Employees })));
const Daybook = lazy(() => import("../pages/Daybook").then(m => ({ default: m.Daybook })));
const Settings = lazy(() => import("../pages/Settings").then(m => ({ default: m.Settings })));
const Invoices = lazy(() => import("../pages/Invoices").then(m => ({ default: m.Invoices })));
const AuditLog = lazy(() => import("../pages/AuditLog").then(m => ({ default: m.AuditLog })));
import { Menu, ShieldAlert } from "lucide-react";
import { useErp } from "../context/ErpContext";
import { isNative } from "../lib/capacitor";

/** Valid view names used by deep links and app shortcuts. */
const VALID_VIEWS = new Set([
  'dashboard', 'dispatch', 'invoices', 'customers',
  'employees', 'daybook', 'ledger', 'vehicles', 'settings', 'audit',
]);

/** Pages dispatch this event to trigger navigation without prop-drilling. */
export const NAVIGATE_EVENT = "crushtrack:navigate";

/** Bottom-nav FAB dispatches this to open the create modal on the active page. */
export const CREATE_EVENT = "crushtrack:create";

export function Layout() {
  const [location, setLocation] = useLocation();
  const currentView = location.replace(/^\//, '') || 'dashboard';
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const { userRole, companySettings, isLoading } = useErp();
  const isAdmin = userRole === 'Admin';

  // Keep old event API working as a fallback during migration
  useEffect(() => {
    const handler = (e: Event) => {
      const view = (e as CustomEvent<string>).detail;
      if (VALID_VIEWS.has(view)) setLocation(`/${view}`);
    };
    window.addEventListener(NAVIGATE_EVENT, handler);
    return () => window.removeEventListener(NAVIGATE_EVENT, handler);
  }, [setLocation]);

  // Register home screen shortcuts (long-press app icon on Android / iOS)
  useEffect(() => {
    if (!isNative()) return;

    import('@capawesome/capacitor-app-shortcuts').then(({ AppShortcuts }) => {
      AppShortcuts.set({
        shortcuts: [
          {
            id: 'new_slip',
            title: 'New Slip',
            description: 'Create a dispatch slip',
            // URL handled by the appUrlOpen deep link listener above
          },
          {
            id: 'dispatch',
            title: 'Dispatch',
            description: 'View dispatch board',
          },
          {
            id: 'daybook',
            title: 'New Transaction',
            description: 'Add a Daybook entry',
          },
          {
            id: 'invoices',
            title: 'Invoices',
            description: 'View invoices',
          },
        ],
      }).catch(() => {
        // Non-critical — shortcuts not supported on this platform version
      });

      // Handle shortcut taps that launch the app
      AppShortcuts.addListener('click', (event) => {
        const view = event.shortcutId === 'new_slip' ? 'dispatch' : event.shortcutId;
        if (VALID_VIEWS.has(view)) {
          setLocation(`/${view}`);
        }
      }).catch(() => {});
    });
  }, [setLocation]);

  // Android hardware back button — navigate to dashboard instead of exiting app
  useEffect(() => {
    if (!isNative()) return;
    let removeListener: (() => void) | undefined;

    import('@capacitor/app').then(({ App }) => {
      App.addListener('backButton', () => {
        if (currentView !== 'dashboard') {
          setLocation('/dashboard');
        } else {
          App.exitApp();
        }
      }).then((handle) => {
        removeListener = () => handle.remove();
      });
    });

    return () => removeListener?.();
  }, [currentView, setLocation]);

  // Deep link handler — listens for crushtrack://view/<name> URLs
  useEffect(() => {
    if (!isNative()) return;

    let cleanup: (() => void) | undefined;

    import('@capacitor/app').then(({ App }) => {
      App.addListener('appUrlOpen', (event) => {
        // Expected format: crushtrack://view/dispatch
        try {
          const url = new URL(event.url);
          const view = url.pathname.replace(/^\//, ''); // strip leading slash
          if (VALID_VIEWS.has(view)) {
            setLocation(`/${view}`);
          }
        } catch {
          // Malformed URL — ignore
        }
      }).then((handle) => {
        cleanup = () => handle.remove();
      });
    });

    return () => cleanup?.();
  }, [setLocation]);

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
      setLocation("/dashboard");
    }
    if (userRole === "Partner" && currentView === "settings") {
      setLocation("/dashboard");
    }
    if (!isAdmin && currentView === "audit") {
      setLocation("/dashboard");
    }
    if (!isAdmin && currentView === "employees") {
      setLocation("/dashboard");
    }
  }, [userRole, currentView, isAdmin, setLocation]);

  let content: React.ReactNode;
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
    case "employees":
      if (!isAdmin) {
        content = (
          <div className="flex flex-col items-center justify-center h-full text-zinc-500">
            <ShieldAlert className="w-12 h-12 mb-4 text-rose-400" />
            <h2 className="text-xl font-bold text-zinc-900">Access Denied</h2>
            <p>Only Admins can view employees.</p>
          </div>
        );
      } else {
        content = <Employees />;
      }
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
      if (!isAdmin) {
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
    case "audit":
      if (!isAdmin) {
        content = (
          <div className="flex flex-col items-center justify-center h-full text-zinc-500">
            <ShieldAlert className="w-12 h-12 mb-4 text-rose-400" />
            <h2 className="text-xl font-bold text-zinc-900">Access Denied</h2>
            <p>Only Admins can view audit logs.</p>
          </div>
        );
      } else {
        content = <AuditLog />;
      }
      break;
    default:
      content = <Dashboard />;
  }

  const showFab = currentView === "dispatch" || currentView === "invoices";

  return (
    <>
      <div className="flex h-screen bg-gradient-to-b from-zinc-50 to-zinc-100 dark:from-zinc-900 dark:to-zinc-950 transition-colors duration-200 font-sans overflow-hidden">
        <Sidebar
          currentView={currentView}
          onChangeView={(view) => setLocation(`/${view}`)}
          isOpen={isSidebarOpen}
          setIsOpen={setIsSidebarOpen}
        />
        <div className="flex-1 flex flex-col min-h-0 w-full relative min-w-0">
          <Header onMenuClick={() => setIsSidebarOpen(!isSidebarOpen)} />
          <main className="flex-1 overflow-y-auto overflow-x-hidden p-2 sm:p-4 lg:p-6 app-content smooth-scroll has-bottom-nav">
            <Suspense fallback={<PageSkeleton />}>
              {isLoading ? (
                <PageSkeleton />
              ) : (
                <div key={currentView} className="animate-page-in">
                  {content}
                </div>
              )}
            </Suspense>
          </main>
        </div>
      </div>

      {/* FAB — outside overflow-hidden root so fixed positioning works */}
      {showFab && (
        <button
          key={`fab-${currentView}`}
          onClick={() => window.dispatchEvent(new CustomEvent(CREATE_EVENT))}
          className="md:hidden fixed right-4 bottom-[calc(80px+env(safe-area-inset-bottom))] w-14 h-14 bg-primary-600 text-white hover:bg-primary-700 active:scale-90 shadow-2xl shadow-primary-500/30 flex items-center justify-center rounded-full z-[50] transition-transform animate-fab-pop"
          aria-label={currentView === "dispatch" ? "Create new dispatch slip" : "Create new invoice"}
        >
          <Plus className="w-7 h-7" />
        </button>
      )}
    </>
  );
}
