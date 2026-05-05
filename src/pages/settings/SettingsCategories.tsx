import React from "react";
import { Save, Check } from "lucide-react";
import { CompanySettings } from "../../types";

interface Props {
  localSettings: CompanySettings;
  setLocalSettings: (s: CompanySettings) => void;
  isSaved: boolean;
  onSave: () => void;
}

export function SettingsCategories({ localSettings, setLocalSettings, isSaved, onSave }: Props) {
  return (
    <div className="space-y-6">
      <h3 className="text-lg font-semibold text-zinc-900 dark:text-white">Manage Expense Categories</h3>
      <p className="text-sm text-zinc-500 dark:text-zinc-400">
        Define the categories available when logging expenses in the Daybook or Ledger.
      </p>
      <div className="space-y-3 max-w-md">
        {(localSettings.expenseCategories || []).map((cat, idx) => (
          <div key={idx} className="flex gap-2">
            <input
              type="text"
              value={cat}
              onChange={(e) => {
                const newCat = [...(localSettings.expenseCategories || [])];
                newCat[idx] = e.target.value;
                setLocalSettings({ ...localSettings, expenseCategories: newCat });
              }}
              className="flex-1 w-full border border-zinc-300 dark:border-zinc-600 rounded-lg px-4 py-2 focus:ring-2 focus:ring-primary-500 focus:border-primary-500 outline-none transition-shadow bg-transparent dark:text-white"
            />
            <button
              onClick={() => {
                const newCat = (localSettings.expenseCategories || []).filter((_, i) => i !== idx);
                setLocalSettings({ ...localSettings, expenseCategories: newCat });
              }}
              className="px-3 py-2 text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-500/10 rounded-lg transition-colors"
            >
              Remove
            </button>
          </div>
        ))}
        <button
          onClick={() =>
            setLocalSettings({
              ...localSettings,
              expenseCategories: [...(localSettings.expenseCategories || []), ""],
            })
          }
          className="text-sm font-medium text-primary-600 hover:text-primary-700 bg-primary-50 dark:bg-primary-500/10 dark:text-primary-400 px-4 py-2 rounded-lg transition-colors w-full"
        >
          + Add Category
        </button>
      </div>

      <h3 className="text-lg font-semibold text-zinc-900 dark:text-white mt-8 mb-4 border-b border-zinc-100 dark:border-zinc-700 pb-2">Manage Employee Roles</h3>
      <p className="text-sm text-zinc-500 dark:text-zinc-400">
        Define the roles available when creating or editing employees.
      </p>
      <div className="space-y-3 max-w-md">
        {(localSettings.employeeRoles || []).map((role, idx) => (
          <div key={idx} className="flex gap-2">
            <input
              type="text"
              value={role}
              onChange={(e) => {
                const newRoles = [...(localSettings.employeeRoles || [])];
                newRoles[idx] = e.target.value;
                setLocalSettings({ ...localSettings, employeeRoles: newRoles });
              }}
              className="flex-1 w-full border border-zinc-300 dark:border-zinc-600 rounded-lg px-4 py-2 focus:ring-2 focus:ring-primary-500 focus:border-primary-500 outline-none transition-shadow bg-transparent dark:text-white"
            />
            <button
              onClick={() => {
                const newRoles = (localSettings.employeeRoles || []).filter((_, i) => i !== idx);
                setLocalSettings({ ...localSettings, employeeRoles: newRoles });
              }}
              className="px-3 py-2 text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-500/10 rounded-lg transition-colors"
            >
              Remove
            </button>
          </div>
        ))}
        <button
          onClick={() =>
            setLocalSettings({
              ...localSettings,
              employeeRoles: [...(localSettings.employeeRoles || []), ""],
            })
          }
          className="text-sm font-medium text-primary-600 hover:text-primary-700 bg-primary-50 dark:bg-primary-500/10 dark:text-primary-400 px-4 py-2 rounded-lg transition-colors w-full"
        >
          + Add Role
        </button>
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
