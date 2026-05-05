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

/** Reusable empty/denied state. Kept inside Layout because it's only
 *  used for in-line role guards. Consistent with the new design tokens. */
function AccessDenied({ message }: { message: string }) {
  return (
    <div
      role="alert"
      className="flex flex-col items-center justify-center text-center h-full min-h-[60vh] px-6"
    >
      <div className="w-16 h-16 rounded-full bg-danger-muted flex items-center justify-center mb-5">
        <ShieldAlert className="w-7 h-7 text-danger" />
      </div>
      <h2 className="text-xl font-display font-bold text-foreground tracking-tight">
        Access Denied
      </h2>
      <p className="text-sm text-muted-foreground mt-1.5 max-w-xs">
        {message}
      </p>
    </div>
  );
}

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

  // Apply visual theme to HTML root + sync the native status-bar tint and the
  // browser <meta theme-color>. Wiring all theme effects into a single hook
  // keeps the source of truth in one place and avoids out-of-sync chrome
  // colors when the user toggles light/dark.
  useEffect(() => {
    const root = document.documentElement;

    // 1. Resolve the effective dark/light mode (handle "system" preference).
    let isDark: boolean;
    if (companySettings.theme === "dark") {
      isDark = true;
    } else if (companySettings.theme === "light") {
      isDark = false;
    } else {
      isDark = window.matchMedia("(prefers-color-scheme: dark)").matches;
    }
    root.classList.toggle("dark", isDark);

    // 2. Apply primary brand color class.
    root.classList.remove(
      "theme-emerald",
      "theme-blue",
      "theme-violet",
      "theme-rose",
      "theme-amber"
    );
    root.classList.add(`theme-${companySettings.primaryColor || "emerald"}`);

    // 3. Read the resolved background color from CSS variables and push it
    //    to (a) the <meta theme-color> tag (web/PWA chrome) and (b) the native
    //    StatusBar plugin (Android/iOS shell). This keeps the system status
    //    bar exactly the same color as the app's surface — the single biggest
    //    "feels native" win on Android.
    const cs = getComputedStyle(root);
    const bg = cs.getPropertyValue("--background").trim() || (isDark ? "#0a0a0a" : "#ffffff");

    document.querySelectorAll<HTMLMetaElement>('meta[name="theme-color"]').forEach((m) => {
      m.setAttribute("content", bg);
    });

    if (isNative()) {
      import("@capacitor/status-bar")
        .then(({ StatusBar, Style }) => {
          // Match status bar foreground to the app's foreground (icons readable on bg).
          StatusBar.setStyle({ style: isDark ? Style.Dark : Style.Light }).catch(() => {});
          StatusBar.setBackgroundColor({ color: bg }).catch(() => {});
          // Don't overlay — status bar gets its own band, like a normal app.
          StatusBar.setOverlaysWebView({ overlay: false }).catch(() => {});
        })
        .catch(() => {
          /* status-bar plugin not available — non-critical */
        });
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
        content = <AccessDenied message="Only Admins can view employees." />;
      } else {
        content = <Employees />;
      }
      break;
    case "ledger":
      if (userRole === "Manager") {
        content = <AccessDenied message="Managers cannot view the ledger." />;
      } else {
        content = <Ledger />;
      }
      break;
    case "settings":
      if (!isAdmin) {
        content = <AccessDenied message="Only Admins can view settings." />;
      } else {
        content = <Settings />;
      }
      break;
    case "audit":
      if (!isAdmin) {
        content = <AccessDenied message="Only Admins can view audit logs." />;
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
      {/* Keyboard-accessible skip link — invisible until focused. */}
      <a href="#main-content" className="skip-to-content">
        Skip to main content
      </a>

      <div className="flex h-screen bg-background text-foreground transition-colors duration-200 font-sans overflow-hidden">
        <Sidebar
          currentView={currentView}
          onChangeView={(view) => setLocation(`/${view}`)}
          isOpen={isSidebarOpen}
          setIsOpen={setIsSidebarOpen}
        />
        <div className="flex-1 flex flex-col min-h-0 w-full relative min-w-0">
          <Header onMenuClick={() => setIsSidebarOpen(!isSidebarOpen)} />
          <main
            id="main-content"
            className="flex-1 overflow-y-auto overflow-x-hidden app-content smooth-scroll has-bottom-nav"
          >
            {/* Constrain content width on large desktops so dense tables and
                cards don't stretch unreadably wide. Mobile + tablet are full
                width as before. */}
            <div className="mx-auto w-full max-w-7xl px-3 sm:px-5 lg:px-8 py-3 sm:py-5 lg:py-7">
              <Suspense fallback={<PageSkeleton />}>
                {isLoading ? (
                  <PageSkeleton />
                ) : (
                  <div key={currentView} className="animate-page-in">
                    {content}
                  </div>
                )}
              </Suspense>
            </div>
          </main>
        </div>
      </div>

      {/* FAB — outside overflow-hidden root so fixed positioning works.
          Refined: subtler shadow tinted to the primary color, smoother
          press feedback, ring offset for keyboard focus. */}
      {showFab && (
        <button
          key={`fab-${currentView}`}
          onClick={() => window.dispatchEvent(new CustomEvent(CREATE_EVENT))}
          className="mobile-fab md:hidden bg-primary-600 text-white hover:bg-primary-700 active:scale-90 shadow-primary-600/25 ring-4 ring-background transition-transform animate-fab-pop"
          aria-label={currentView === "dispatch" ? "Create new dispatch slip" : "Create new invoice"}
        >
          <Plus className="w-7 h-7" strokeWidth={2.5} />
        </button>
      )}
    </>
  );
}
