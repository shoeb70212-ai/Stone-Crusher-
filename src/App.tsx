import React, { useState, useEffect, useRef } from "react";
import { Router } from "wouter";
import { ErpProvider, useErp } from "./context/ErpContext";
import { ToastProvider } from "./components/ui/Toast";
import { OfflineIndicator } from "./components/ui/OfflineIndicator";
import { Layout } from "./components/Layout";
import { Login } from "./components/Login";
import { SetupAdminScreen } from "./components/SetupAdminScreen";
import { WelcomeScreen } from "./components/WelcomeScreen";
import { ResetPasswordScreen } from "./components/ResetPasswordScreen";
import { supabase } from "./lib/supabase";
import { recordDeviceAccess } from "./lib/device-info";
import { isNative } from "./lib/capacitor";

/**
 * Thin inner wrapper that wires the OfflineIndicator's `onReconnect` callback
 * to ErpContext's `flushSync`. Must be rendered inside ErpProvider.
 */
function AppShell({ isAuthenticated, onLogin }: { isAuthenticated: boolean; onLogin: () => void }) {
  const { flushSync, bootstrapRequired, isLoading, syncStatus, retryCountRef } = useErp();

  // Show the welcome wizard once after the very first account creation.
  const [showWelcome, setShowWelcome] = useState(
    () => isAuthenticated && localStorage.getItem('crushtrack_welcome_seen') === 'pending',
  );

  const handleWelcomeDone = () => {
    setShowWelcome(false);
  };

  // No users configured yet — show the first-run admin setup screen.
  const isFirstRun = !isLoading && bootstrapRequired === true;

  return (
    <>
      <OfflineIndicator
        onReconnect={flushSync}
        syncStatus={syncStatus}
        onRetry={() => {
          retryCountRef.current = 0;
          flushSync();
        }}
      />
      {isAuthenticated ? (
        showWelcome ? (
          <WelcomeScreen onDone={handleWelcomeDone} />
        ) : (
          <Layout />
        )
      ) : isFirstRun ? (
        <SetupAdminScreen
          onSetupComplete={() => {
            localStorage.setItem('crushtrack_welcome_seen', 'pending');
            setShowWelcome(true);
            onLogin();
          }}
        />
      ) : (
        <Login onLogin={onLogin} />
      )}
    </>
  );
}

export default function App() {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [authChecked, setAuthChecked] = useState(false);
  // True when Supabase fires a PASSWORD_RECOVERY event (user clicked the reset email link).
  const [isPasswordRecovery, setIsPasswordRecovery] = useState(false);

  // Configure Android status bar so the WebView sits below it (not behind it).
  useEffect(() => {
    if (!isNative()) return;
    import('@capacitor/status-bar').then(({ StatusBar, Style }) => {
      StatusBar.setOverlaysWebView({ overlay: false });
      StatusBar.setStyle({ style: Style.Default });
    }).catch(() => {});
  }, []);

  useEffect(() => {
    // Clear any stale legacy or dev-bypass auth tokens on every mount so they
    // can never silently restore an authenticated state on a fresh page load.
    localStorage.removeItem('erp_auth_token');

    // Read the current session on mount — covers page reload with a live session.
    supabase.auth.getSession().then(({ data }) => {
      if (data.session) setIsAuthenticated(true);
      setAuthChecked(true);
    });

    // Keep isAuthenticated in sync with Supabase's auth state changes
    // (sign-in from Login, sign-out from Sidebar, token refresh, etc.).
    // PASSWORD_RECOVERY fires when the user lands via the reset-password email link.
    const { data: listener } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === 'PASSWORD_RECOVERY') {
        setIsPasswordRecovery(true);
        setIsAuthenticated(false);
      } else {
        setIsAuthenticated(!!session);
      }
    });

    recordDeviceAccess();

    return () => listener.subscription.unsubscribe();
  }, []);

  // Show nothing until we know whether there is an active session, so we
  // never flash the login screen to an already-authenticated user.
  if (!authChecked) {
    return (
      <div className="h-screen w-screen flex items-center justify-center bg-zinc-50 dark:bg-zinc-900">
        <div className="animate-pulse h-8 w-32 bg-zinc-200 dark:bg-zinc-700 rounded" />
      </div>
    );
  }

  if (isPasswordRecovery) {
    return (
      <ToastProvider>
        <ResetPasswordScreen
          onDone={async () => {
            await supabase.auth.signOut({ scope: 'global' }).catch(() => {});
            setIsPasswordRecovery(false);
            setIsAuthenticated(true);
          }}
        />
      </ToastProvider>
    );
  }

  return (
    <ToastProvider>
      <ErpProvider>
        <Router>
          <AppShell
            isAuthenticated={isAuthenticated}
            onLogin={() => setIsAuthenticated(true)}
          />
        </Router>
      </ErpProvider>
    </ToastProvider>
  );
}
