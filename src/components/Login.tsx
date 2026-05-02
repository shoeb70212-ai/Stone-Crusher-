import React, { useState, useEffect } from 'react';
import { Lock, User, AlertCircle, Fingerprint } from 'lucide-react';
import { useErp } from '../context/ErpContext';
import { verifyPassword, hashPassword, isLegacyHash } from '../lib/auth';
import { loginSchema, type LoginInput } from '../lib/validation';
import {
  isBiometricAvailable,
  isBiometricEnabled,
  authenticateWithBiometrics,
  saveBiometricCredentials,
} from '../lib/biometrics';
import { secureSet } from '../lib/secure-storage';
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
  const [pendingToken, setPendingToken] = useState<string | null>(null);
  const [canUseBiometric, setCanUseBiometric] = useState(false);

  // First-run setup state — shown when no users exist yet.
  const [setupMode, setSetupMode] = useState(false);
  const [setupName, setSetupName] = useState('Admin');
  const [setupEmail, setSetupEmail] = useState('admin@admin.com');
  const [setupPassword, setSetupPassword] = useState('');
  const [setupConfirm, setSetupConfirm] = useState('');
  const [setupError, setSetupError] = useState('');

  const { companySettings, setUserRole, updateCompanySettings, recordAuditEvent } = useErp();

  useEffect(() => {
    isBiometricAvailable().then(setCanUseBiometric);
  }, []);

  /** Completes a successful login: stores session token, prompts biometric enroll if applicable. */
  const completeLogin = async (role: Parameters<typeof setUserRole>[0], token: string) => {
    setUserRole(role);
    await secureSet('erp_auth_token', token);
    localStorage.setItem('erp_auth_token', token);
    recordAuditEvent({
      action: "Signed in",
      entityType: "System",
      description: `Signed in as ${role}.`,
      metadata: { role },
    });
    if (canUseBiometric && !isBiometricEnabled()) {
      setPendingToken(token);
      setShowBiometricPrompt(true);
    } else {
      onLogin();
    }
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setFieldErrors({});
    setIsSubmitting(true);

    const validation: LoginInput = { email: username, password };
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
        // No users configured yet — redirect to first-run setup instead of
        // accepting a hard-coded default credential.
        setSetupMode(true);
        setIsSubmitting(false);
        return;
      } else {
        // Match against configured user accounts (by email or name).
        const user = companySettings.users?.find(
          (u) => (u.email === username || u.name === username) && u.status === 'Active',
        );

        if (user) {
          if (!user.passwordHash) {
            setError('This account has no password configured. Ask an Admin to reset it.');
            return;
          }
          const valid = await verifyPassword(password, user.passwordHash);
          if (valid) {
            // Silently migrate legacy SHA-256 hashes to PBKDF2 on successful login
            if (isLegacyHash(user.passwordHash)) {
              const newHash = await hashPassword(password);
              const updatedUsers = (companySettings.users || []).map((u) =>
                u.id === user.id ? { ...u, passwordHash: newHash } : u,
              );
              updateCompanySettings({ ...companySettings, users: updatedUsers });
            }
            await completeLogin(user.role, `session_${user.id}`);
            return;
          }
        }
      }

      setError('Invalid username or password.');
    } finally {
      setIsSubmitting(false);
    }
  };

  /** Creates the first admin account on initial setup. */
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
    const passwordHash = await hashPassword(setupPassword);
    const adminUser = {
      id: crypto.randomUUID(),
      name: setupName.trim() || 'Admin',
      email: setupEmail.trim() || 'admin@admin.com',
      role: 'Admin' as const,
      status: 'Active' as const,
      passwordHash,
    };
    updateCompanySettings({ ...companySettings, users: [adminUser] });
    await completeLogin('Admin', `session_${adminUser.id}`);
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
    if (!token) {
      setError('Biometric authentication failed. Use your password instead.');
      return;
    }

    // Resolve role from the recovered token, identical to the logic in
    // ErpContext.  Without this, every biometric login would silently use
    // whatever role was last set (defaulting to Admin on a cold boot).
    let resolvedRole: Parameters<typeof setUserRole>[0] | null = null;
    if (token === 'admin_session') {
      resolvedRole = 'Admin';
    } else {
      const userId = token.startsWith('session_') ? token.slice('session_'.length) : null;
      if (userId) {
        const user = companySettings.users?.find((u) => u.id === userId && u.status === 'Active');
        if (user) resolvedRole = user.role as Parameters<typeof setUserRole>[0];
      }
    }

    if (!resolvedRole) {
      setError('Biometric token is invalid or the account has been deactivated. Use your password.');
      return;
    }

    setUserRole(resolvedRole);
    await secureSet('erp_auth_token', token);
    localStorage.setItem('erp_auth_token', token);
    recordAuditEvent({
      action: "Signed in",
      entityType: "System",
      description: `Signed in with biometrics as ${resolvedRole}.`,
      metadata: { role: resolvedRole, method: "biometric" },
    });
    onLogin();
  };

  /** Company name — from settings if configured, otherwise fallback. */
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
              type="text"
              placeholder="Email / username"
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
              className="w-full h-12 bg-primary-600 hover:bg-primary-700 text-white font-semibold rounded-2xl transition-colors"
            >
              Create Account & Sign In
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
