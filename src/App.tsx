import React, { useState, useEffect, useRef } from "react";
import { Router } from "wouter";
import { ErpProvider, useErp } from "./context/ErpContext";
import { ToastProvider } from "./components/ui/Toast";
import { OfflineIndicator } from "./components/ui/OfflineIndicator";
import { Layout } from "./components/Layout";
import { Login } from "./components/Login";
import { SetupAdminScreen } from "./components/SetupAdminScreen";
import { SetPasswordScreen } from "./components/SetPasswordScreen";
import { WelcomeScreen } from "./components/WelcomeScreen";
import { ResetPasswordScreen } from "./components/ResetPasswordScreen";
import MasterKeyScreen from "./components/MasterKeyScreen";
import { supabase } from "./lib/supabase";
import { recordDeviceAccess } from "./lib/device-info";
import { isNative } from "./lib/capacitor";
import { importMasterKey } from "./lib/crypto-utils";
import { setMasterKey } from "./lib/sync-engine";

/**
 * Thin inner wrapper that wires the OfflineIndicator's `onReconnect` callback
 * to ErpContext's `flushSync`. Must be rendered inside ErpProvider.
 */
function AppShell({ isAuthenticated, isVaultUnlocked, onLogin, onVaultUnlocked }: {
  isAuthenticated: boolean;
  isVaultUnlocked: boolean;
  onLogin: () => void;
  onVaultUnlocked: () => void;
}) {
  const { flushSync, bootstrapRequired, isLoading, syncStatus, pendingSyncCount, retryCountRef, companySettings, session, updateCompanySettings } = useErp();

  // Show the welcome wizard once after the very first account creation.
  const [showWelcome, setShowWelcome] = useState(
    () => isAuthenticated && localStorage.getItem('crushtrack_welcome_seen') === 'pending',
  );
  // Track whether the user has completed the first-time password setup.
  const [passwordSetDone, setPasswordSetDone] = useState(false);

  const handleWelcomeDone = () => {
    setShowWelcome(false);
  };

  // No users configured yet — show the first-run admin setup screen.
  const isFirstRun = !isLoading && bootstrapRequired === true;

  // Check if the current user must change their password (created by admin without a password).
  // We check BOTH the local companySettings flag AND the Supabase app_metadata flag.
  // The server-side app_metadata is the source of truth — if the PUT /api/admin-users
  // endpoint already cleared it but the local cache is stale, skip the prompt.
  const currentUserId = session?.user?.id;
  const currentUserRecord = (companySettings.users || []).find((u) => u.id === currentUserId);
  const appMetaMustChange = session?.user?.app_metadata?.mustChangePassword === true;
  const localMustChange = currentUserRecord?.mustChangePassword === true;
  // Only show SetPasswordScreen if the server-side app_metadata flag is explicitly true.
  // The local flag alone is unreliable (can be stale from cached data). When the PUT
  // endpoint clears the flag server-side, we must respect that even if the local cache
  // hasn't caught up yet. If app_metadata is clean, also auto-fix the stale local flag.
  const mustSetPassword = isAuthenticated && !isLoading && appMetaMustChange && !passwordSetDone;

  // Auto-fix: if the server already cleared the flag but the local cache is stale, fix it.
  React.useEffect(() => {
    if (!isLoading && !appMetaMustChange && localMustChange && currentUserRecord && currentUserId) {
      const updatedSettings = {
        ...companySettings,
        users: (companySettings.users || []).map((u) =>
          u.id === currentUserId ? { ...u, mustChangePassword: false } : u
        ),
      };
      updateCompanySettings(updatedSettings);
    }
  }, [isLoading, appMetaMustChange, localMustChange, currentUserId]); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <>
      <OfflineIndicator
        onReconnect={flushSync}
        syncStatus={syncStatus}
        pendingCount={pendingSyncCount}
        onRetry={() => {
          retryCountRef.current = 0;
          flushSync();
        }}
      />
      {isAuthenticated ? (
        mustSetPassword ? (
          <SetPasswordScreen
            userName={currentUserRecord?.name}
            onPasswordSet={() => {
              if (currentUserRecord) {
                const updatedSettings = {
                  ...companySettings,
                  users: (companySettings.users || []).map((u) =>
                    u.id === currentUserId ? { ...u, mustChangePassword: false } : u
                  ),
                };
                updateCompanySettings(updatedSettings);
              }
              setPasswordSetDone(true);
            }}
          />
        ) : !isVaultUnlocked ? (
          <MasterKeyScreen onUnlocked={onVaultUnlocked} />
        ) : showWelcome ? (
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
  // E2EE vault state — must be unlocked after Supabase login
  const [isVaultUnlocked, setIsVaultUnlocked] = useState(false);
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
    supabase.auth
      .getSession()
      .then(async ({ data }) => {
        if (data.session) {
          setIsAuthenticated(true);
          const savedKey = localStorage.getItem('crushtrack_vault_key');
          if (savedKey) {
            try {
              const key = await importMasterKey(savedKey);
              setMasterKey(key);
              setIsVaultUnlocked(true);
            } catch (e) {
              console.warn('Failed to restore vault key', e);
              localStorage.removeItem('crushtrack_vault_key');
            }
          }
        }
      })
      .catch(() => {
        // ignore session read errors — user stays unauthenticated
      })
      .finally(() => {
        setAuthChecked(true);
      });

    // Keep isAuthenticated in sync with Supabase's auth state changes
    // (sign-in from Login, sign-out from Sidebar, token refresh, etc.).
    // PASSWORD_RECOVERY fires when the user lands via the reset-password email link.
    const { data: listener } = supabase.auth.onAuthStateChange(async (event, session) => {
      if (event === 'PASSWORD_RECOVERY') {
        setIsPasswordRecovery(true);
        setIsAuthenticated(false);
      } else {
        const isAuth = !!session;
        setIsAuthenticated(isAuth);
        
        if (isAuth) {
          const savedKey = localStorage.getItem('crushtrack_vault_key');
          if (savedKey) {
            try {
              const key = await importMasterKey(savedKey);
              setMasterKey(key);
              setIsVaultUnlocked(true);
            } catch (e) {
              localStorage.removeItem('crushtrack_vault_key');
            }
          }
        } else {
          setIsVaultUnlocked(false);
        }
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
            // Sign out the recovery session so the user must log in fresh
            // with their new password. We clear isPasswordRecovery first so
            // the onAuthStateChange SIGNED_OUT event doesn't race with this
            // and briefly show the main app.
            setIsPasswordRecovery(false);
            setIsAuthenticated(false);
            await supabase.auth.signOut({ scope: 'global' }).catch(() => {});
          }}
        />
      </ToastProvider>
    );
  }

  return (
    <ToastProvider>
      <ErpProvider isVaultUnlocked={isVaultUnlocked}>
        <Router>
          <AppShell
            isAuthenticated={isAuthenticated}
            isVaultUnlocked={isVaultUnlocked}
            onLogin={() => setIsAuthenticated(true)}
            onVaultUnlocked={() => setIsVaultUnlocked(true)}
          />
        </Router>
      </ErpProvider>
    </ToastProvider>
  );
}
