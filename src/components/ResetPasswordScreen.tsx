import { useState } from 'react';
import { Lock, AlertCircle, CheckCircle2, Eye, EyeOff } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { resetPasswordSchema } from '../lib/validation';
import logoSvg from '../assets/logo.svg';

interface ResetPasswordScreenProps {
  /** Called after a successful password update so App can transition to the main UI. */
  onDone: () => void;
}

export function ResetPasswordScreen({ onDone }: ResetPasswordScreenProps) {
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [fieldErrors, setFieldErrors] = useState<{ password?: string; confirmPassword?: string }>({});
  const [error, setError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [done, setDone] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setFieldErrors({});

    const result = resetPasswordSchema.safeParse({ password, confirmPassword });
    if (!result.success) {
      const errors: { password?: string; confirmPassword?: string } = {};
      result.error.issues.forEach((issue) => {
        const key = issue.path[0] as keyof typeof errors;
        if (key === 'password' || key === 'confirmPassword') {
          errors[key] = issue.message;
        }
      });
      setFieldErrors(errors);
      return;
    }

    setIsSubmitting(true);
    try {
      const { error: updateError } = await supabase.auth.updateUser({
        password: result.data.password,
      });

      if (updateError) {
        setError(updateError.message || 'Failed to update password. Please try again.');
        return;
      }

      setDone(true);
      // Give the user a moment to read the success message, then proceed.
      setTimeout(onDone, 2000);
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
        {done ? (
          <div className="flex flex-col items-center text-center gap-4 mt-4">
            <div className="w-16 h-16 bg-green-100 dark:bg-green-900/30 rounded-full flex items-center justify-center">
              <CheckCircle2 className="w-8 h-8 text-green-600 dark:text-green-400" />
            </div>
            <h2 className="text-xl font-bold text-zinc-900 dark:text-white">Password updated</h2>
            <p className="text-sm text-zinc-500 dark:text-zinc-400">
              Signing you in…
            </p>
          </div>
        ) : (
          <>
            <h2 className="text-xl font-bold text-zinc-900 dark:text-white mb-1">Set new password</h2>
            <p className="text-sm text-zinc-500 dark:text-zinc-400 mb-6">
              Choose a strong password for your account.
            </p>

            {error && (
              <div className="bg-rose-50 dark:bg-rose-900/30 border border-rose-200 dark:border-rose-800 text-rose-600 dark:text-rose-400 p-3 rounded-xl text-sm flex items-center gap-2 mb-4">
                <AlertCircle className="w-4 h-4 shrink-0" />
                {error}
              </div>
            )}

            <form onSubmit={handleSubmit} className="flex flex-col gap-4">
              {/* New password */}
              <div className="space-y-1">
                <div className="relative">
                  <Lock className="w-4 h-4 absolute left-4 top-1/2 -translate-y-1/2 text-zinc-400" />
                  <input
                    id="reset-password"
                    type={showPassword ? 'text' : 'password'}
                    required
                    aria-invalid={!!fieldErrors.password}
                    aria-describedby={fieldErrors.password ? 'reset-password-error' : undefined}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className={`w-full pl-11 pr-11 py-3 text-sm bg-zinc-100 dark:bg-zinc-800 border-0 rounded-2xl focus:ring-2 focus:ring-primary-500 outline-none transition-all text-zinc-900 dark:text-white placeholder:text-zinc-400 ${fieldErrors.password ? 'ring-2 ring-rose-500' : ''}`}
                    placeholder="New password"
                  />
                  <button
                    type="button"
                    aria-label={showPassword ? 'Hide password' : 'Show password'}
                    onClick={() => setShowPassword((v) => !v)}
                    className="absolute right-4 top-1/2 -translate-y-1/2 text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200 transition-colors"
                  >
                    {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
                {fieldErrors.password && (
                  <p id="reset-password-error" className="text-xs text-rose-500 ml-1 flex items-center gap-1" role="alert">
                    <AlertCircle className="w-3 h-3 shrink-0" />
                    {fieldErrors.password}
                  </p>
                )}
              </div>

              {/* Confirm password */}
              <div className="space-y-1">
                <div className="relative">
                  <Lock className="w-4 h-4 absolute left-4 top-1/2 -translate-y-1/2 text-zinc-400" />
                  <input
                    id="reset-confirm-password"
                    type={showPassword ? 'text' : 'password'}
                    required
                    aria-invalid={!!fieldErrors.confirmPassword}
                    aria-describedby={fieldErrors.confirmPassword ? 'reset-confirm-error' : undefined}
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    className={`w-full pl-11 pr-4 py-3 text-sm bg-zinc-100 dark:bg-zinc-800 border-0 rounded-2xl focus:ring-2 focus:ring-primary-500 outline-none transition-all text-zinc-900 dark:text-white placeholder:text-zinc-400 ${fieldErrors.confirmPassword ? 'ring-2 ring-rose-500' : ''}`}
                    placeholder="Confirm new password"
                  />
                </div>
                {fieldErrors.confirmPassword && (
                  <p id="reset-confirm-error" className="text-xs text-rose-500 ml-1 flex items-center gap-1" role="alert">
                    <AlertCircle className="w-3 h-3 shrink-0" />
                    {fieldErrors.confirmPassword}
                  </p>
                )}
              </div>

              <button
                type="submit"
                disabled={isSubmitting}
                className="w-full h-12 bg-primary-600 hover:bg-primary-700 active:scale-[0.98] disabled:opacity-60 text-white text-base font-semibold rounded-2xl transition-all shadow-sm mt-2"
              >
                {isSubmitting ? 'Updating…' : 'Update password'}
              </button>
            </form>
          </>
        )}
      </div>
    </div>
  );
}
