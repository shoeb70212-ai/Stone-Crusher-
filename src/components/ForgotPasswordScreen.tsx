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
      <div className="flex-1 bg-surface md:bg-background rounded-t-3xl md:rounded-none -mt-5 md:mt-0 px-6 pt-6 md:pt-0 pb-6 md:px-12 lg:px-16 flex flex-col justify-center">
        <div className="w-full max-w-sm md:max-w-md mx-auto">
          <button
            type="button"
            onClick={onBack}
            className="inline-flex items-center gap-1.5 text-sm font-medium text-muted-foreground hover:text-foreground mb-6 -ml-1 transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
            Back to sign in
          </button>

          {sent ? (
            <div className="flex flex-col items-center text-center gap-4 mt-4">
              <div className="w-16 h-16 bg-success-muted rounded-2xl flex items-center justify-center">
                <CheckCircle2 className="w-8 h-8 text-success" />
              </div>
              <h2 className="text-2xl font-display font-bold text-foreground tracking-tight">
                Check your email
              </h2>
              <p className="text-sm text-muted-foreground max-w-xs leading-relaxed">
                If an account exists for{' '}
                <span className="font-semibold text-foreground">{email.trim()}</span>, you will receive a password reset link shortly.
              </p>
              <button
                type="button"
                onClick={onBack}
                className="mt-4 w-full h-12 bg-primary-600 hover:bg-primary-700 text-white text-sm font-semibold rounded-xl transition-colors shadow-elev-sm"
              >
                Back to sign in
              </button>
            </div>
          ) : (
            <>
              <h2 className="text-2xl md:text-3xl font-display font-bold text-foreground tracking-tight">
                Reset your password
              </h2>
              <p className="text-sm text-muted-foreground mt-1.5 mb-7">
                Enter your account email and we&apos;ll send you a reset link.
              </p>

              <form onSubmit={handleSubmit} className="flex flex-col gap-4">
                <div className="space-y-1.5">
                  <label
                    htmlFor="forgot-email"
                    className="block text-xs font-semibold text-foreground tracking-wide"
                  >
                    Email address
                  </label>
                  <div className="relative">
                    <Mail className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
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
                      className={`w-full h-12 pl-10 pr-4 text-sm bg-surface md:bg-surface-2 border border-border rounded-xl focus:border-primary-500 focus:ring-2 focus:ring-primary-500/20 outline-none transition-colors text-foreground placeholder:text-muted-foreground ${fieldError ? 'border-danger ring-2 ring-danger/20' : ''}`}
                      placeholder="you@company.com"
                    />
                  </div>
                  {fieldError && (
                    <p
                      id="forgot-email-error"
                      className="text-xs text-danger ml-0.5 flex items-center gap-1"
                      role="alert"
                    >
                      <AlertCircle className="w-3 h-3 shrink-0" />
                      {fieldError}
                    </p>
                  )}
                </div>

                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="w-full h-12 bg-primary-600 hover:bg-primary-700 active:scale-[0.99] disabled:opacity-60 text-white text-sm font-semibold rounded-xl transition-all shadow-elev-sm mt-2"
                >
                  {isSubmitting ? 'Sending…' : 'Send reset link'}
                </button>
              </form>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
