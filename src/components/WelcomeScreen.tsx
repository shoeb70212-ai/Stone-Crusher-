import React, { useState } from 'react';
import { Building2, Package, CheckCircle2, ArrowRight, Upload, X } from 'lucide-react';
import { useErp } from '../context/ErpContext';
import { Material } from '../types';
import logoSvg from '../assets/logo.svg';

interface WelcomeScreenProps {
  onDone: () => void;
}

type Step = 'company' | 'material' | 'done';

const STEPS: Step[] = ['company', 'material', 'done'];

const STEP_META: Record<Step, { icon: React.ReactNode; title: string; subtitle: string }> = {
  company: {
    icon: <Building2 className="w-6 h-6" />,
    title: 'Set up your company',
    subtitle: 'Add your business name and address so they appear on slips and invoices.',
  },
  material: {
    icon: <Package className="w-6 h-6" />,
    title: 'Add your first material',
    subtitle: 'What does your crusher primarily sell? You can add more later in Settings.',
  },
  done: {
    icon: <CheckCircle2 className="w-6 h-6" />,
    title: "You're all set!",
    subtitle: 'CrushTrack is ready. Start by recording your first dispatch slip.',
  },
};

/** Renders a labelled text input consistent with the rest of the app's form style. */
function Field({
  label,
  id,
  type = 'text',
  value,
  onChange,
  placeholder,
  required,
}: {
  label: string;
  id: string;
  type?: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  required?: boolean;
}) {
  return (
    <div>
      <label htmlFor={id} className="block text-xs font-semibold text-foreground tracking-wide mb-1.5">
        {label}{required && <span className="text-danger ml-0.5" aria-hidden="true">*</span>}
      </label>
      <input
        id={id}
        type={type}
        required={required}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="w-full h-11 px-4 text-sm bg-surface-2 border border-border rounded-xl outline-none focus:border-primary-500 focus:ring-2 focus:ring-primary-500/20 text-foreground placeholder:text-muted-foreground transition-colors"
      />
    </div>
  );
}

