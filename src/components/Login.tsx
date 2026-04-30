import React, { useState, useEffect } from 'react';
import { Shield, Lock, Mail, AlertCircle, Fingerprint } from 'lucide-react';
import { useErp } from '../context/ErpContext';
import { verifyPassword, DEFAULT_ADMIN_PASSWORD_HASH } from '../lib/auth';
import { loginSchema, type LoginInput } from '../lib/validation';
import {
  isBiometricAvailable,
  isBiometricEnabled,
  authenticateWithBiometrics,
  saveBiometricCredentials,
} from '../lib/biometrics';
import { secureSet } from '../lib/secure-storage';

interface LoginProps {
  onLogin: () => void;
}

export function Login({ onLogin }: LoginProps) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [fieldErrors, setFieldErrors] = useState<{ email?: string; password?: string }>({});
  const [showBiometricPrompt, setShowBiometricPrompt] = useState(false);
  const [pendingToken, setPendingToken] = useState<string | null>(null);
  const [canUseBiometric, setCanUseBiometric] = useState(false);
  const { companySettings, setUserRole } = useErp();

  useEffect(() => {
    isBiometricAvailable().then(setCanUseBiometric);
  }, []);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setFieldErrors({});
    setIsSubmitting(true);

    const validation: LoginInput = { email, password };
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
      const hasUsers = companySettings.users && companySettings.users.length > 0;

      if (!hasUsers) {
        // Default admin fallback — password is verified against a stored hash.
        const valid = await verifyPassword(password, DEFAULT_ADMIN_PASSWORD_HASH);
        if (email === 'admin@admin.com' && valid) {
          setUserRole('Admin');
          const token = 'admin_session';
          await secureSet('erp_auth_token', token);
          localStorage.setItem('erp_auth_token', token); // mirror for synchronous reads
          if (canUseBiometric && !isBiometricEnabled()) {
            setPendingToken(token);
            setShowBiometricPrompt(true);
          } else {
            onLogin();
          }
          return;
        }
      } else {
        const user = companySettings.users?.find(
          (u) => u.email === email && u.status === 'Active',
        );

        if (user) {
          if (!user.passwordHash) {
            // User exists but has no password hash set — account not yet activated.
            setError('This account has no password configured. Ask an Admin to reset it.');
            return;
          }
          const valid = await verifyPassword(password, user.passwordHash);
          if (valid) {
            setUserRole(user.role);
            const token = `session_${user.id}`;
            // Use a non-guessable session marker scoped to this user.
            await secureSet('erp_auth_token', token);
            localStorage.setItem('erp_auth_token', token); // mirror for synchronous reads
            if (canUseBiometric && !isBiometricEnabled()) {
              setPendingToken(token);
              setShowBiometricPrompt(true);
            } else {
              onLogin();
            }
            return;
          }
        }
      }

      setError('Invalid email or password.');
    } finally {
      setIsSubmitting(false);
    }
  };

  /** Handles the biometric enrollment dialog after a successful password login. */
  const handleBiometricEnrollment = async (enable: boolean) => {
    if (enable && pendingToken) {
      await saveBiometricCredentials(pendingToken);
    }
    setShowBiometricPrompt(false);
    onLogin();
  };

  /** Attempts biometric quick-login when the user taps the fingerprint button. */
  const handleBiometricQuickLogin = async () => {
    const token = await authenticateWithBiometrics();
    if (token) {
      await secureSet('erp_auth_token', token);
      localStorage.setItem('erp_auth_token', token); // mirror for synchronous reads
      onLogin();
    } else {
      setError('Biometric authentication failed. Use your password instead.');
    }
  };

  /** Company name — from settings if configured, otherwise fallback. */
  const appName = companySettings.name?.trim() || 'CrushTrack';

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
      {/* Top 40% — branded gradient hero area */}
      <div className="flex-2 bg-linear-to-br from-primary-600 via-primary-600 to-primary-700 flex flex-col items-center justify-center px-6 gap-4">
        <div className="w-20 h-20 bg-white/20 rounded-3xl flex items-center justify-center backdrop-blur-sm shadow-lg">
          <Shield className="w-10 h-10 text-white" />
        </div>
        <div className="text-center">
          <h1 className="text-3xl font-bold text-white tracking-tight">{appName}</h1>
          <p className="text-primary-100 mt-1 text-sm">Stone Crusher ERP</p>
        </div>
      </div>

      {/* Bottom 60% — login form */}
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
              <Mail className="w-4 h-4 absolute left-4 top-1/2 -translate-y-1/2 text-zinc-400" />
              <input
                id="login-email"
                type="email"
                required
                aria-invalid={!!fieldErrors.email}
                aria-describedby={fieldErrors.email ? 'email-error' : undefined}
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className={`w-full pl-11 pr-4 py-3 text-sm bg-zinc-100 dark:bg-zinc-800 border-0 rounded-2xl focus:ring-2 focus:ring-primary-500 outline-none transition-all text-zinc-900 dark:text-white placeholder:text-zinc-400 ${fieldErrors.email ? 'ring-2 ring-rose-500' : ''}`}
                placeholder="Email address"
              />
            </div>
            {fieldErrors.email && (
              <p id="email-error" className="text-xs text-rose-500 ml-1" role="alert">{fieldErrors.email}</p>
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
            disabled={isSubmitting}
            className="w-full h-12 bg-primary-600 hover:bg-primary-700 active:scale-[0.98] disabled:opacity-60 text-white text-base font-semibold rounded-2xl transition-all shadow-sm mt-2"
          >
            {isSubmitting ? 'Signing in…' : 'Sign In'}
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
