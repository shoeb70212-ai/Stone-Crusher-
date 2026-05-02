import React, { useState, useEffect } from 'react';
import { Lock, User, AlertCircle, Fingerprint } from 'lucide-react';
import { useErp } from '../context/ErpContext';
import { loginSchema, type LoginInput } from '../lib/validation';
import { supabase } from '../lib/supabase';
import {
  isBiometricAvailable,
  isBiometricEnabled,
  saveBiometricCredentials,
  clearBiometricCredentials,
} from '../lib/biometrics';
import logoSvg from '../assets/logo.svg';

interface LoginProps {
  onLogin: () => void;
}

export function Login({ onLogin }: LoginProps) {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [fieldErrors, setFieldErrors] = useState<{ email?: string; password?: string }>({});
  const [showBiometricPrompt, setShowBiometricPrompt] = useState(false);
  const [canUseBiometric, setCanUseBiometric] = useState(false);

  // First-run setup state — shown when no users exist yet.
  const [setupMode, setSetupMode] = useState(false);
  const [setupName, setSetupName] = useState('Admin');
  const [setupEmail, setSetupEmail] = useState('');
  const [setupPassword, setSetupPassword] = useState('');
  const [setupConfirm, setSetupConfirm] = useState('');
  const [setupError, setSetupError] = useState('');
  const [setupSubmitting, setSetupSubmitting] = useState(false);

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

    const users = companySettings.users ?? [];
    if (users.length === 0) {
      setSetupMode(true);
      setIsSubmitting(false);
      return;
    }

    const cleanedUsername = username.trim();
    const validation: LoginInput = { email: cleanedUsername, password };
    const result = loginSchema.safeParse(validation);

    if (!result.success) {
      const errors: { email?: string; password?: string } = {};
      result.error.issues.forEach((issue) => {
        if (issue.path[0] === 'email') errors.email = issue.message;
        if (issue.path[0] === 'password') errors.password = issue.message;
      });
      setFieldErrors(errors);
      setIsSubmitting(false);
      return;
    }

    try {
      // Resolve the email — the user may have typed their name instead.
      const loginIdentity = cleanedUsername.toLowerCase();
      const matchedUser = users.find(
        (u) =>
          (u.email.toLowerCase() === loginIdentity || u.name.toLowerCase() === loginIdentity) &&
          u.status === 'Active',
      );

      if (!matchedUser) {
        setError('Invalid username or password.');
        return;
      }

      const { error: authError } = await supabase.auth.signInWithPassword({
        email: matchedUser.email,
        password,
      });

      if (authError) {
        setError('Invalid username or password.');
        return;
      }

      recordAuditEvent({
        action: 'Signed in',
        entityType: 'System',
        description: `Signed in as ${matchedUser.role}.`,
        metadata: { role: matchedUser.role },
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

  /** Creates the very first admin account via the bootstrap endpoint. */
  const handleSetup = async (e: React.FormEvent) => {
    e.preventDefault();
    setSetupError('');

    if (setupPassword.length < 8) {
      setSetupError('Password must be at least 8 characters.');
      return;
    }
    if (setupPassword !== setupConfirm) {
      setSetupError('Passwords do not match.');
      return;
    }

    setSetupSubmitting(true);
    try {
      const API_URL = import.meta.env.VITE_API_URL as string || '';
      const res = await fetch(`${API_URL}/api/admin-users`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          bootstrap: true,
          name: setupName.trim() || 'Admin',
          email: setupEmail.trim().toLowerCase(),
          password: setupPassword,
          role: 'Admin',
        }),
      });

      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        setSetupError(body.error || 'Could not create admin account. Check your connection and try again.');
        return;
      }

      // Sign in immediately with the credentials just created.
      const { error: signInError } = await supabase.auth.signInWithPassword({
        email: setupEmail.trim().toLowerCase(),
        password: setupPassword,
      });

      if (signInError) {
        setSetupError('Account created but sign-in failed. Please reload and try logging in.');
        return;
      }

      pendingLoginRef.current = true;
    } finally {
      setSetupSubmitting(false);
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

  // First-run setup screen — no users configured yet
  if (setupMode) {
    return (
      <div className="h-screen bg-zinc-50 dark:bg-zinc-900 flex items-center justify-center p-6">
        <div className="w-full max-w-sm">
          <h2 className="text-xl font-bold text-zinc-900 dark:text-white mb-1">Create Admin Account</h2>
          <p className="text-sm text-zinc-500 dark:text-zinc-400 mb-6">
            No users are set up yet. Create the first admin account to get started.
          </p>
          <form onSubmit={handleSetup} className="flex flex-col gap-4">
            {setupError && (
              <div className="bg-rose-50 dark:bg-rose-900/30 border border-rose-200 dark:border-rose-800 text-rose-600 dark:text-rose-400 p-3 rounded-xl text-sm flex items-center gap-2">
                <AlertCircle className="w-4 h-4 shrink-0" />
                {setupError}
              </div>
            )}
            <input
              required
              type="text"
              placeholder="Full name"
              value={setupName}
              onChange={(e) => setSetupName(e.target.value)}
              className="w-full px-4 py-3 text-sm bg-zinc-100 dark:bg-zinc-800 rounded-2xl outline-none focus:ring-2 focus:ring-primary-500 text-zinc-900 dark:text-white placeholder:text-zinc-400"
            />
            <input
              required
              type="email"
              placeholder="Email address"
              value={setupEmail}
              onChange={(e) => setSetupEmail(e.target.value)}
              className="w-full px-4 py-3 text-sm bg-zinc-100 dark:bg-zinc-800 rounded-2xl outline-none focus:ring-2 focus:ring-primary-500 text-zinc-900 dark:text-white placeholder:text-zinc-400"
            />
            <input
              required
              type="password"
              placeholder="Password (min 8 characters)"
              value={setupPassword}
              onChange={(e) => setSetupPassword(e.target.value)}
              className="w-full px-4 py-3 text-sm bg-zinc-100 dark:bg-zinc-800 rounded-2xl outline-none focus:ring-2 focus:ring-primary-500 text-zinc-900 dark:text-white placeholder:text-zinc-400"
            />
            <input
              required
              type="password"
              placeholder="Confirm password"
              value={setupConfirm}
              onChange={(e) => setSetupConfirm(e.target.value)}
              className="w-full px-4 py-3 text-sm bg-zinc-100 dark:bg-zinc-800 rounded-2xl outline-none focus:ring-2 focus:ring-primary-500 text-zinc-900 dark:text-white placeholder:text-zinc-400"
            />
            <button
              type="submit"
              disabled={setupSubmitting}
              className="w-full h-12 bg-primary-600 hover:bg-primary-700 disabled:opacity-60 text-white font-semibold rounded-2xl transition-colors"
            >
              {setupSubmitting ? 'Creating account…' : 'Create Account & Sign In'}
            </button>
          </form>
        </div>
      </div>
    );
  }

  // Biometric enrollment prompt shown after a successful password login
  if (showBiometricPrompt) {
    return (
      <div className="h-screen bg-zinc-50 dark:bg-zinc-900 flex items-center justify-center p-6">
        <div className="w-full max-w-sm text-center">
          <div className="w-20 h-20 bg-primary-100 dark:bg-primary-900/30 rounded-full flex items-center justify-center mx-auto mb-5">
            <Fingerprint className="w-10 h-10 text-primary-600 dark:text-primary-400" />
          </div>
          <h2 className="text-xl font-bold text-zinc-900 dark:text-white mb-2">Enable Biometric Login?</h2>
          <p className="text-sm text-zinc-500 dark:text-zinc-400 mb-8">
            Sign in faster next time with your fingerprint or face ID instead of your password.
          </p>
          <div className="flex flex-col gap-3">
            <button
              onClick={() => handleBiometricEnrollment(true)}
              className="w-full h-12 bg-primary-600 hover:bg-primary-700 text-white font-semibold rounded-2xl transition-colors"
            >
              Enable Biometric Login
            </button>
            <button
              onClick={() => handleBiometricEnrollment(false)}
              className="w-full h-12 bg-zinc-100 dark:bg-zinc-800 hover:bg-zinc-200 dark:hover:bg-zinc-700 text-zinc-600 dark:text-zinc-300 font-medium rounded-2xl transition-colors"
            >
              Skip for now
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="h-screen flex flex-col overflow-hidden bg-white dark:bg-zinc-900">
      {/* Top section — branded gradient hero with logo */}
      <div className="flex-2 bg-linear-to-br from-primary-600 via-primary-600 to-primary-700 flex flex-col items-center justify-center px-6 gap-4">
        <div className="w-24 h-24 rounded-3xl overflow-hidden shadow-xl bg-white">
          <img
            src={logoSvg}
            alt={`${appName} logo`}
            className="w-full h-full object-cover"
          />
        </div>
        <div className="text-center">
          <h1 className="text-3xl font-bold text-white tracking-tight">{appName}</h1>
          <p className="text-primary-100 mt-1 text-sm">Stone Crusher ERP</p>
        </div>
      </div>

      {/* Bottom section — login form */}
      <div className="flex-3 bg-white dark:bg-zinc-900 rounded-t-3xl -mt-4 px-6 pt-8 pb-safe flex flex-col">
        <h2 className="text-xl font-bold text-zinc-900 dark:text-white mb-1">Welcome back</h2>
        <p className="text-sm text-zinc-500 dark:text-zinc-400 mb-6">Sign in to continue</p>

        <form onSubmit={handleLogin} className="flex flex-col gap-4 flex-1">
          {error && (
            <div className="bg-rose-50 dark:bg-rose-900/30 border border-rose-200 dark:border-rose-800 text-rose-600 dark:text-rose-400 p-3 rounded-xl text-sm flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0" />
              {error}
            </div>
          )}

          <div className="space-y-1">
            <div className="relative">
              <User className="w-4 h-4 absolute left-4 top-1/2 -translate-y-1/2 text-zinc-400" />
              <input
                id="login-username"
                type="text"
                required
                autoCapitalize="none"
                autoCorrect="off"
                aria-invalid={!!fieldErrors.email}
                aria-describedby={fieldErrors.email ? 'username-error' : undefined}
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                className={`w-full pl-11 pr-4 py-3 text-sm bg-zinc-100 dark:bg-zinc-800 border-0 rounded-2xl focus:ring-2 focus:ring-primary-500 outline-none transition-all text-zinc-900 dark:text-white placeholder:text-zinc-400 ${fieldErrors.email ? 'ring-2 ring-rose-500' : ''}`}
                placeholder="Username or email"
              />
            </div>
            {fieldErrors.email && (
              <p id="username-error" className="text-xs text-rose-500 ml-1" role="alert">{fieldErrors.email}</p>
            )}
          </div>

          <div className="space-y-1">
            <div className="relative">
              <Lock className="w-4 h-4 absolute left-4 top-1/2 -translate-y-1/2 text-zinc-400" />
              <input
                id="login-password"
                type="password"
                required
                aria-invalid={!!fieldErrors.password}
                aria-describedby={fieldErrors.password ? 'password-error' : undefined}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className={`w-full pl-11 pr-4 py-3 text-sm bg-zinc-100 dark:bg-zinc-800 border-0 rounded-2xl focus:ring-2 focus:ring-primary-500 outline-none transition-all text-zinc-900 dark:text-white placeholder:text-zinc-400 ${fieldErrors.password ? 'ring-2 ring-rose-500' : ''}`}
                placeholder="Password"
              />
            </div>
            {fieldErrors.password && (
              <p id="password-error" className="text-xs text-rose-500 ml-1" role="alert">{fieldErrors.password}</p>
            )}
          </div>

          <button
            type="submit"
            disabled={isSubmitting || isLoading}
            className="w-full h-12 bg-primary-600 hover:bg-primary-700 active:scale-[0.98] disabled:opacity-60 text-white text-base font-semibold rounded-2xl transition-all shadow-sm mt-2"
          >
            {isLoading ? 'Loading accounts…' : isSubmitting ? 'Signing in…' : 'Sign In'}
          </button>

          {canUseBiometric && isBiometricEnabled() && (
            <button
              type="button"
              onClick={handleBiometricQuickLogin}
              className="w-full h-12 flex items-center justify-center gap-2 bg-zinc-100 dark:bg-zinc-800 hover:bg-zinc-200 dark:hover:bg-zinc-700 text-zinc-700 dark:text-zinc-300 font-medium rounded-2xl transition-colors"
            >
              <Fingerprint className="w-5 h-5" />
              Use Biometrics
            </button>
          )}
        </form>
      </div>
    </div>
  );
}
