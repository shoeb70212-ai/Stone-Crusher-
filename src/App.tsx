import React, { useState, useEffect } from "react";
import { ErpProvider, useErp } from "./context/ErpContext";
import { ToastProvider } from "./components/ui/Toast";
import { OfflineIndicator } from "./components/ui/OfflineIndicator";
import { Layout } from "./components/Layout";
import { Login } from "./components/Login";
import { authenticateWithBiometrics, isBiometricEnabled } from "./lib/biometrics";
import { secureGet, secureSet } from "./lib/secure-storage";
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

  useEffect(() => {
    async function checkAuth() {
      // Standard session token check — reads from native secure store on device
      const token = await secureGet('erp_auth_token');
      if (token) {
        // Mirror into localStorage so ErpContext (synchronous reads) stays in sync
        try { localStorage.setItem('erp_auth_token', token); } catch { /* ignore */ }
        setIsAuthenticated(true);
        return;
      }

      // Biometric fast-unlock: no existing session but biometrics are enabled
      if (isBiometricEnabled()) {
        const restoredToken = await authenticateWithBiometrics();
        if (restoredToken) {
          await secureSet('erp_auth_token', restoredToken);
          try { localStorage.setItem('erp_auth_token', restoredToken); } catch { /* ignore */ }
          setIsAuthenticated(true);
        }
      }
    }

    checkAuth();
    // Record this device for admin audit (non-blocking)
    recordDeviceAccess();
  }, []);

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
