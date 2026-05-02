import React from "react";
import { Save, Check } from "lucide-react";
import { CompanySettings } from "../../types";

interface Props {
  localSettings: CompanySettings;
  setLocalSettings: (s: CompanySettings) => void;
  isSaved: boolean;
  onSave: () => void;
}

const COLOR_OPTIONS = [
  { id: "emerald", label: "Emerald", colorClass: "bg-[#10b981]" },
  { id: "blue",    label: "Blue",    colorClass: "bg-[#3b82f6]" },
  { id: "violet",  label: "Violet",  colorClass: "bg-[#8b5cf6]" },
  { id: "rose",    label: "Rose",    colorClass: "bg-[#f43f5e]" },
  { id: "amber",   label: "Amber",   colorClass: "bg-[#f59e0b]" },
] as const;

export function SettingsAppearance({ localSettings, setLocalSettings, isSaved, onSave }: Props) {
  const upd = (patch: Partial<CompanySettings>) => setLocalSettings({ ...localSettings, ...patch });

  return (
    <div className="space-y-8">
      <h3 className="text-lg font-semibold text-zinc-900 dark:text-white">Theme & Appearance</h3>

      <div>
        <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-3">Color Mode</label>
        <div className="flex gap-4">
          {(["system", "light", "dark"] as const).map((mode) => (
            <button
              key={mode}
              onClick={() => upd({ theme: mode })}
              className={`px-4 py-2 rounded-lg border-2 capitalize font-medium transition-colors ${
                localSettings.theme === mode
                  ? "border-primary-500 bg-primary-50 text-primary-700 dark:bg-primary-900/30 dark:text-primary-300"
                  : "border-zinc-200 dark:border-zinc-700 text-zinc-600 dark:text-zinc-300 hover:border-zinc-300 dark:hover:border-zinc-600"
              }`}
            >
              {mode}
            </button>
          ))}
        </div>
      </div>

      <div>
        <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-3">Primary Brand Color</label>
        <div className="flex gap-4 flex-wrap">
          {COLOR_OPTIONS.map((color) => (
            <button
              key={color.id}
              onClick={() => upd({ primaryColor: color.id as any })}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg border-2 font-medium transition-colors ${
                localSettings.primaryColor === color.id
                  ? "border-zinc-900 dark:border-white bg-zinc-50 dark:bg-zinc-800 text-zinc-900 dark:text-white"
                  : "border-zinc-200 dark:border-zinc-700 text-zinc-600 dark:text-zinc-400 hover:border-zinc-300 dark:hover:border-zinc-600"
              }`}
            >
              <div className={`w-4 h-4 rounded-full ${color.colorClass}`} />
              {color.label}
            </button>
          ))}
        </div>
      </div>

      <div>
        <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-3">Mobile Device Layout</label>
        <p className="text-xs text-zinc-500 dark:text-zinc-400 mb-4 max-w-xl">
          "Comfortable" uses spaced-out cards (easier to tap). "Compact" forces table views for higher data density.
        </p>
        <div className="flex gap-4">
          {(["Comfortable", "Compact"] as const).map((layout) => (
            <button
              key={layout}
              onClick={() => upd({ mobileLayout: layout })}
              className={`px-4 py-2 rounded-lg border-2 font-medium transition-colors ${
                (localSettings.mobileLayout || "Comfortable") === layout
                  ? "border-primary-500 bg-primary-50 text-primary-700 dark:bg-primary-900/30 dark:text-primary-300"
                  : "border-zinc-200 dark:border-zinc-700 text-zinc-600 dark:text-zinc-300 hover:border-zinc-300 dark:hover:border-zinc-600"
              }`}
            >
              {layout}
            </button>
          ))}
        </div>
      </div>

      <div className="flex justify-end pt-4 border-t border-zinc-100 dark:border-zinc-700">
        <button onClick={onSave} disabled={isSaved} className="flex items-center px-6 py-2 bg-primary-600 hover:bg-primary-700 text-white font-medium rounded-lg transition-colors disabled:bg-primary-400">
          {isSaved ? <Check className="w-5 h-5 mr-2" /> : <Save className="w-5 h-5 mr-2" />}
          {isSaved ? "Saved!" : "Save Changes"}
        </button>
      </div>
    </div>
  );
}
