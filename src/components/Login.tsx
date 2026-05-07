import React, { useState, useEffect } from 'react';
import { Lock, User, AlertCircle, Fingerprint, Eye, EyeOff } from 'lucide-react';
import { useErp } from '../context/ErpContext';
import { supabase, isSupabaseConfigured } from '../lib/supabase';
import { ForgotPasswordScreen } from './ForgotPasswordScreen';
import {
  isBiometricAvailable,
  isBiometricEnabled,
  saveBiometricCredentials,
  clearBiometricCredentials,
} from '../lib/biometrics';
import { ServerSettingsScreen } from './ServerSettingsScreen';
import logoSvg from '../assets/logo.svg';

interface LoginProps {
  onLogin: () => void;
}

export function Login({ onLogin }: LoginProps) {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [fieldErrors, setFieldErrors] = useState<{ username?: string; password?: string }>({});
  const [showBiometricPrompt, setShowBiometricPrompt] = useState(false);
  const [canUseBiometric, setCanUseBiometric] = useState(false);
  const [showForgotPassword, setShowForgotPassword] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [showServerSettings, setShowServerSettings] = useState(!isSupabaseConfigured);

  const { companySettings, isLoading, recordAuditEvent, session, userRole } = useErp();

  useEffect(() => {
    isBiometricAvailable().then(setCanUseBiometric);
  }, []);

  // Once the session and role are both resolved after login, fire onLogin.
  const pendingLoginRef = React.useRef(false);
  useEffect(() => {
    if (pendingLoginRef.current && session && userRole) {
      pendingLoginRef.current = false;
      onLogin();
    }
  }, [session, userRole, onLogin]);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setFieldErrors({});
    setIsSubmitting(true);

    if (isLoading) {
      setError('Still loading accounts. Please wait a moment and try again.');
      setIsSubmitting(false);
      return;
    }

    const cleanedUsername = username.trim();

    // Simple client-side validation
    if (!cleanedUsername) {
      setFieldErrors({ username: 'Username is required' });
      setIsSubmitting(false);
      return;
    }
    if (!password) {
      setFieldErrors({ password: 'Password is required' });
      setIsSubmitting(false);
      return;
    }

    try {
      // Resolve the email — the user may have typed their name instead of email.
      let loginEmail = cleanedUsername.toLowerCase();

      // If the input doesn't look like an email, try to find a matching user by name.
      if (!loginEmail.includes('@')) {
        const users = companySettings.users ?? [];
        const match = users.find(
          (u) => u.name.toLowerCase() === loginEmail ||
                 u.name.toLowerCase().replace(/\s+/g, '') === loginEmail.replace(/\s+/g, ''),
        );
        if (match) {
          loginEmail = match.email.toLowerCase();
        } else {
          // No matching user found by name — still try as-is (Supabase will reject).
          setError('No account found with that username. Try your email instead.');
          setIsSubmitting(false);
          return;
        }
      }

      const { error: authError } = await supabase.auth.signInWithPassword({
        email: loginEmail,
        password,
      });

      if (authError) {
        setError('Invalid username or password.');
        return;
      }

      recordAuditEvent({
        action: 'Signed in',
        entityType: 'System',
        description: 'Signed in.',
        metadata: { method: 'password' },
      });

      // Offer biometric enrolment on native devices.
      if (canUseBiometric && !isBiometricEnabled()) {
        setShowBiometricPrompt(true);
      } else {
        pendingLoginRef.current = true;
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleBiometricEnrollment = async (enable: boolean) => {
    if (enable) {
      // Store the Supabase refresh token so we can restore the session later.
      const { data } = await supabase.auth.getSession();
      const refreshToken = data.session?.refresh_token;
      if (refreshToken) {
        await saveBiometricCredentials(refreshToken);
      }
    }
    setShowBiometricPrompt(false);
    pendingLoginRef.current = true;
  };

  /** Attempts biometric quick-login by restoring a saved refresh token. */
  const handleBiometricQuickLogin = async () => {
    // Import lazily — NativeBiometric is only available on native.
    const { authenticateWithBiometrics } = await import('../lib/biometrics');
    const refreshToken = await authenticateWithBiometrics();

    if (!refreshToken) {
      setError('Biometric authentication failed. Use your password instead.');
      return;
    }

    const { error: sessionError } = await supabase.auth.refreshSession({ refresh_token: refreshToken });

    if (sessionError) {
      // Stored token is expired or revoked — clear it and fall back to password.
      await clearBiometricCredentials();
      setError('Biometric session expired. Please sign in with your password.');
      return;
    }

    recordAuditEvent({
      action: 'Signed in',
      entityType: 'System',
      description: 'Signed in with biometrics.',
      metadata: { method: 'biometric' },
    });
    pendingLoginRef.current = true;
  };

  const appName = companySettings.name?.trim() || 'CrushTrack';

  if (showForgotPassword) {
    return <ForgotPasswordScreen onBack={() => setShowForgotPassword(false)} />;
  }

  if (showServerSettings) {
    return <ServerSettingsScreen onBack={() => setShowServerSettings(false)} />;
  }

  // Biometric enrollment prompt shown after a successful password login
  if (showBiometricPrompt) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-6">
        <div className="w-full max-w-sm text-center">
          <div className="w-16 h-16 bg-primary-50 dark:bg-primary-500/10 ring-1 ring-primary-200 dark:ring-primary-500/20 rounded-2xl flex items-center justify-center mx-auto mb-5">
            <Fingerprint className="w-8 h-8 text-primary-600 dark:text-primary-400" />
          </div>
          <h2 className="text-xl font-display font-bold text-foreground mb-2 tracking-tight">Enable Biometric Login?</h2>
          <p className="text-sm text-muted-foreground mb-8 leading-relaxed">
            Sign in faster next time with your fingerprint or face ID instead of your password.
          </p>
          <div className="flex flex-col gap-2.5">
            <button
              onClick={() => handleBiometricEnrollment(true)}
              className="w-full h-12 bg-primary-600 hover:bg-primary-700 active:scale-[0.98] text-white font-semibold rounded-xl transition-all shadow-elev-sm"
            >
              Enable Biometric Login
            </button>
            <button
              onClick={() => handleBiometricEnrollment(false)}
              className="w-full h-12 bg-muted hover:bg-surface-2 text-foreground font-medium rounded-xl transition-colors"
            >
              Skip for now
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-[100dvh] flex flex-col md:flex-row bg-background">
      {/* ── Brand panel ────────────────────────────────────────────
          Mobile: compact top hero.
          Desktop: full-height left column with editorial typography. */}
      <div className="md:flex-1 relative bg-primary-600 dark:bg-primary-700 flex flex-col items-center md:items-start justify-center px-6 md:px-12 lg:px-16 py-8 md:py-12 shrink-0 md:min-h-screen">
        {/* Subtle decorative grid for desktop hero */}
        <div
          aria-hidden="true"
          className="hidden md:block absolute inset-0 opacity-[0.07] pointer-events-none"
          style={{
            backgroundImage:
              "linear-gradient(to right, white 1px, transparent 1px), linear-gradient(to bottom, white 1px, transparent 1px)",
            backgroundSize: "32px 32px",
          }}
        />

        <div className="relative flex flex-col items-center md:items-start gap-4 md:gap-6 max-w-md">
          <div className="w-16 h-16 md:w-14 md:h-14 rounded-2xl overflow-hidden shadow-elev-md bg-white">
            <img
              src={logoSvg}
              alt={`${appName} logo`}
              className="w-full h-full object-cover"
            />
          </div>
          <div className="text-center md:text-left">
            <h1 className="text-3xl md:text-5xl font-display font-bold text-white tracking-tight leading-[1.05]">
              {appName}
            </h1>
            <p className="text-primary-100 mt-1.5 md:mt-3 text-sm md:text-base">
              Stone Crusher ERP
            </p>
          </div>
          {/* Desktop tagline — adds confidence without being marketing-loud */}
          <p className="hidden md:block text-sm text-primary-100/90 leading-relaxed mt-4 max-w-xs">
            Dispatch slips, invoicing, daybook and ledger — built for the modern crusher operation.
          </p>
        </div>
      </div>

      {/* ── Form panel ─────────────────────────────────────────────
          Mobile: rounded-top card overlapping hero, scrollable.
          Desktop: clean right column. */}
      <div className="flex-1 bg-surface md:bg-background rounded-t-3xl md:rounded-none -mt-5 md:mt-0 px-6 pt-8 pb-8 md:pt-0 md:pb-6 md:px-12 lg:px-16 flex flex-col justify-center overflow-y-auto">
        <div className="w-full max-w-sm md:max-w-md mx-auto">
          <h2 className="text-2xl md:text-3xl font-display font-bold text-foreground tracking-tight">
            Welcome back
          </h2>
          <p className="text-sm text-muted-foreground mt-1.5 mb-7">
            Sign in to continue to your account.
          </p>

          <form onSubmit={handleLogin} className="flex flex-col gap-4">
            {error && (
              <div
                className="bg-danger-muted text-danger-foreground p-3 rounded-xl text-sm flex items-center gap-2"
                role="alert"
              >
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span>{error}</span>
              </div>
            )}

            <div className="space-y-1.5">
              <label
                htmlFor="login-username"
                className="block text-xs font-semibold text-foreground tracking-wide"
              >
                Username
              </label>
              <div className="relative">
                <User className="w-5 h-5 absolute left-3.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
                <input
                  id="login-username"
                  type="text"
                  required
                  autoCapitalize="none"
                  autoCorrect="off"
                  aria-invalid={!!fieldErrors.username}
                  aria-describedby={fieldErrors.username ? 'username-error' : undefined}
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  className={`w-full h-12 pl-11 pr-4 text-base md:text-sm bg-surface md:bg-surface-2 border border-border rounded-xl focus:border-primary-500 focus:ring-2 focus:ring-primary-500/20 outline-none transition-colors text-foreground placeholder:text-muted-foreground ${fieldErrors.username ? 'border-danger ring-2 ring-danger/20' : ''}`}
                  placeholder="Your name or email"
                />
              </div>
              {fieldErrors.username && (
                <p id="username-error" className="text-xs text-danger ml-0.5" role="alert">{fieldErrors.username}</p>
              )}
            </div>

            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <label
                  htmlFor="login-password"
                  className="block text-xs font-semibold text-foreground tracking-wide"
                >
                  Password
                </label>
                <button
                  type="button"
                  onClick={() => setShowForgotPassword(true)}
                  className="text-xs font-medium text-primary-600 dark:text-primary-400 hover:underline min-h-[44px] px-2 -mr-2 flex items-center"
                  aria-label="Reset your password"
                >
                  Forgot password?
                </button>
              </div>
              <div className="relative">
                <Lock className="w-5 h-5 absolute left-3.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
                <input
                  id="login-password"
                  type={showPassword ? "text" : "password"}
                  required
                  aria-invalid={!!fieldErrors.password}
                  aria-describedby={fieldErrors.password ? 'password-error' : undefined}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className={`w-full h-12 pl-11 pr-12 text-base md:text-sm bg-surface md:bg-surface-2 border border-border rounded-xl focus:border-primary-500 focus:ring-2 focus:ring-primary-500/20 outline-none transition-colors text-foreground placeholder:text-muted-foreground [&::-ms-reveal]:hidden [&::-webkit-credentials-auto-fill-button]:hidden ${fieldErrors.password ? 'border-danger ring-2 ring-danger/20' : ''}`}
                  placeholder="Enter your password"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="w-10 h-10 flex items-center justify-center text-muted-foreground hover:text-foreground transition-colors rounded-lg active:bg-surface"
                  style={{ position: 'absolute', right: '4px', top: '50%', transform: 'translateY(-50%)', zIndex: 10 }}
                  aria-label={showPassword ? "Hide password" : "Show password"}
                >
                  {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                </button>
              </div>
              {fieldErrors.password && (
                <p id="password-error" className="text-xs text-danger ml-0.5" role="alert">{fieldErrors.password}</p>
              )}
            </div>

            <button
              type="submit"
              disabled={isSubmitting || isLoading}
              className="w-full h-12 bg-primary-600 hover:bg-primary-700 active:scale-[0.99] disabled:opacity-60 text-white text-sm font-semibold rounded-xl transition-all shadow-elev-sm mt-2"
            >
              {isLoading ? 'Loading accounts…' : isSubmitting ? 'Signing in…' : 'Sign In'}
            </button>

            {canUseBiometric && isBiometricEnabled() && (
              <>
                <div className="relative my-1 flex items-center">
                  <div className="flex-1 h-px bg-border" />
                  <span className="mx-3 text-[10px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">
                    Or
                  </span>
                  <div className="flex-1 h-px bg-border" />
                </div>
                <button
                  type="button"
                  onClick={handleBiometricQuickLogin}
                  className="w-full h-12 flex items-center justify-center gap-2 bg-surface-2 hover:bg-muted text-foreground font-medium rounded-xl transition-colors border border-border"
                >
                  <Fingerprint className="w-5 h-5 text-primary-600 dark:text-primary-400" />
                  Use Biometrics
                </button>
              </>
            )}

            <div className="mt-4 flex justify-center">
              <button
                type="button"
                onClick={() => setShowServerSettings(true)}
                className="text-xs text-muted-foreground hover:text-foreground transition-colors"
              >
                Database Connection Settings
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}
