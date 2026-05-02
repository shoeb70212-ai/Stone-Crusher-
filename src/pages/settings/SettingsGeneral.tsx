import React from "react";
import { Save, Check, Download, Upload, Database, Trash2, Smartphone } from "lucide-react";
import { CompanySettings } from "../../types";
import type { DeviceSummary } from "../../lib/device-info";

interface Props {
  localSettings: CompanySettings;
  setLocalSettings: (s: CompanySettings) => void;
  isSaved: boolean;
  userRole: string;
  deviceInfo: DeviceSummary | null;
  fileInputRef: React.RefObject<HTMLInputElement | null>;
  onSave: () => void;
  onDownloadBackup: () => void;
  onRestoreBackup: (e: React.ChangeEvent<HTMLInputElement>) => void;
  onPurgeClick: () => void;
}

export function SettingsGeneral({
  localSettings, setLocalSettings, isSaved, userRole,
  deviceInfo, fileInputRef, onSave, onDownloadBackup, onRestoreBackup, onPurgeClick,
}: Props) {
  const upd = (patch: Partial<CompanySettings>) => setLocalSettings({ ...localSettings, ...patch });

  return (
    <div className="space-y-6">
      <h3 className="text-lg font-semibold text-zinc-900 dark:text-white">Company Information</h3>

      {/* Logo */}
      <div className="pb-0">
        <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-200 mb-2">Company Logo</label>
        <div className="flex items-center gap-4">
          {localSettings.logo ? (
            <div className="relative w-24 h-24 border rounded-xl overflow-hidden bg-white">
              <img src={localSettings.logo} alt="Company Logo" className="w-full h-full object-contain" />
              <button
                onClick={() => upd({ logo: undefined })}
                className="absolute top-1 right-1 w-6 h-6 flex items-center justify-center bg-rose-500 text-white rounded-full hover:bg-rose-600 shadow-sm"
              >
                &times;
              </button>
            </div>
          ) : (
            <div className="w-24 h-24 border-2 border-dashed border-zinc-300 dark:border-zinc-700 rounded-xl flex items-center justify-center bg-zinc-50 dark:bg-zinc-800/50">
              <span className="text-sm text-zinc-400">No Logo</span>
            </div>
          )}
          <label className="cursor-pointer px-4 py-2 border border-zinc-300 dark:border-zinc-600 rounded-lg hover:bg-zinc-50 dark:hover:bg-zinc-800 transition-colors text-sm font-medium text-zinc-700 dark:text-zinc-200">
            Upload Logo
            <input
              type="file"
              accept="image/png, image/jpeg"
              className="hidden"
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) {
                  const reader = new FileReader();
                  reader.onloadend = () => upd({ logo: reader.result as string });
                  reader.readAsDataURL(file);
                }
              }}
            />
          </label>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {[
          { label: "Company Name", key: "name" as const, type: "text" },
          { label: "Phone Number", key: "phone" as const, type: "text" },
        ].map(({ label, key, type }) => (
          <div key={key}>
            <label htmlFor={`settings-${key}`} className="block text-sm font-medium text-zinc-700 dark:text-zinc-200 mb-1">{label}</label>
            <input
              id={`settings-${key}`}
              type={type}
              value={(localSettings as any)[key] ?? ""}
              onChange={(e) => upd({ [key]: e.target.value } as any)}
              className="w-full border border-zinc-300 dark:border-zinc-600 rounded-lg px-4 py-2 focus:ring-2 focus:ring-primary-500 focus:border-primary-500 outline-none transition-shadow bg-transparent dark:text-white"
            />
          </div>
        ))}

        <div className="md:col-span-2">
          <label htmlFor="settings-address" className="block text-sm font-medium text-zinc-700 dark:text-zinc-200 mb-1">Address</label>
          <textarea
            id="settings-address"
            value={localSettings.address ?? ""}
            onChange={(e) => upd({ address: e.target.value })}
            rows={2}
            className="w-full border border-zinc-300 dark:border-zinc-600 rounded-lg px-4 py-2 focus:ring-2 focus:ring-primary-500 focus:border-primary-500 outline-none transition-shadow bg-transparent dark:text-white"
          />
        </div>

        {[
          { label: "GSTIN", key: "gstin" as const },
          { label: "Receipt Footer Message", key: "receiptFooter" as const },
        ].map(({ label, key }) => (
          <div key={key}>
            <label htmlFor={`settings-${key}`} className="block text-sm font-medium text-zinc-700 dark:text-zinc-200 mb-1">{label}</label>
            <input
              id={`settings-${key}`}
              type="text"
              value={(localSettings as any)[key] ?? ""}
              onChange={(e) => upd({ [key]: e.target.value } as any)}
              className="w-full border border-zinc-300 dark:border-zinc-600 rounded-lg px-4 py-2 focus:ring-2 focus:ring-primary-500 focus:border-primary-500 outline-none transition-shadow bg-transparent dark:text-white"
            />
          </div>
        ))}

        <div>
          <label htmlFor="settings-invoiceFormat" className="block text-sm font-medium text-zinc-700 dark:text-zinc-200 mb-1">Invoice Dimensions / Format</label>
          <select
            id="settings-invoiceFormat"
            value={localSettings.invoiceFormat || "A4"}
            onChange={(e) => upd({ invoiceFormat: e.target.value as any })}
            className="w-full border border-zinc-300 dark:border-zinc-600 rounded-lg px-4 py-2 focus:ring-2 focus:ring-primary-500 outline-none transition-shadow bg-transparent dark:text-white"
          >
            <option value="A4">A4 Size (Standard)</option>
            <option value="Thermal-80mm">Thermal Receipt (80mm)</option>
            <option value="Thermal-58mm">Thermal Receipt (58mm)</option>
          </select>
        </div>

        <div className="md:col-span-2 pt-4 border-t border-zinc-100 dark:border-zinc-700">
          <h4 className="text-md font-semibold text-zinc-800 dark:text-zinc-200 mb-4">Bank Details (For Invoicing)</h4>
        </div>
        {[
          { label: "Bank Name", key: "bankName" as const },
          { label: "Account Number", key: "accountNumber" as const },
          { label: "IFSC Code", key: "ifscCode" as const },
          { label: "Branch Name", key: "branchName" as const },
        ].map(({ label, key }) => (
          <div key={key}>
            <label htmlFor={`settings-${key}`} className="block text-sm font-medium text-zinc-700 dark:text-zinc-200 mb-1">{label}</label>
            <input
              id={`settings-${key}`}
              type="text"
              value={(localSettings as any)[key] ?? ""}
              onChange={(e) => upd({ [key]: e.target.value } as any)}
              className="w-full border border-zinc-300 dark:border-zinc-600 rounded-lg px-4 py-2 focus:ring-2 focus:ring-primary-500 outline-none transition-shadow bg-transparent dark:text-white"
            />
          </div>
        ))}
      </div>

      <h4 className="text-md font-semibold text-zinc-900 dark:text-white mt-8 mb-4 border-b border-zinc-100 dark:border-zinc-700 pb-2">Print Settings</h4>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <label htmlFor="settings-slipFormat" className="block text-sm font-medium text-zinc-700 dark:text-zinc-200 mb-1">Dispatch Slip Format</label>
          <select
            id="settings-slipFormat"
            value={localSettings.slipFormat || "A4"}
            onChange={(e) => upd({ slipFormat: e.target.value as any })}
            className="w-full border border-zinc-300 dark:border-zinc-600 rounded-lg px-4 py-2 focus:ring-2 focus:ring-primary-500 outline-none transition-shadow bg-white dark:bg-zinc-800 dark:text-white"
          >
            <option value="A4">A4 Size</option>
            <option value="Thermal-80mm">Thermal - 80mm</option>
            <option value="Thermal-58mm">Thermal - 58mm</option>
          </select>
          <p className="mt-1 text-xs text-zinc-500">Select the default print format for dispatch slips.</p>
        </div>
      </div>

      <h4 className="text-md font-semibold text-zinc-900 dark:text-white mt-8 mb-4 border-b border-zinc-100 dark:border-zinc-700 pb-2">Database Management</h4>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="p-4 border border-zinc-200 dark:border-zinc-700 rounded-xl bg-zinc-50 dark:bg-zinc-800/50">
          <div className="flex items-center gap-3 mb-2">
            <div className="w-8 h-8 rounded-full bg-blue-100 text-blue-600 dark:bg-blue-900/30 dark:text-blue-400 flex items-center justify-center">
              <Download className="w-4 h-4" />
            </div>
            <h5 className="font-semibold text-zinc-900 dark:text-white">Backup Database</h5>
          </div>
          <p className="text-sm text-zinc-500 dark:text-zinc-400 mb-4">Download a complete JSON backup of all your data.</p>
          <button onClick={onDownloadBackup} className="px-4 py-2 bg-white dark:bg-zinc-800 border border-zinc-300 dark:border-zinc-600 text-sm font-medium rounded-lg hover:bg-zinc-50 dark:hover:bg-zinc-700 transition-colors w-full flex justify-center items-center gap-2">
            <Download className="w-4 h-4" /> Download Backup
          </button>
        </div>
        <div className="p-4 border border-rose-200 dark:border-rose-900/50 rounded-xl bg-rose-50/50 dark:bg-rose-900/10">
          <div className="flex items-center gap-3 mb-2">
            <div className="w-8 h-8 rounded-full bg-rose-100 text-rose-600 dark:bg-rose-900/30 dark:text-rose-400 flex items-center justify-center">
              <Database className="w-4 h-4" />
            </div>
            <h5 className="font-semibold text-rose-900 dark:text-rose-400">Restore Database</h5>
          </div>
          <p className="text-sm text-rose-600 dark:text-rose-400/80 mb-4">Upload a previously saved JSON backup. This will overwrite all current data.</p>
          <input type="file" accept=".json" ref={fileInputRef} className="hidden" onChange={onRestoreBackup} />
          <button onClick={() => fileInputRef.current?.click()} className="px-4 py-2 bg-rose-600 hover:bg-rose-700 text-white text-sm font-medium rounded-lg transition-colors w-full flex justify-center items-center gap-2">
            <Upload className="w-4 h-4" /> Restore Backup
          </button>
        </div>
        {userRole === "Admin" && (
          <div className="p-4 border border-red-200 dark:border-red-900/50 rounded-xl bg-red-50/50 dark:bg-red-900/10 md:col-span-2">
            <div className="flex items-center gap-3 mb-2">
              <div className="w-8 h-8 rounded-full bg-red-100 text-red-600 dark:bg-red-900/30 dark:text-red-400 flex items-center justify-center">
                <Trash2 className="w-4 h-4" />
              </div>
              <h5 className="font-semibold text-red-900 dark:text-red-400">Administrative Cleanup</h5>
            </div>
            <p className="text-sm text-red-600 dark:text-red-400/80 mb-4">Permanently delete all inactive records. This action cannot be undone.</p>
            <button onClick={onPurgeClick} className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white text-sm font-medium rounded-lg transition-colors w-full sm:w-auto flex justify-center items-center gap-2">
              <Trash2 className="w-4 h-4" /> Purge Inactive Records
            </button>
          </div>
        )}
      </div>

      {userRole === "Admin" && deviceInfo && (
        <>
          <h4 className="text-md font-semibold text-zinc-900 dark:text-white mt-8 mb-4 border-b border-zinc-100 dark:border-zinc-700 pb-2">Device Information</h4>
          <div className="p-4 border border-zinc-200 dark:border-zinc-700 rounded-xl bg-zinc-50 dark:bg-zinc-800/50">
            <div className="flex items-center gap-3 mb-3">
              <div className="w-8 h-8 rounded-full bg-zinc-100 text-zinc-600 dark:bg-zinc-700 dark:text-zinc-400 flex items-center justify-center">
                <Smartphone className="w-4 h-4" />
              </div>
              <h5 className="font-semibold text-zinc-900 dark:text-white">This Device</h5>
            </div>
            <dl className="grid grid-cols-2 gap-x-4 gap-y-2 text-sm">
              {[
                { label: "Platform", value: deviceInfo.platform },
                { label: "OS Version", value: deviceInfo.osVersion },
                { label: "Manufacturer", value: deviceInfo.manufacturer },
                { label: "Model", value: deviceInfo.model },
              ].map(({ label, value }) => (
                <div key={label}>
                  <dt className="text-xs text-zinc-500 dark:text-zinc-400">{label}</dt>
                  <dd className="font-medium text-zinc-800 dark:text-zinc-200 truncate">{value}</dd>
                </div>
              ))}
              <div className="col-span-2">
                <dt className="text-xs text-zinc-500 dark:text-zinc-400">Device ID</dt>
                <dd className="font-mono text-xs text-zinc-700 dark:text-zinc-300 break-all select-all">{deviceInfo.id}</dd>
              </div>
            </dl>
          </div>
        </>
      )}

      <div className="flex justify-end pt-4 border-t border-zinc-100 dark:border-zinc-700">
        <button onClick={onSave} disabled={isSaved} className="flex items-center px-6 py-2 bg-primary-600 hover:bg-primary-700 text-white font-medium rounded-lg transition-colors disabled:bg-primary-400">
          {isSaved ? <Check className="w-5 h-5 mr-2" /> : <Save className="w-5 h-5 mr-2" />}
          {isSaved ? "Saved!" : "Save Changes"}
        </button>
      </div>
    </div>
  );
}