export function WelcomeScreen({ onDone }: WelcomeScreenProps) {
  const { companySettings, updateCompanySettings } = useErp();

  const [step, setStep] = useState<Step>('company');
  const [saving, setSaving] = useState(false);

  // Company step state
  const [companyName, setCompanyName] = useState(companySettings.name ?? '');
  const [companyPhone, setCompanyPhone] = useState(companySettings.phone ?? '');
  const [companyAddress, setCompanyAddress] = useState(companySettings.address ?? '');
  const [companyLogo, setCompanyLogo] = useState<string | undefined>(companySettings.logo);

  // Material step state
  const [materialName, setMaterialName] = useState('');
  const [materialPrice, setMaterialPrice] = useState('');
  const [materialUnit, setMaterialUnit] = useState('Brass');
  const [skipMaterial, setSkipMaterial] = useState(false);

  const currentIndex = STEPS.indexOf(step);

  const handleLogoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onloadend = () => setCompanyLogo(reader.result as string);
    reader.readAsDataURL(file);
  };

  const handleCompanyNext = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!companyName.trim()) return;

    setSaving(true);
    await updateCompanySettings({
      ...companySettings,
      name: companyName.trim(),
      phone: companyPhone.trim(),
      address: companyAddress.trim(),
      logo: companyLogo,
    });
    setSaving(false);
    setStep('material');
  };

  const handleMaterialNext = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!skipMaterial) {
      if (!materialName.trim()) return;

      setSaving(true);
      const newMaterial: Material = {
        id: `mat_${Date.now()}`,
        name: materialName.trim(),
        defaultPrice: parseFloat(materialPrice) || 0,
        unit: materialUnit.trim() || 'Brass',
        isActive: true,
      };
      const existing = companySettings.materials ?? [];
      await updateCompanySettings({
        ...companySettings,
        materials: [...existing, newMaterial],
      });
      setSaving(false);
    }
    setStep('done');
  };

  const handleDone = () => {
    // Persist that the welcome screen has been completed so it never shows again.
    localStorage.setItem('crushtrack_welcome_seen', 'true');
    onDone();
  };

  const meta = STEP_META[step];

  return (
    <div className="h-screen bg-background flex flex-col overflow-hidden">
      {/* Hero header */}
      <div className="relative bg-primary-600 dark:bg-primary-700 px-6 pt-10 pb-16 flex flex-col items-center gap-3 text-center">
        <div
          aria-hidden="true"
          className="absolute inset-0 opacity-[0.07] pointer-events-none"
          style={{
            backgroundImage:
              "linear-gradient(to right, white 1px, transparent 1px), linear-gradient(to bottom, white 1px, transparent 1px)",
            backgroundSize: "32px 32px",
          }}
        />
        <div className="relative w-16 h-16 rounded-2xl overflow-hidden shadow-elev-md bg-white">
          <img src={logoSvg} alt="CrushTrack logo" className="w-full h-full object-cover" />
        </div>
        <div className="relative">
          <p className="text-primary-100/80 text-[11px] font-semibold uppercase tracking-[0.18em] mb-1">Welcome to CrushTrack</p>
          <h1 className="text-2xl font-display font-bold text-white tracking-tight">Let&apos;s get you set up</h1>
          <p className="text-primary-100 text-sm mt-1">Just 2 quick steps, then you&apos;re ready to go.</p>
        </div>

        {/* Step indicators */}
        <div className="relative flex items-center gap-2 mt-3" role="progressbar" aria-valuenow={currentIndex + 1} aria-valuemin={1} aria-valuemax={3}>
          {['company', 'material', 'done'].map((s, i) => (
            <React.Fragment key={s}>
              <div
                className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold transition-all ${
                  s === step
                    ? 'bg-white text-primary-600 shadow-elev-sm scale-110'
                    : currentIndex > i
                    ? 'bg-primary-400 text-white'
                    : 'bg-white/20 text-primary-100'
                }`}
              >
                {currentIndex > i ? '✓' : i + 1}
              </div>
              {i < 2 && (
                <div className={`w-8 h-0.5 rounded-full transition-all ${currentIndex > i ? 'bg-primary-300' : 'bg-white/20'}`} />
              )}
            </React.Fragment>
          ))}
        </div>
      </div>

      {/* Card */}
      <div className="flex-1 -mt-8 bg-surface rounded-t-3xl px-6 pt-6 pb-8 overflow-y-auto shadow-elev-lg">
        {/* Step header */}
        <div className="flex items-start gap-3 mb-6">
          <div className="w-11 h-11 rounded-2xl bg-primary-50 dark:bg-primary-500/10 text-primary-600 dark:text-primary-400 flex items-center justify-center shrink-0">
            {meta.icon}
          </div>
          <div>
            <h2 className="text-xl font-display font-bold text-foreground tracking-tight leading-tight">{meta.title}</h2>
            <p className="text-sm text-muted-foreground mt-1 leading-relaxed">{meta.subtitle}</p>
          </div>
        </div>

        {/* ── Step 1: Company ── */}
        {step === 'company' && (
          <form onSubmit={handleCompanyNext} className="space-y-4">
            {/* Logo picker */}
            <div>
              <label className="block text-xs font-semibold text-foreground tracking-wide mb-2">Company Logo (optional)</label>
              <div className="flex items-center gap-4">
                {companyLogo ? (
                  <div className="relative w-16 h-16 rounded-xl overflow-hidden border border-border bg-white">
                    <img src={companyLogo} alt="Logo" className="w-full h-full object-contain" />
                    <button
                      type="button"
                      aria-label="Remove logo"
                      onClick={() => setCompanyLogo(undefined)}
                      className="absolute top-0.5 right-0.5 w-5 h-5 bg-danger text-white rounded-full flex items-center justify-center hover:opacity-90"
                    >
                      <X className="w-3 h-3" />
                    </button>
                  </div>
                ) : (
                  <div className="w-16 h-16 rounded-xl border-2 border-dashed border-border-strong bg-surface-2 flex items-center justify-center">
                    <Building2 className="w-6 h-6 text-muted-foreground" />
                  </div>
                )}
                <label className="cursor-pointer inline-flex items-center gap-2 h-11 px-4 border border-border rounded-xl text-sm font-medium text-foreground bg-surface hover:bg-surface-2 transition-colors">
                  <Upload className="w-4 h-4" />
                  Upload Logo
                  <input type="file" accept="image/png,image/jpeg" className="hidden" onChange={handleLogoChange} />
                </label>
              </div>
            </div>

            <Field label="Company Name" id="wc-name" value={companyName} onChange={setCompanyName} placeholder="e.g. Sharma Stone Crusher" required />
            <Field label="Phone Number" id="wc-phone" value={companyPhone} onChange={setCompanyPhone} placeholder="e.g. 98765 43210" />
            <Field label="Address" id="wc-address" value={companyAddress} onChange={setCompanyAddress} placeholder="Village / Town, District, State" />

            <button
              type="submit"
              disabled={!companyName.trim() || saving}
              className="w-full h-12 bg-primary-600 hover:bg-primary-700 active:scale-[0.99] disabled:opacity-50 text-white text-sm font-semibold rounded-xl transition-all shadow-elev-sm flex items-center justify-center gap-2 mt-2"
            >
              {saving ? 'Saving…' : <>Continue <ArrowRight className="w-4 h-4" /></>}
            </button>
          </form>
        )}

        {/* ── Step 2: First Material ── */}
        {step === 'material' && (
          <form onSubmit={handleMaterialNext} className="space-y-4">
            {!skipMaterial && (
              <>
                <Field label="Material Name" id="wm-name" value={materialName} onChange={setMaterialName} placeholder="e.g. 20mm Aggregate, Stone Dust" required={!skipMaterial} />

                <div className="grid grid-cols-2 gap-3">
                  <Field label="Default Price (₹)" id="wm-price" type="number" value={materialPrice} onChange={setMaterialPrice} placeholder="e.g. 750" />
                  <div>
                    <label htmlFor="wm-unit" className="block text-xs font-semibold text-foreground tracking-wide mb-1.5">Unit</label>
                    <select
                      id="wm-unit"
                      value={materialUnit}
                      onChange={(e) => setMaterialUnit(e.target.value)}
                      className="w-full h-11 px-4 text-sm bg-surface-2 border border-border rounded-xl outline-none focus:border-primary-500 focus:ring-2 focus:ring-primary-500/20 text-foreground transition-colors"
                    >
                      {['Brass', 'Tonne', 'CFT', 'MT', 'Load'].map((u) => (
                        <option key={u} value={u}>{u}</option>
                      ))}
                    </select>
                  </div>
                </div>
              </>
            )}

            <button
              type="submit"
              disabled={(!skipMaterial && !materialName.trim()) || saving}
              className="w-full h-12 bg-primary-600 hover:bg-primary-700 active:scale-[0.99] disabled:opacity-50 text-white text-sm font-semibold rounded-xl transition-all shadow-elev-sm flex items-center justify-center gap-2"
            >
              {saving ? 'Saving…' : <>Continue <ArrowRight className="w-4 h-4" /></>}
            </button>

            {!skipMaterial && (
              <button
                type="button"
                onClick={() => { setSkipMaterial(true); setStep('done'); }}
                className="w-full h-10 text-sm text-muted-foreground hover:text-foreground transition-colors"
              >
                Skip for now — I&apos;ll add materials in Settings
              </button>
            )}
          </form>
        )}

        {/* ── Step 3: Done ── */}
        {step === 'done' && (
          <div className="flex flex-col items-center text-center gap-6 py-4">
            <div className="w-20 h-20 rounded-2xl bg-success-muted flex items-center justify-center">
              <CheckCircle2 className="w-10 h-10 text-success" />
            </div>

            <div className="space-y-2">
              <p className="text-muted-foreground text-sm leading-relaxed">
                Your company profile is saved. Head to <strong className="text-foreground">Dispatch</strong> to log your first slip, or explore <strong className="text-foreground">Settings</strong> to finish configuring your account.
              </p>
            </div>

            {/* Quick-action hints */}
            <div className="w-full grid grid-cols-1 gap-2 text-left">
              {[
                { label: 'Record a dispatch slip', hint: 'Dispatch page' },
                { label: 'Add your customers', hint: 'Customers page' },
                { label: 'Configure invoicing & print', hint: 'Settings → Invoicing' },
              ].map(({ label, hint }) => (
                <div key={label} className="flex items-center gap-3 p-3 bg-surface-2 rounded-xl border border-border">
                  <div className="w-8 h-8 rounded-lg bg-primary-50 dark:bg-primary-500/10 text-primary-600 dark:text-primary-400 flex items-center justify-center shrink-0">
                    <ArrowRight className="w-4 h-4" />
                  </div>
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-foreground truncate">{label}</p>
                    <p className="text-xs text-muted-foreground">{hint}</p>
                  </div>
                </div>
              ))}
            </div>

            <button
              onClick={handleDone}
              className="w-full h-12 bg-primary-600 hover:bg-primary-700 active:scale-[0.99] text-white text-sm font-semibold rounded-xl transition-all shadow-elev-sm flex items-center justify-center gap-2"
            >
              Open CrushTrack <ArrowRight className="w-4 h-4" />
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
