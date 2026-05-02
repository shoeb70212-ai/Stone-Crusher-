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
      <label htmlFor={id} className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-1">
        {label}{required && <span className="text-rose-500 ml-0.5">*</span>}
      </label>
      <input
        id={id}
        type={type}
        required={required}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="w-full px-4 py-2.5 text-sm bg-zinc-100 dark:bg-zinc-800 rounded-xl outline-none focus:ring-2 focus:ring-primary-500 text-zinc-900 dark:text-white placeholder:text-zinc-400 transition-all"
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
    <div className="h-screen bg-zinc-50 dark:bg-zinc-900 flex flex-col overflow-hidden">
      {/* Hero header */}
      <div className="bg-linear-to-br from-primary-600 via-primary-600 to-primary-700 px-6 pt-10 pb-16 flex flex-col items-center gap-3 text-center">
        <div className="w-16 h-16 rounded-2xl overflow-hidden shadow-lg bg-white">
          <img src={logoSvg} alt="CrushTrack logo" className="w-full h-full object-cover" />
        </div>
        <div>
          <p className="text-primary-200 text-xs font-medium uppercase tracking-widest mb-1">Welcome to CrushTrack</p>
          <h1 className="text-2xl font-bold text-white">Let's get you set up</h1>
          <p className="text-primary-100 text-sm mt-1">Just 2 quick steps, then you're ready to go.</p>
        </div>

        {/* Step indicators */}
        <div className="flex items-center gap-2 mt-3">
          {['company', 'material', 'done'].map((s, i) => (
            <React.Fragment key={s}>
              <div
                className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold transition-all ${
                  s === step
                    ? 'bg-white text-primary-600 shadow-md scale-110'
                    : currentIndex > i
                    ? 'bg-primary-400 text-white'
                    : 'bg-primary-500/40 text-primary-200'
                }`}
              >
                {currentIndex > i ? '✓' : i + 1}
              </div>
              {i < 2 && (
                <div className={`w-8 h-0.5 rounded-full transition-all ${currentIndex > i ? 'bg-primary-300' : 'bg-primary-500/40'}`} />
              )}
            </React.Fragment>
          ))}
        </div>
      </div>

      {/* Card */}
      <div className="flex-1 -mt-8 bg-white dark:bg-zinc-900 rounded-t-3xl px-6 pt-6 pb-8 overflow-y-auto">
        {/* Step header */}
        <div className="flex items-start gap-3 mb-6">
          <div className="w-10 h-10 rounded-2xl bg-primary-100 dark:bg-primary-900/30 text-primary-600 dark:text-primary-400 flex items-center justify-center shrink-0">
            {meta.icon}
          </div>
          <div>
            <h2 className="text-lg font-bold text-zinc-900 dark:text-white leading-tight">{meta.title}</h2>
            <p className="text-sm text-zinc-500 dark:text-zinc-400 mt-0.5">{meta.subtitle}</p>
          </div>
        </div>

        {/* ── Step 1: Company ── */}
        {step === 'company' && (
          <form onSubmit={handleCompanyNext} className="space-y-4">
            {/* Logo picker */}
            <div>
              <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-2">Company Logo (optional)</label>
              <div className="flex items-center gap-4">
                {companyLogo ? (
                  <div className="relative w-16 h-16 rounded-xl overflow-hidden border border-zinc-200 dark:border-zinc-700 bg-white">
                    <img src={companyLogo} alt="Logo" className="w-full h-full object-contain" />
                    <button
                      type="button"
                      onClick={() => setCompanyLogo(undefined)}
                      className="absolute top-0.5 right-0.5 w-5 h-5 bg-rose-500 text-white rounded-full flex items-center justify-center hover:bg-rose-600"
                    >
                      <X className="w-3 h-3" />
                    </button>
                  </div>
                ) : (
                  <div className="w-16 h-16 rounded-xl border-2 border-dashed border-zinc-300 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-800 flex items-center justify-center">
                    <Building2 className="w-6 h-6 text-zinc-300 dark:text-zinc-600" />
                  </div>
                )}
                <label className="cursor-pointer flex items-center gap-2 px-3 py-2 border border-zinc-300 dark:border-zinc-600 rounded-lg text-sm font-medium text-zinc-700 dark:text-zinc-300 hover:bg-zinc-50 dark:hover:bg-zinc-800 transition-colors">
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
              className="w-full h-12 bg-primary-600 hover:bg-primary-700 disabled:opacity-50 text-white font-semibold rounded-2xl transition-colors flex items-center justify-center gap-2 mt-2"
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
                    <label htmlFor="wm-unit" className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-1">Unit</label>
                    <select
                      id="wm-unit"
                      value={materialUnit}
                      onChange={(e) => setMaterialUnit(e.target.value)}
                      className="w-full px-4 py-2.5 text-sm bg-zinc-100 dark:bg-zinc-800 rounded-xl outline-none focus:ring-2 focus:ring-primary-500 text-zinc-900 dark:text-white transition-all"
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
              className="w-full h-12 bg-primary-600 hover:bg-primary-700 disabled:opacity-50 text-white font-semibold rounded-2xl transition-colors flex items-center justify-center gap-2"
            >
              {saving ? 'Saving…' : <>Continue <ArrowRight className="w-4 h-4" /></>}
            </button>

            {!skipMaterial && (
              <button
                type="button"
                onClick={() => { setSkipMaterial(true); setStep('done'); }}
                className="w-full h-10 text-sm text-zinc-500 dark:text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200 transition-colors"
              >
                Skip for now — I'll add materials in Settings
              </button>
            )}
          </form>
        )}

        {/* ── Step 3: Done ── */}
        {step === 'done' && (
          <div className="flex flex-col items-center text-center gap-6 py-4">
            <div className="w-20 h-20 rounded-full bg-emerald-100 dark:bg-emerald-900/30 flex items-center justify-center">
              <CheckCircle2 className="w-10 h-10 text-emerald-500" />
            </div>

            <div className="space-y-2">
              <p className="text-zinc-600 dark:text-zinc-400 text-sm leading-relaxed">
                Your company profile is saved. Head to <strong className="text-zinc-800 dark:text-zinc-200">Dispatch</strong> to log your first slip, or explore <strong className="text-zinc-800 dark:text-zinc-200">Settings</strong> to finish configuring your account.
              </p>
            </div>

            {/* Quick-action hints */}
            <div className="w-full grid grid-cols-1 gap-2 text-left">
              {[
                { icon: '📋', label: 'Record a dispatch slip', hint: 'Dispatch page' },
                { icon: '👥', label: 'Add your customers', hint: 'Customers page' },
                { icon: '⚙️', label: 'Configure invoicing & print', hint: 'Settings → Invoicing' },
              ].map(({ icon, label, hint }) => (
                <div key={label} className="flex items-center gap-3 p-3 bg-zinc-50 dark:bg-zinc-800 rounded-xl">
                  <span className="text-xl">{icon}</span>
                  <div>
                    <p className="text-sm font-medium text-zinc-800 dark:text-zinc-200">{label}</p>
                    <p className="text-xs text-zinc-500 dark:text-zinc-400">{hint}</p>
                  </div>
                </div>
              ))}
            </div>

            <button
              onClick={handleDone}
              className="w-full h-12 bg-primary-600 hover:bg-primary-700 text-white font-semibold rounded-2xl transition-colors flex items-center justify-center gap-2"
            >
              Open CrushTrack <ArrowRight className="w-4 h-4" />
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
