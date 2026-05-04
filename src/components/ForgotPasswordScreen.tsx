import { useState } from 'react';
import { Mail, ArrowLeft, AlertCircle, CheckCircle2 } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { forgotPasswordSchema, type ForgotPasswordInput } from '../lib/validation';
import logoSvg from '../assets/logo.svg';

interface ForgotPasswordScreenProps {
  onBack: () => void;
}

export function ForgotPasswordScreen({ onBack }: ForgotPasswordScreenProps) {
  const [email, setEmail] = useState('');
  const [fieldError, setFieldError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [sent, setSent] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFieldError('');

    const input: ForgotPasswordInput = { email: email.trim() };
    const result = forgotPasswordSchema.safeParse(input);
    if (!result.success) {
      setFieldError(result.error.issues[0]?.message ?? 'Invalid email');
      return;
    }

    setIsSubmitting(true);
    try {
      // Always show the success state regardless of whether the address exists —
      // this prevents user enumeration.
      await supabase.auth.resetPasswordForEmail(result.data.email, {
        redirectTo: `${window.location.origin}/?reset=1`,
      });
      setSent(true);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="h-screen flex flex-col overflow-hidden bg-white dark:bg-zinc-900">
      {/* Branded hero */}
      <div className="flex-2 bg-linear-to-br from-primary-600 via-primary-600 to-primary-700 flex flex-col items-center justify-center px-6 gap-4">
        <div className="w-24 h-24 rounded-3xl overflow-hidden shadow-xl bg-white">
          <img src={logoSvg} alt="CrushTrack logo" className="w-full h-full object-cover" />
        </div>
      </div>

      {/* Form card */}
      <div className="flex-3 bg-white dark:bg-zinc-900 rounded-t-3xl -mt-4 px-6 pt-8 pb-safe flex flex-col">
        <button
          type="button"
          onClick={onBack}
          className="flex items-center gap-1.5 text-sm text-zinc-500 dark:text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200 mb-5 -ml-1 transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          Back to sign in
        </button>

        {sent ? (
          <div className="flex flex-col items-center text-center gap-4 mt-4">
            <div className="w-16 h-16 bg-green-100 dark:bg-green-900/30 rounded-full flex items-center justify-center">
              <CheckCircle2 className="w-8 h-8 text-green-600 dark:text-green-400" />
            </div>
            <h2 className="text-xl font-bold text-zinc-900 dark:text-white">Check your email</h2>
            <p className="text-sm text-zinc-500 dark:text-zinc-400 max-w-xs">
              If an account exists for <span className="font-medium text-zinc-700 dark:text-zinc-200">{email.trim()}</span>,
              you will receive a password reset link shortly.
            </p>
            <button
              type="button"
              onClick={onBack}
              className="mt-4 w-full h-12 bg-primary-600 hover:bg-primary-700 text-white font-semibold rounded-2xl transition-colors"
            >
              Back to sign in
            </button>
          </div>
        ) : (
          <>
            <h2 className="text-xl font-bold text-zinc-900 dark:text-white mb-1">Reset your password</h2>
            <p className="text-sm text-zinc-500 dark:text-zinc-400 mb-6">
              Enter your account email and we'll send you a reset link.
            </p>

            <form onSubmit={handleSubmit} className="flex flex-col gap-4">
              <div className="space-y-1">
                <div className="relative">
                  <Mail className="w-4 h-4 absolute left-4 top-1/2 -translate-y-1/2 text-zinc-400" />
                  <input
                    id="forgot-email"
                    type="text"
                    autoCapitalize="none"
                    autoCorrect="off"
                    required
                    aria-invalid={!!fieldError}
                    aria-describedby={fieldError ? 'forgot-email-error' : undefined}
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className={`w-full pl-11 pr-4 py-3 text-sm bg-zinc-100 dark:bg-zinc-800 border-0 rounded-2xl focus:ring-2 focus:ring-primary-500 outline-none transition-all text-zinc-900 dark:text-white placeholder:text-zinc-400 ${fieldError ? 'ring-2 ring-rose-500' : ''}`}
                    placeholder="Email address"
                  />
                </div>
                {fieldError && (
                  <p id="forgot-email-error" className="text-xs text-rose-500 ml-1 flex items-center gap-1" role="alert">
                    <AlertCircle className="w-3 h-3 shrink-0" />
                    {fieldError}
                  </p>
                )}
              </div>

              <button
                type="submit"
                disabled={isSubmitting}
                className="w-full h-12 bg-primary-600 hover:bg-primary-700 active:scale-[0.98] disabled:opacity-60 text-white text-base font-semibold rounded-2xl transition-all shadow-sm mt-2"
              >
                {isSubmitting ? 'Sending…' : 'Send reset link'}
              </button>
            </form>
          </>
        )}
      </div>
    </div>
  );
}
