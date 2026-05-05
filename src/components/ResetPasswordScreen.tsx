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

  /** Shared input style — semantic tokens, accessible focus ring. */
  const inputCls =
    "w-full h-12 pl-10 pr-11 text-sm bg-surface md:bg-surface-2 border border-border rounded-xl focus:border-primary-500 focus:ring-2 focus:ring-primary-500/20 outline-none transition-colors text-foreground placeholder:text-muted-foreground";

  return (
    <div className="min-h-screen flex flex-col md:flex-row bg-background">
      {/* ── Brand panel ── */}
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
            <p className="text-primary-100 mt-1.5 md:mt-3 text-sm md:text-base">Stone Crusher ERP</p>
          </div>
        </div>
      </div>

      {/* ── Form panel ── */}
      <div className="flex-1 bg-surface md:bg-background rounded-t-3xl md:rounded-none -mt-5 md:mt-0 px-6 pt-8 md:pt-0 pb-6 md:px-12 lg:px-16 flex flex-col justify-center">
        <div className="w-full max-w-sm md:max-w-md mx-auto">
          {done ? (
            <div className="flex flex-col items-center text-center gap-4 mt-4">
              <div className="w-16 h-16 bg-success-muted rounded-2xl flex items-center justify-center">
                <CheckCircle2 className="w-8 h-8 text-success" />
              </div>
              <h2 className="text-2xl font-display font-bold text-foreground tracking-tight">
                Password updated
              </h2>
              <p className="text-sm text-muted-foreground">Signing you in…</p>
            </div>
          ) : (
            <>
              <h2 className="text-2xl md:text-3xl font-display font-bold text-foreground tracking-tight">
                Set a new password
              </h2>
              <p className="text-sm text-muted-foreground mt-1.5 mb-7">
                Choose a strong password for your account.
              </p>

              {error && (
                <div
                  className="bg-danger-muted text-danger-foreground p-3 rounded-xl text-sm flex items-center gap-2 mb-4"
                  role="alert"
                >
                  <AlertCircle className="w-4 h-4 shrink-0" />
                  <span>{error}</span>
                </div>
              )}

              <form onSubmit={handleSubmit} className="flex flex-col gap-4">
                {/* New password */}
                <div className="space-y-1.5">
                  <label
                    htmlFor="reset-password"
                    className="block text-xs font-semibold text-foreground tracking-wide"
                  >
                    New password
                  </label>
                  <div className="relative">
                    <Lock className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
                    <input
                      id="reset-password"
                      type={showPassword ? 'text' : 'password'}
                      required
                      aria-invalid={!!fieldErrors.password}
                      aria-describedby={fieldErrors.password ? 'reset-password-error' : undefined}
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      className={`${inputCls} ${fieldErrors.password ? 'border-danger ring-2 ring-danger/20' : ''}`}
                      placeholder="At least 8 characters"
                    />
                    <button
                      type="button"
                      aria-label={showPassword ? 'Hide password' : 'Show password'}
                      onClick={() => setShowPassword((v) => !v)}
                      className="absolute right-3.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                    >
                      {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                  {fieldErrors.password && (
                    <p
                      id="reset-password-error"
                      className="text-xs text-danger ml-0.5 flex items-center gap-1"
                      role="alert"
                    >
                      <AlertCircle className="w-3 h-3 shrink-0" />
                      {fieldErrors.password}
                    </p>
                  )}
                </div>

                {/* Confirm password */}
                <div className="space-y-1.5">
                  <label
                    htmlFor="reset-confirm-password"
                    className="block text-xs font-semibold text-foreground tracking-wide"
                  >
                    Confirm password
                  </label>
                  <div className="relative">
                    <Lock className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
                    <input
                      id="reset-confirm-password"
                      type={showPassword ? 'text' : 'password'}
                      required
                      aria-invalid={!!fieldErrors.confirmPassword}
                      aria-describedby={fieldErrors.confirmPassword ? 'reset-confirm-error' : undefined}
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      className={`${inputCls} ${fieldErrors.confirmPassword ? 'border-danger ring-2 ring-danger/20' : ''}`}
                      placeholder="Re-enter your new password"
                    />
                  </div>
                  {fieldErrors.confirmPassword && (
                    <p
                      id="reset-confirm-error"
                      className="text-xs text-danger ml-0.5 flex items-center gap-1"
                      role="alert"
                    >
                      <AlertCircle className="w-3 h-3 shrink-0" />
                      {fieldErrors.confirmPassword}
                    </p>
                  )}
                </div>

                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="w-full h-12 bg-primary-600 hover:bg-primary-700 active:scale-[0.99] disabled:opacity-60 text-white text-sm font-semibold rounded-xl transition-all shadow-elev-sm mt-2"
                >
                  {isSubmitting ? 'Updating…' : 'Update password'}
                </button>
              </form>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
