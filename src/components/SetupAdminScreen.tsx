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

  return (
    <div className="h-screen flex flex-col overflow-hidden bg-white dark:bg-zinc-900">
      {/* Branded hero — mirrors the Login screen */}
      <div className="flex-2 bg-linear-to-br from-primary-600 via-primary-600 to-primary-700 flex flex-col items-center justify-center px-6 gap-4">
        <div className="w-24 h-24 rounded-3xl overflow-hidden shadow-xl bg-white">
          <img src={logoSvg} alt="CrushTrack logo" className="w-full h-full object-cover" />
        </div>
        <div className="text-center">
          <h1 className="text-3xl font-bold text-white tracking-tight">CrushTrack</h1>
          <p className="text-primary-100 mt-1 text-sm">Stone Crusher ERP</p>
        </div>
      </div>

      {/* Setup form */}
      <div className="flex-3 bg-white dark:bg-zinc-900 rounded-t-3xl -mt-4 px-6 pt-8 pb-safe flex flex-col">
        {/* Header */}
        <div className="flex items-center gap-3 mb-1">
          <div className="w-9 h-9 rounded-xl bg-primary-100 dark:bg-primary-900/30 text-primary-600 dark:text-primary-400 flex items-center justify-center shrink-0">
            <ShieldCheck className="w-5 h-5" />
          </div>
          <h2 className="text-xl font-bold text-zinc-900 dark:text-white">Create admin account</h2>
        </div>
        <p className="text-sm text-zinc-500 dark:text-zinc-400 mb-6 ml-12">
          Set up the owner account to get started. You can add more users later in Settings.
        </p>

        <form onSubmit={handleSubmit} className="flex flex-col gap-4 flex-1">
          {error && (
            <div className="bg-rose-50 dark:bg-rose-900/30 border border-rose-200 dark:border-rose-800 text-rose-600 dark:text-rose-400 p-3 rounded-xl text-sm flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0" />
              {error}
            </div>
          )}

          <input
            required
            type="text"
            placeholder="Full name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="w-full px-4 py-3 text-sm bg-zinc-100 dark:bg-zinc-800 rounded-2xl outline-none focus:ring-2 focus:ring-primary-500 text-zinc-900 dark:text-white placeholder:text-zinc-400"
          />
          <input
            required
            type="email"
            placeholder="Email address"
            autoCapitalize="none"
            autoCorrect="off"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="w-full px-4 py-3 text-sm bg-zinc-100 dark:bg-zinc-800 rounded-2xl outline-none focus:ring-2 focus:ring-primary-500 text-zinc-900 dark:text-white placeholder:text-zinc-400"
          />
          <input
            required
            type="password"
            placeholder="Password (min 8 characters)"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="w-full px-4 py-3 text-sm bg-zinc-100 dark:bg-zinc-800 rounded-2xl outline-none focus:ring-2 focus:ring-primary-500 text-zinc-900 dark:text-white placeholder:text-zinc-400"
          />
          <input
            required
            type="password"
            placeholder="Confirm password"
            value={confirm}
            onChange={(e) => setConfirm(e.target.value)}
            className="w-full px-4 py-3 text-sm bg-zinc-100 dark:bg-zinc-800 rounded-2xl outline-none focus:ring-2 focus:ring-primary-500 text-zinc-900 dark:text-white placeholder:text-zinc-400"
          />

          <button
            type="submit"
            disabled={submitting}
            className="w-full h-12 bg-primary-600 hover:bg-primary-700 active:scale-[0.98] disabled:opacity-60 text-white text-base font-semibold rounded-2xl transition-all shadow-sm mt-2 flex items-center justify-center gap-2"
          >
            {submitting ? 'Creating account…' : (
              <>Create Account & Continue <ArrowRight className="w-4 h-4" /></>
            )}
          </button>
        </form>
      </div>
    </div>
  );
}
