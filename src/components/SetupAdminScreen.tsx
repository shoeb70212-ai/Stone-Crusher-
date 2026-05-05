import React, { useState } from 'react';
import { AlertCircle, ArrowRight, ShieldCheck } from 'lucide-react';
import { supabase } from '../lib/supabase';
import logoSvg from '../assets/logo.svg';

interface SetupAdminScreenProps {
  /** Called after the admin account is created and signed in successfully. */
  onSetupComplete: () => void;
}

/** Shown on first launch when no users exist. Creates the initial admin account. */
export function SetupAdminScreen({ onSetupComplete }: SetupAdminScreenProps) {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (password.length < 8) {
      setError('Password must be at least 8 characters.');
      return;
    }
    if (password !== confirm) {
      setError('Passwords do not match.');
      return;
    }

    setSubmitting(true);
    try {
      const API_URL = (import.meta.env.VITE_API_URL as string) || '';
      const res = await fetch(`${API_URL}/api/admin-users`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          bootstrap: true,
          name: name.trim() || 'Admin',
          email: email.trim().toLowerCase(),
          password,
          role: 'Admin',
        }),
      });

      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        setError(body.error || 'Could not create account. Check your connection and try again.');
        return;
      }

      const { error: signInError } = await supabase.auth.signInWithPassword({
        email: email.trim().toLowerCase(),
        password,
      });

      if (signInError) {
        setError('Account created but sign-in failed. Please reload and try logging in.');
        return;
      }

      onSetupComplete();
    } finally {
      setSubmitting(false);
    }
  };

  /** Shared input style — semantic tokens, accessible focus ring. */
  const inputCls =
    "w-full h-12 px-4 text-sm bg-surface md:bg-surface-2 border border-border rounded-xl outline-none focus:border-primary-500 focus:ring-2 focus:ring-primary-500/20 transition-colors text-foreground placeholder:text-muted-foreground";

  return (
    <div className="min-h-screen flex flex-col md:flex-row bg-background">
      {/* ── Brand panel (mobile top hero / desktop left column) ── */}
      <div className="md:flex-1 md:min-h-screen relative bg-primary-600 dark:bg-primary-700 flex flex-col items-center md:items-start justify-center px-6 md:px-12 lg:px-16 py-10 md:py-12">
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
            <img src={logoSvg} alt="CrushTrack logo" className="w-full h-full object-cover" />
          </div>
          <div className="text-center md:text-left">
            <h1 className="text-3xl md:text-5xl font-display font-bold text-white tracking-tight leading-[1.05]">
              CrushTrack
            </h1>
            <p className="text-primary-100 mt-1.5 md:mt-3 text-sm md:text-base">
              Stone Crusher ERP
            </p>
          </div>
          <p className="hidden md:block text-sm text-primary-100/90 leading-relaxed mt-4 max-w-xs">
            One last step — create the owner account that will manage your operations.
          </p>
        </div>
      </div>

      {/* ── Form panel ── */}
      <div className="flex-1 bg-surface md:bg-background rounded-t-3xl md:rounded-none -mt-5 md:mt-0 px-6 pt-8 md:pt-0 pb-6 md:px-12 lg:px-16 flex flex-col justify-center">
        <div className="w-full max-w-sm md:max-w-md mx-auto">
          <div className="flex items-center gap-3 mb-1">
            <div className="w-10 h-10 rounded-xl bg-primary-50 dark:bg-primary-500/10 text-primary-600 dark:text-primary-400 flex items-center justify-center shrink-0">
              <ShieldCheck className="w-5 h-5" />
            </div>
            <h2 className="text-2xl md:text-3xl font-display font-bold text-foreground tracking-tight">
              Create admin account
            </h2>
          </div>
          <p className="text-sm text-muted-foreground mb-7 ml-[52px] leading-relaxed">
            Set up the owner account to get started. You can add more users later in Settings.
          </p>

          <form onSubmit={handleSubmit} className="flex flex-col gap-3.5">
            {error && (
              <div
                className="bg-danger-muted text-danger-foreground p-3 rounded-xl text-sm flex items-center gap-2"
                role="alert"
              >
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span>{error}</span>
              </div>
            )}

            <input
              required
              type="text"
              placeholder="Full name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className={inputCls}
            />
            <input
              required
              type="email"
              placeholder="Email address"
              autoCapitalize="none"
              autoCorrect="off"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className={inputCls}
            />
            <input
              required
              type="password"
              placeholder="Password (min 8 characters)"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className={inputCls}
            />
            <input
              required
              type="password"
              placeholder="Confirm password"
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
              className={inputCls}
            />

            <button
              type="submit"
              disabled={submitting}
              className="w-full h-12 bg-primary-600 hover:bg-primary-700 active:scale-[0.99] disabled:opacity-60 text-white text-sm font-semibold rounded-xl transition-all shadow-elev-sm mt-2 flex items-center justify-center gap-2"
            >
              {submitting ? 'Creating account…' : (
                <>Create Account &amp; Continue <ArrowRight className="w-4 h-4" /></>
              )}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
