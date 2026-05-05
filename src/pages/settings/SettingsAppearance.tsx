import React from "react";
import { Save, Check, Sun, Moon, Monitor } from "lucide-react";
import { CompanySettings } from "../../types";

interface Props {
  localSettings: CompanySettings;
  setLocalSettings: (s: CompanySettings) => void;
  isSaved: boolean;
  onSave: () => void;
}

/** Color tokens matched to the global theme-* class swatches in index.css. */
const COLOR_OPTIONS = [
  { id: "emerald", label: "Emerald", swatch: "#10b981" },
  { id: "blue",    label: "Blue",    swatch: "#3b82f6" },
  { id: "violet",  label: "Violet",  swatch: "#8b5cf6" },
  { id: "rose",    label: "Rose",    swatch: "#f43f5e" },
  { id: "amber",   label: "Amber",   swatch: "#f59e0b" },
] as const;

const MODE_OPTIONS = [
  { id: "system", label: "System", icon: Monitor },
  { id: "light",  label: "Light",  icon: Sun },
  { id: "dark",   label: "Dark",   icon: Moon },
] as const;

export function SettingsAppearance({ localSettings, setLocalSettings, isSaved, onSave }: Props) {
  const upd = (patch: Partial<CompanySettings>) => setLocalSettings({ ...localSettings, ...patch });

  return (
    <div className="space-y-8">
      <div>
        <h3 className="text-xl font-display font-bold text-foreground tracking-tight">
          Theme &amp; Appearance
        </h3>
        <p className="text-sm text-muted-foreground mt-1">
          Customize how CrushTrack looks on this device.
        </p>
      </div>

      {/* ── Color Mode ── */}
      <div>
        <label className="block text-sm font-semibold text-foreground mb-3">Color Mode</label>
        <div className="grid grid-cols-3 gap-2 max-w-md">
          {MODE_OPTIONS.map(({ id, label, icon: Icon }) => {
            const isActive = (localSettings.theme ?? "system") === id;
            return (
              <button
                key={id}
                onClick={() => upd({ theme: id })}
                aria-pressed={isActive}
                className={`flex flex-col items-center gap-2 p-4 rounded-xl border transition-colors ${
                  isActive
                    ? "border-primary-600 bg-primary-50 dark:bg-primary-500/10 text-foreground"
                    : "border-border bg-surface text-muted-foreground hover:border-border-strong hover:text-foreground"
                }`}
              >
                <Icon className={`w-5 h-5 ${isActive ? "text-primary-600 dark:text-primary-400" : ""}`} />
                <span className="text-sm font-medium">{label}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* ── Primary Brand Color ── */}
      <div>
        <label className="block text-sm font-semibold text-foreground mb-3">Primary Brand Color</label>
        <p className="text-xs text-muted-foreground mb-3">
          Used for primary actions, focus rings, and key highlights.
        </p>
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-2 max-w-2xl">
          {COLOR_OPTIONS.map((color) => {
            const isActive = localSettings.primaryColor === color.id;
            return (
              <button
                key={color.id}
                onClick={() => upd({ primaryColor: color.id as CompanySettings["primaryColor"] })}
                aria-pressed={isActive}
                className={`relative flex items-center gap-2.5 px-3 py-2.5 rounded-xl border transition-colors ${
                  isActive
                    ? "border-foreground bg-surface-2 text-foreground"
                    : "border-border bg-surface text-muted-foreground hover:border-border-strong hover:text-foreground"
                }`}
              >
                <span
                  aria-hidden="true"
                  className="w-6 h-6 rounded-full ring-2 ring-surface shadow-elev-xs shrink-0"
                  style={{ backgroundColor: color.swatch }}
                />
                <span className="text-sm font-medium flex-1 text-left">{color.label}</span>
                {isActive && <Check className="w-4 h-4 text-foreground" strokeWidth={2.5} />}
              </button>
            );
          })}
        </div>
      </div>

      {/* ── Mobile layout density ── */}
      <div>
        <label className="block text-sm font-semibold text-foreground mb-3">Mobile Device Layout</label>
        <p className="text-xs text-muted-foreground mb-3 max-w-xl leading-relaxed">
          <b>Comfortable</b> uses spaced cards that are easier to tap. <b>Compact</b> forces table views for
          higher data density on small screens.
        </p>
        <div className="grid grid-cols-2 gap-2 max-w-md">
          {(["Comfortable", "Compact"] as const).map((layout) => {
            const isActive = (localSettings.mobileLayout || "Comfortable") === layout;
            return (
              <button
                key={layout}
                onClick={() => upd({ mobileLayout: layout })}
                aria-pressed={isActive}
                className={`px-4 py-3 rounded-xl border font-medium text-sm transition-colors ${
                  isActive
                    ? "border-primary-600 bg-primary-50 dark:bg-primary-500/10 text-foreground"
                    : "border-border bg-surface text-muted-foreground hover:border-border-strong hover:text-foreground"
                }`}
              >
                {layout}
              </button>
            );
          })}
        </div>
      </div>

      <div className="flex justify-end pt-4 border-t border-border">
        <button
          onClick={onSave}
          disabled={isSaved}
          className="flex items-center px-5 h-10 bg-primary-600 hover:bg-primary-700 text-white font-semibold text-sm rounded-lg transition-colors disabled:opacity-60"
        >
          {isSaved ? <Check className="w-4 h-4 mr-2" /> : <Save className="w-4 h-4 mr-2" />}
          {isSaved ? "Saved" : "Save Changes"}
        </button>
      </div>
    </div>
  );
}
