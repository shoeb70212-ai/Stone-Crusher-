import React from "react";
import { Save, Check } from "lucide-react";
import { CompanySettings } from "../../types";

interface Props {
  localSettings: CompanySettings;
  setLocalSettings: (s: CompanySettings) => void;
  isSaved: boolean;
  onSave: () => void;
}

export function SettingsMaterials({ localSettings, setLocalSettings, isSaved, onSave }: Props) {
  const upd = (materials: CompanySettings["materials"]) =>
    setLocalSettings({ ...localSettings, materials });

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h3 className="text-lg font-semibold text-zinc-900 dark:text-white">Materials & Pricing</h3>
        <button
          onClick={() => {
            const newMats = [...(localSettings.materials || [])];
            newMats.push({ id: crypto.randomUUID(), name: "New Material", defaultPrice: 0, unit: "Ton", hsnCode: "", gstRate: 5 });
            upd(newMats);
          }}
          className="text-sm font-medium text-primary-600 hover:text-primary-700 bg-primary-50 dark:bg-primary-900/30 dark:text-primary-400 px-4 py-2 rounded-lg transition-colors"
        >
          + Add Material
        </button>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="bg-zinc-50 dark:bg-zinc-900/50 border-y border-zinc-200 dark:border-zinc-700">
              {["Material Name", "Default Price (₹)", "Unit", "HSN Code", "GST Rate (%)", "Status", "Actions"].map((h) => (
                <th key={h} className="py-3 px-4 text-sm font-semibold text-zinc-600 dark:text-zinc-300 last:text-right">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800">
            {(localSettings.materials || []).map((material) => (
              <tr key={material.id} className="hover:bg-zinc-50 dark:hover:bg-zinc-800/50">
                <td className="py-3 px-4">
                  <input type="text" value={material.name}
                    onChange={(e) => upd((localSettings.materials || []).map((m) => m.id === material.id ? { ...m, name: e.target.value } : m))}
                    className="w-full bg-transparent border-b border-transparent focus:border-primary-500 outline-none text-zinc-900 dark:text-white font-medium"
                  />
                </td>
                <td className="py-3 px-4">
                  <input type="number" value={material.defaultPrice}
                    onChange={(e) => upd((localSettings.materials || []).map((m) => m.id === material.id ? { ...m, defaultPrice: Number(e.target.value) } : m))}
                    className="w-24 border border-zinc-300 dark:border-zinc-600 bg-white dark:bg-zinc-900 rounded px-2 py-1 text-sm outline-none focus:border-primary-500 text-zinc-900 dark:text-white"
                  />
                </td>
                <td className="py-3 px-4">
                  <select value={material.unit}
                    onChange={(e) => upd((localSettings.materials || []).map((m) => m.id === material.id ? { ...m, unit: e.target.value } : m))}
                    className="border border-zinc-300 dark:border-zinc-600 rounded px-2 py-1 text-sm bg-white dark:bg-zinc-900 outline-none focus:border-primary-500 text-zinc-900 dark:text-white"
                  >
                    <option>Ton</option><option>Brass</option><option>Kg</option><option>Nos</option>
                  </select>
                </td>
                <td className="py-3 px-4">
                  <input type="text" value={material.hsnCode}
                    onChange={(e) => upd((localSettings.materials || []).map((m) => m.id === material.id ? { ...m, hsnCode: e.target.value } : m))}
                    className="w-24 border border-zinc-300 dark:border-zinc-600 bg-white dark:bg-zinc-900 rounded px-2 py-1 text-sm outline-none focus:border-primary-500 text-zinc-900 dark:text-white"
                  />
                </td>
                <td className="py-3 px-4">
                  <input type="number" value={material.gstRate}
                    onChange={(e) => upd((localSettings.materials || []).map((m) => m.id === material.id ? { ...m, gstRate: Number(e.target.value) } : m))}
                    className="w-16 border border-zinc-300 dark:border-zinc-600 bg-white dark:bg-zinc-900 rounded px-2 py-1 text-sm outline-none focus:border-primary-500 text-zinc-900 dark:text-white"
                  />
                </td>
                <td className="py-3 px-4">
                  <span className={`px-2 py-1 rounded-full text-xs font-medium ${material.isActive !== false ? "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400" : "bg-zinc-100 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-400"}`}>
                    {material.isActive !== false ? "Active" : "Inactive"}
                  </span>
                </td>
                <td className="py-3 px-4 text-right">
                  <button
                    onClick={() => upd((localSettings.materials || []).map((m) => m.id === material.id ? { ...m, isActive: m.isActive === false } : m))}
                    className={`${material.isActive !== false ? "text-rose-600 hover:text-rose-900 dark:text-rose-400" : "text-emerald-600 hover:text-emerald-900 dark:text-emerald-400"} text-sm font-medium`}
                  >
                    {material.isActive !== false ? "Deactivate" : "Activate"}
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
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
