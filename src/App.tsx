import React, { useState, useEffect } from "react";
import { ErpProvider, useErp } from "./context/ErpContext";
import { ToastProvider } from "./components/ui/Toast";
import { OfflineIndicator } from "./components/ui/OfflineIndicator";
import { Layout } from "./components/Layout";
import { Login } from "./components/Login";
import { supabase } from "./lib/supabase";
import { recordDeviceAccess } from "./lib/device-info";

/**
 * Thin inner wrapper that wires the OfflineIndicator's `onReconnect` callback
 * to ErpContext's `flushSync`. Must be rendered inside ErpProvider.
 */
function AppShell({ isAuthenticated, onLogin }: { isAuthenticated: boolean; onLogin: () => void }) {
  const { flushSync } = useErp();

  return (
    <>
      <OfflineIndicator onReconnect={flushSync} />
      {isAuthenticated ? (
        <Layout />
      ) : (
        <Login onLogin={onLogin} />
      )}
    </>
  );
}

export default function App() {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [authChecked, setAuthChecked] = useState(false);

  useEffect(() => {
    // Read the current session on mount — covers page reload with a live session.
    supabase.auth.getSession().then(({ data }) => {
      if (data.session) setIsAuthenticated(true);
      setAuthChecked(true);
    });

    // Keep isAuthenticated in sync with Supabase's auth state changes
    // (sign-in from Login, sign-out from Sidebar, token refresh, etc.).
    const { data: listener } = supabase.auth.onAuthStateChange((_event, session) => {
      setIsAuthenticated(!!session);
    });

    // Clear stale legacy auth keys from the old PBKDF2 system on first load.
    localStorage.removeItem('erp_auth_token');

    recordDeviceAccess();

    return () => listener.subscription.unsubscribe();
  }, []);

  // Show nothing until we know whether there is an active session, so we
  // never flash the login screen to an already-authenticated user.
  if (!authChecked) return null;

  return (
    <ToastProvider>
      <ErpProvider>
        <AppShell
          isAuthenticated={isAuthenticated}
          onLogin={() => setIsAuthenticated(true)}
        />
      </ErpProvider>
    </ToastProvider>
  );
}
