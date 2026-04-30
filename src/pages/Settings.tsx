import React, { useState, useEffect } from "react";
import { useErp } from "../context/ErpContext";
import { Building2, Users, Receipt, Save, Check, Palette, X, Mail, Download, Upload, Database, Trash2, Smartphone } from "lucide-react";
import { hashPassword } from "../lib/auth";
import { ConfirmationModal } from "../components/ui/ConfirmationModal";
import { useToast } from "../components/ui/Toast";
import { getDeviceSummary, type DeviceSummary } from "../lib/device-info";

export function Settings() {
  const { userRole, companySettings, updateCompanySettings, purgeInactiveRecords } = useErp();
  const { addToast } = useToast();
  const [activeTab, setActiveTab] = useState<"general" | "categories" | "users" | "materials" | "appearance" | "invoicing">(
    "general",
  );
  const [isSaved, setIsSaved] = useState(false);
  
  const [isInviteModalOpen, setIsInviteModalOpen] = useState(false);
  const [inviteFormData, setInviteFormData] = useState({ name: "", email: "", role: "Partner", password: "" });
  const fileInputRef = React.useRef<HTMLInputElement>(null);
  const pendingRestoreFileRef = React.useRef<string | null>(null);
  const [isRestoreConfirmOpen, setIsRestoreConfirmOpen] = useState(false);
  const [isPurgeConfirmOpen, setIsPurgeConfirmOpen] = useState(false);
  const [deviceInfo, setDeviceInfo] = useState<DeviceSummary | null>(null);

  // Load device summary once when the general tab is first shown
  useEffect(() => {
    if (activeTab === 'general' && !deviceInfo) {
      getDeviceSummary().then(setDeviceInfo);
    }
  }, [activeTab, deviceInfo]);

  const handleDownloadBackup = async () => {
    try {
      const API_URL = import.meta.env.VITE_API_URL || "";
      const res = await fetch(`${API_URL}/api/data`);
      if (!res.ok) throw new Error('Failed to fetch');
      const data = await res.json();
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `crushtrack-backup-${new Date().toISOString().split('T')[0]}.json`;
      link.click();
      URL.revokeObjectURL(url);
    } catch (err) {
      addToast('error', 'Failed to download backup.');
    }
  };

  const REQUIRED_BACKUP_KEYS = ['customers', 'slips', 'transactions', 'vehicles', 'invoices', 'tasks', 'companySettings'];

  const handleRestoreBackup = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const content = event.target?.result as string;
        const data = JSON.parse(content);

        if (!data || typeof data !== 'object' || Array.isArray(data)) {
          addToast('error', 'Invalid backup file: payload must be a JSON object.');
          if (fileInputRef.current) fileInputRef.current.value = '';
          return;
        }
        const missing = REQUIRED_BACKUP_KEYS.filter((k) => !(k in data));
        if (missing.length > 0) {
          addToast('error', `Invalid backup file: missing required keys: ${missing.join(', ')}.`);
          if (fileInputRef.current) fileInputRef.current.value = '';
          return;
        }

        pendingRestoreFileRef.current = content;
        setIsRestoreConfirmOpen(true);
      } catch {
        addToast('error', 'Invalid backup file — could not parse JSON.');
        if (fileInputRef.current) fileInputRef.current.value = '';
      }
    };
    reader.readAsText(file);
  };

  const confirmRestore = async () => {
    setIsRestoreConfirmOpen(false);
    const content = pendingRestoreFileRef.current;
    pendingRestoreFileRef.current = null;
    if (fileInputRef.current) fileInputRef.current.value = '';
    if (!content) return;

    try {
      const data = JSON.parse(content);
      const API_URL = import.meta.env.VITE_API_URL || "";
      const res = await fetch(`${API_URL}/api/data`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });
      if (res.ok) {
        addToast('success', 'Backup restored successfully! Reloading…');
        setTimeout(() => window.location.reload(), 1200);
      } else {
        const err = await res.json().catch(() => ({}));
        addToast('error', `Failed to restore backup: ${err.error || 'Server error'}`);
      }
    } catch {
      addToast('error', 'Failed to restore backup.');
    }
  };

  // Local state for editing to prevent immediate context updates until save
  const [localSettings, setLocalSettings] = useState({
    ...companySettings,
    theme: companySettings.theme || "system",
    primaryColor: companySettings.primaryColor || "emerald",
  });

  // Update local settings if context changes from outside
  React.useEffect(() => {
    setLocalSettings({
      ...companySettings,
      theme: companySettings.theme || "system",
      primaryColor: companySettings.primaryColor || "emerald",
    });
  }, [companySettings]);



  const handleSave = () => {
    updateCompanySettings(localSettings);
    setIsSaved(true);
    setTimeout(() => setIsSaved(false), 2000);
  };

  const handleInviteUser = async (e: React.FormEvent) => {
    e.preventDefault();
    if (inviteFormData.password.length < 6) {
      addToast('error', 'Password must be at least 6 characters.');
      return;
    }
    const passwordHash = await hashPassword(inviteFormData.password);
    const role = inviteFormData.role as "Admin" | "Partner" | "Manager";
    const newUsers = [...(localSettings.users || [])];
    newUsers.push({
      id: crypto.randomUUID(),
      name: inviteFormData.name,
      email: inviteFormData.email,
      passwordHash,
      role,
      status: "Active",
    });
    const updated = { ...localSettings, users: newUsers };
    setLocalSettings(updated);
    updateCompanySettings(updated);
    setIsInviteModalOpen(false);
    setInviteFormData({ name: "", email: "", role: "Partner", password: "" });
  };

  return (
    <>
    <div className="space-y-6 max-w-5xl">
      <div>
        <h2 className="text-xl md:text-2xl font-bold font-display text-zinc-900 dark:text-white tracking-tight">
          Settings
        </h2>
        <p className="text-zinc-500 dark:text-zinc-400 mt-1">
          Manage system configurations, users, and masters.
        </p>
      </div>

      <div className="flex space-x-1 border-b border-zinc-200 dark:border-zinc-700 overflow-x-auto hide-scrollbar">
        <button
          onClick={() => setActiveTab("general")}
          className={`flex items-center px-4 py-3 text-sm font-medium border-b-2 transition-colors ${
            activeTab === "general"
              ? "border-primary-500 text-primary-600"
              : "border-transparent text-zinc-500 dark:text-zinc-400 hover:text-zinc-700 dark:text-zinc-200 hover:border-zinc-300 dark:border-zinc-600"
          }`}
        >
          <Building2 className="w-4 h-4 mr-2" />
          General Info
        </button>
        <button
          onClick={() => setActiveTab("categories")}
          className={`flex items-center px-4 py-3 text-sm font-medium border-b-2 transition-colors whitespace-nowrap ${
            activeTab === "categories"
              ? "border-primary-500 text-primary-600 dark:text-primary-400"
              : "border-transparent text-zinc-500 dark:text-zinc-400 hover:text-zinc-700 dark:text-zinc-200 dark:hover:text-zinc-200 hover:border-zinc-300 dark:border-zinc-600"
          }`}
        >
          <Receipt className="w-4 h-4 mr-2" />
          Expense Categories
        </button>
        <button
          onClick={() => setActiveTab("users")}
          className={`flex items-center px-4 py-3 text-sm font-medium border-b-2 transition-colors ${
            activeTab === "users"
              ? "border-primary-500 text-primary-600"
              : "border-transparent text-zinc-500 dark:text-zinc-400 hover:text-zinc-700 dark:text-zinc-200 hover:border-zinc-300 dark:border-zinc-600"
          }`}
        >
          <Users className="w-4 h-4 mr-2" />
          Users & Roles
        </button>
        <button
          onClick={() => setActiveTab("materials")}
          className={`flex items-center px-4 py-3 text-sm font-medium border-b-2 transition-colors ${
            activeTab === "materials"
              ? "border-primary-500 text-primary-600 dark:text-primary-400"
              : "border-transparent text-zinc-500 dark:text-zinc-400 hover:text-zinc-700 dark:text-zinc-200 dark:hover:text-zinc-200 hover:border-zinc-300 dark:border-zinc-600"
          }`}
        >
          <Receipt className="w-4 h-4 mr-2" />
          Materials Master
        </button>
        <button
          onClick={() => setActiveTab("appearance")}
          className={`flex items-center px-4 py-3 text-sm font-medium border-b-2 transition-colors ${
            activeTab === "appearance"
              ? "border-primary-500 text-primary-600 dark:text-primary-400"
              : "border-transparent text-zinc-500 dark:text-zinc-400 hover:text-zinc-700 dark:text-zinc-200 dark:hover:text-zinc-200 hover:border-zinc-300 dark:border-zinc-600"
          }`}
        >
          <Palette className="w-4 h-4 mr-2" />
          Appearance
        </button>

        <button
          onClick={() => setActiveTab("invoicing")}
          className={`flex items-center px-4 py-3 text-sm font-medium border-b-2 transition-colors ${
            activeTab === "invoicing"
              ? "border-primary-500 text-primary-600 dark:text-primary-400"
              : "border-transparent text-zinc-500 dark:text-zinc-400 hover:text-zinc-700 dark:text-zinc-200 dark:hover:text-zinc-200 hover:border-zinc-300 dark:border-zinc-600"
          }`}
        >
          <Receipt className="w-4 h-4 mr-2" />
          Invoicing
        </button>
      </div>

      <div className="bg-white dark:bg-zinc-800 rounded-2xl shadow-sm border border-zinc-100 dark:border-zinc-700 p-3 md:p-5">
        {activeTab === "categories" && (
          <div className="space-y-6">
            <h3 className="text-lg font-semibold text-zinc-900 dark:text-white">
              Manage Expense Categories
            </h3>
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
                    className="flex-1 w-full border border-zinc-300 dark:border-zinc-600 rounded-lg px-4 py-2 focus:ring-2 focus:ring-primary-500 focus:border-primary-500 outline-none transition-shadow bg-transparent"
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
                onClick={() => {
                  setLocalSettings({
                    ...localSettings,
                    expenseCategories: [...(localSettings.expenseCategories || []), ""],
                  });
                }}
                className="text-sm font-medium text-primary-600 hover:text-primary-700 bg-primary-50 dark:bg-primary-500/10 dark:text-primary-400 px-4 py-2 rounded-lg transition-colors w-full"
              >
                + Add Category
              </button>
            </div>
            <div className="flex justify-end pt-4 border-t border-zinc-100 dark:border-zinc-700">
              <button
                onClick={handleSave}
                disabled={isSaved}
                className="flex items-center px-6 py-2 bg-primary-600 hover:bg-primary-700 text-white font-medium rounded-lg transition-colors disabled:bg-primary-400"
              >
                {isSaved ? <Check className="w-5 h-5 mr-2" /> : <Save className="w-5 h-5 mr-2" />}
                {isSaved ? "Saved!" : "Save Changes"}
              </button>
            </div>
          </div>
        )}
        {activeTab === "appearance" && (
          <div className="space-y-8">
            <h3 className="text-lg font-semibold text-zinc-900 dark:text-white">
              Theme & Appearance
            </h3>
            
            <div>
              <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-3">
                Color Mode
              </label>
              <div className="flex gap-4">
                {(["system", "light", "dark"] as const).map((mode) => (
                  <button
                    key={mode}
                    onClick={() => setLocalSettings({...localSettings, theme: mode})}
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
              <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-3">
                Primary Brand Color
              </label>
              <div className="flex gap-4 flex-wrap">
                {[
                  { id: "emerald", label: "Emerald", colorClass: "bg-[#10b981]" },
                  { id: "blue", label: "Blue", colorClass: "bg-[#3b82f6]" },
                  { id: "violet", label: "Violet", colorClass: "bg-[#8b5cf6]" },
                  { id: "rose", label: "Rose", colorClass: "bg-[#f43f5e]" },
                  { id: "amber", label: "Amber", colorClass: "bg-[#f59e0b]" },
                ].map((color) => (
                  <button
                    key={color.id}
                    onClick={() => setLocalSettings({...localSettings, primaryColor: color.id as any})}
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
              <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-3">
                Mobile Device Layout
              </label>
              <p className="text-xs text-zinc-500 dark:text-zinc-400 mb-4 max-w-xl">
                Choose how data is displayed on small screens. "Comfortable" uses spaced-out cards (easier to tap), while "Compact" forces table views with horizontal scrolling (see more data at once without vertical scrolling).
              </p>
              <div className="flex gap-4">
                {(["Comfortable", "Compact"] as const).map((layout) => (
                  <button
                    key={layout}
                    onClick={() => setLocalSettings({...localSettings, mobileLayout: layout})}
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
              <button
                onClick={handleSave}
                disabled={isSaved}
                className="flex items-center px-6 py-2 bg-primary-600 hover:bg-primary-700 text-white font-medium rounded-lg transition-colors disabled:bg-primary-400"
              >
                {isSaved ? (
                  <Check className="w-5 h-5 mr-2" />
                ) : (
                  <Save className="w-5 h-5 mr-2" />
                )}
                {isSaved ? "Saved!" : "Save Changes"}
              </button>
            </div>
          </div>
        )}
        {activeTab === "general" && (
          <div className="space-y-6">
            <h3 className="text-lg font-semibold text-zinc-900 dark:text-white">
              Company Information
            </h3>
            
            <div className="pb-0">
               <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-200 mb-2">Company Logo</label>
               <div className="flex items-center gap-4">
                  {localSettings.logo ? (
                     <div className="relative w-24 h-24 border rounded-xl overflow-hidden bg-white">
                        <img src={localSettings.logo} alt="Company Logo" className="w-full h-full object-contain" />
                        <button 
                           onClick={() => setLocalSettings({ ...localSettings, logo: undefined })}
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
                              reader.onloadend = () => {
                                 setLocalSettings({ ...localSettings, logo: reader.result as string });
                              };
                              reader.readAsDataURL(file);
                           }
                        }}
                     />
                  </label>
               </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-200 mb-1">
                  Company Name
                </label>
                <input
                  type="text"
                  value={localSettings.name}
                  onChange={(e) =>
                    setLocalSettings({
                      ...localSettings,
                      name: e.target.value,
                    })
                  }
                  className="w-full border border-zinc-300 dark:border-zinc-600 rounded-lg px-4 py-2 focus:ring-2 focus:ring-primary-500 focus:border-primary-500 outline-none transition-shadow"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-200 mb-1">
                  Phone Number
                </label>
                <input
                  type="text"
                  value={localSettings.phone}
                  onChange={(e) =>
                    setLocalSettings({
                      ...localSettings,
                      phone: e.target.value,
                    })
                  }
                  className="w-full border border-zinc-300 dark:border-zinc-600 rounded-lg px-4 py-2 focus:ring-2 focus:ring-primary-500 focus:border-primary-500 outline-none transition-shadow"
                />
              </div>
              <div className="md:col-span-2">
                <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-200 mb-1">
                  Address
                </label>
                <textarea
                  value={localSettings.address}
                  onChange={(e) =>
                    setLocalSettings({
                      ...localSettings,
                      address: e.target.value,
                    })
                  }
                  rows={2}
                  className="w-full border border-zinc-300 dark:border-zinc-600 rounded-lg px-4 py-2 focus:ring-2 focus:ring-primary-500 focus:border-primary-500 outline-none transition-shadow"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-200 mb-1">
                  GSTIN
                </label>
                <input
                  type="text"
                  value={localSettings.gstin}
                  onChange={(e) =>
                    setLocalSettings({
                      ...localSettings,
                      gstin: e.target.value,
                    })
                  }
                  className="w-full border border-zinc-300 dark:border-zinc-600 rounded-lg px-4 py-2 focus:ring-2 focus:ring-primary-500 focus:border-primary-500 outline-none transition-shadow"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-200 mb-1">
                  Receipt Footer Message
                </label>
                <input
                  type="text"
                  value={localSettings.receiptFooter}
                  onChange={(e) =>
                    setLocalSettings({
                      ...localSettings,
                      receiptFooter: e.target.value,
                    })
                  }
                  className="w-full border border-zinc-300 dark:border-zinc-600 rounded-lg px-4 py-2 focus:ring-2 focus:ring-primary-500 focus:border-primary-500 outline-none transition-shadow"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-200 mb-1">
                  Invoice Dimensions / Format
                </label>
                <select
                  value={localSettings.invoiceFormat || "A4"}
                  onChange={(e) =>
                    setLocalSettings({
                      ...localSettings,
                      invoiceFormat: e.target.value as "A4" | "Thermal-80mm" | "Thermal-58mm",
                    })
                  }
                  className="w-full border border-zinc-300 dark:border-zinc-600 rounded-lg px-4 py-2 focus:ring-2 focus:ring-primary-500 focus:border-primary-500 outline-none transition-shadow"
                >
                  <option value="A4">A4 Size (Standard)</option>
                  <option value="Thermal-80mm">Thermal Receipt (80mm)</option>
                  <option value="Thermal-58mm">Thermal Receipt (58mm)</option>
                </select>
              </div>
              
              <div className="md:col-span-2 pt-4 border-t border-zinc-100 dark:border-zinc-700">
                <h4 className="text-md font-semibold text-zinc-800 dark:text-zinc-200 mb-4">Bank Details (For Invoicing)</h4>
              </div>
              <div>
                <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-200 mb-1">
                  Bank Name
                </label>
                <input
                  type="text"
                  value={localSettings.bankName || ""}
                  onChange={(e) =>
                    setLocalSettings({ ...localSettings, bankName: e.target.value })
                  }
                  className="w-full border border-zinc-300 dark:border-zinc-600 rounded-lg px-4 py-2 focus:ring-2 focus:ring-primary-500 focus:border-primary-500 outline-none transition-shadow"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-200 mb-1">
                  Account Number
                </label>
                <input
                  type="text"
                  value={localSettings.accountNumber || ""}
                  onChange={(e) =>
                    setLocalSettings({ ...localSettings, accountNumber: e.target.value })
                  }
                  className="w-full border border-zinc-300 dark:border-zinc-600 rounded-lg px-4 py-2 focus:ring-2 focus:ring-primary-500 focus:border-primary-500 outline-none transition-shadow"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-200 mb-1">
                  IFSC Code
                </label>
                <input
                  type="text"
                  value={localSettings.ifscCode || ""}
                  onChange={(e) =>
                    setLocalSettings({ ...localSettings, ifscCode: e.target.value })
                  }
                  className="w-full border border-zinc-300 dark:border-zinc-600 rounded-lg px-4 py-2 focus:ring-2 focus:ring-primary-500 focus:border-primary-500 outline-none transition-shadow"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-200 mb-1">
                  Branch Name
                </label>
                <input
                  type="text"
                  value={localSettings.branchName || ""}
                  onChange={(e) =>
                    setLocalSettings({ ...localSettings, branchName: e.target.value })
                  }
                  className="w-full border border-zinc-300 dark:border-zinc-600 rounded-lg px-4 py-2 focus:ring-2 focus:ring-primary-500 focus:border-primary-500 outline-none transition-shadow"
                />
              </div>
            </div>

            <h4 className="text-md font-semibold text-zinc-900 dark:text-white mt-8 mb-4 border-b border-zinc-100 dark:border-zinc-700 pb-2">
              Print Settings
            </h4>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-200 mb-1">
                  Dispatch Slip Format
                </label>
                <select
                  value={localSettings.slipFormat || "A4"}
                  onChange={(e) =>
                    setLocalSettings({
                      ...localSettings,
                      slipFormat: e.target.value as any,
                    })
                  }
                  className="w-full border border-zinc-300 dark:border-zinc-600 rounded-lg px-4 py-2 focus:ring-2 focus:ring-primary-500 focus:border-primary-500 outline-none transition-shadow bg-white dark:bg-zinc-800"
                >
                  <option value="A4">A4 Size</option>
                  <option value="Thermal-80mm">Thermal - 80mm</option>
                  <option value="Thermal-58mm">Thermal - 58mm</option>
                </select>
                <p className="mt-1 text-xs text-zinc-500">
                  Select the default print format for dispatch slips depending on your printer type.
                </p>
              </div>
            </div>

            <h4 className="text-md font-semibold text-zinc-900 dark:text-white mt-8 mb-4 border-b border-zinc-100 dark:border-zinc-700 pb-2">
              Database Management
            </h4>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="p-4 border border-zinc-200 dark:border-zinc-700 rounded-xl bg-zinc-50 dark:bg-zinc-800/50">
                <div className="flex items-center gap-3 mb-2">
                  <div className="w-8 h-8 rounded-full bg-blue-100 text-blue-600 dark:bg-blue-900/30 dark:text-blue-400 flex items-center justify-center">
                    <Download className="w-4 h-4" />
                  </div>
                  <h5 className="font-semibold text-zinc-900 dark:text-white">Backup Database</h5>
                </div>
                <p className="text-sm text-zinc-500 dark:text-zinc-400 mb-4">
                  Download a complete JSON backup of all your customers, vehicles, slips, and settings.
                </p>
                <button
                  onClick={handleDownloadBackup}
                  className="px-4 py-2 bg-white dark:bg-zinc-800 border border-zinc-300 dark:border-zinc-600 text-sm font-medium rounded-lg hover:bg-zinc-50 dark:hover:bg-zinc-700 transition-colors w-full flex justify-center items-center gap-2"
                >
                  <Download className="w-4 h-4" />
                  Download Backup
                </button>
              </div>

              <div className="p-4 border border-rose-200 dark:border-rose-900/50 rounded-xl bg-rose-50/50 dark:bg-rose-900/10">
                <div className="flex items-center gap-3 mb-2">
                  <div className="w-8 h-8 rounded-full bg-rose-100 text-rose-600 dark:bg-rose-900/30 dark:text-rose-400 flex items-center justify-center">
                    <Database className="w-4 h-4" />
                  </div>
                  <h5 className="font-semibold text-rose-900 dark:text-rose-400">Restore Database</h5>
                </div>
                <p className="text-sm text-rose-600 dark:text-rose-400/80 mb-4">
                  Upload a previously saved JSON backup. This will overwrite all current data.
                </p>
                <input 
                  type="file" 
                  accept=".json" 
                  ref={fileInputRef}
                  className="hidden" 
                  onChange={handleRestoreBackup} 
                />
                <button
                  onClick={() => fileInputRef.current?.click()}
                  className="px-4 py-2 bg-rose-600 hover:bg-rose-700 text-white text-sm font-medium rounded-lg transition-colors w-full flex justify-center items-center gap-2"
                >
                  <Upload className="w-4 h-4" />
                  Restore Backup
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
                  <p className="text-sm text-red-600 dark:text-red-400/80 mb-4">
                    Permanently delete all inactive (soft-deleted) customers and vehicles from the database. This action cannot be undone.
                  </p>
                  <button
                    onClick={() => setIsPurgeConfirmOpen(true)}
                    className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white text-sm font-medium rounded-lg transition-colors w-full sm:w-auto flex justify-center items-center gap-2"
                  >
                    <Trash2 className="w-4 h-4" />
                    Purge Inactive Records
                  </button>
                </div>
              )}
            </div>

            {userRole === "Admin" && deviceInfo && (
              <>
                <h4 className="text-md font-semibold text-zinc-900 dark:text-white mt-8 mb-4 border-b border-zinc-100 dark:border-zinc-700 pb-2">
                  Device Information
                </h4>
                <div className="p-4 border border-zinc-200 dark:border-zinc-700 rounded-xl bg-zinc-50 dark:bg-zinc-800/50">
                  <div className="flex items-center gap-3 mb-3">
                    <div className="w-8 h-8 rounded-full bg-zinc-100 text-zinc-600 dark:bg-zinc-700 dark:text-zinc-400 flex items-center justify-center">
                      <Smartphone className="w-4 h-4" />
                    </div>
                    <h5 className="font-semibold text-zinc-900 dark:text-white">This Device</h5>
                  </div>
                  <dl className="grid grid-cols-2 gap-x-4 gap-y-2 text-sm">
                    {[
                      { label: 'Platform', value: deviceInfo.platform },
                      { label: 'OS Version', value: deviceInfo.osVersion },
                      { label: 'Manufacturer', value: deviceInfo.manufacturer },
                      { label: 'Model', value: deviceInfo.model },
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
              <button
                onClick={handleSave}
                disabled={isSaved}
                className="flex items-center px-6 py-2 bg-primary-600 hover:bg-primary-700 text-white font-medium rounded-lg transition-colors disabled:bg-primary-400"
              >
                {isSaved ? (
                  <Check className="w-5 h-5 mr-2" />
                ) : (
                  <Save className="w-5 h-5 mr-2" />
                )}
                {isSaved ? "Saved!" : "Save Changes"}
              </button>
            </div>
          </div>
        )}

        {activeTab === "users" && (
          <div className="space-y-6">
            <div className="flex justify-between items-center">
              <h3 className="text-lg font-semibold text-zinc-900 dark:text-white">
                User Roles & Permissions
              </h3>
              <button 
                onClick={() => setIsInviteModalOpen(true)}
                className="text-sm font-medium text-primary-600 hover:text-primary-700 bg-primary-50 px-4 py-2 rounded-lg transition-colors flex items-center"
              >
                <Mail className="w-4 h-4 mr-2" />
                Invite User
              </button>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-zinc-50 dark:bg-zinc-900/50 border-y border-zinc-200 dark:border-zinc-700">
                    <th className="py-3 px-4 text-sm font-semibold text-zinc-600 dark:text-zinc-300">
                      Name
                    </th>
                    <th className="py-3 px-4 text-sm font-semibold text-zinc-600 dark:text-zinc-300">
                      Email
                    </th>
                    <th className="py-3 px-4 text-sm font-semibold text-zinc-600 dark:text-zinc-300">
                      Role
                    </th>
                    <th className="py-3 px-4 text-sm font-semibold text-zinc-600 dark:text-zinc-300">
                      Status
                    </th>
                    <th className="py-3 px-4 text-sm font-semibold text-zinc-600 dark:text-zinc-300 text-right">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800">
                  {(localSettings.users || []).map((user) => (
                    <tr key={user.id} className="hover:bg-zinc-50 dark:hover:bg-zinc-800/50">
                      <td className="py-3 px-4">
                        <input
                          type="text"
                          value={user.name}
                          onChange={(e) => {
                            const newUsers = (localSettings.users || []).map((u) =>
                              u.id === user.id ? { ...u, name: e.target.value } : u
                            );
                            setLocalSettings({ ...localSettings, users: newUsers });
                          }}
                          className="w-full bg-transparent border-b border-transparent focus:border-primary-500 outline-none text-zinc-900 dark:text-white"
                        />
                      </td>
                      <td className="py-3 px-4">
                        <input
                          type="email"
                          value={user.email}
                          onChange={(e) => {
                            const newUsers = (localSettings.users || []).map((u) =>
                              u.id === user.id ? { ...u, email: e.target.value } : u
                            );
                            setLocalSettings({ ...localSettings, users: newUsers });
                          }}
                          className="w-full bg-transparent border-b border-transparent focus:border-primary-500 outline-none text-zinc-500 dark:text-zinc-400"
                        />
                      </td>
                      <td className="py-3 px-4">
                        <select
                          className="border border-zinc-300 dark:border-zinc-600 rounded px-2 py-1 text-sm bg-white dark:bg-zinc-800 outline-none focus:border-primary-500 dark:text-white"
                          value={user.role}
                          onChange={(e) => {
                            const newUsers = (localSettings.users || []).map((u) =>
                              u.id === user.id
                                ? { ...u, role: e.target.value as any }
                                : u,
                            );
                            setLocalSettings({...localSettings, users: newUsers});
                          }}
                        >
                          <option value="Admin">Admin</option>
                          <option value="Manager">Manager</option>
                          <option value="Partner">Partner</option>
                        </select>
                      </td>
                      <td className="py-3 px-4">
                        <select
                          className={`inline-flex items-center border border-transparent rounded px-2 py-1 text-xs font-medium outline-none focus:border-primary-500 ${user.status === "Active" ? "bg-primary-100 text-primary-800 dark:bg-primary-900/30 dark:text-primary-300" : "bg-zinc-100 dark:bg-zinc-800 text-zinc-800 dark:text-zinc-200"}`}
                          value={user.status}
                          onChange={(e) => {
                            const newUsers = (localSettings.users || []).map((u) =>
                              u.id === user.id ? { ...u, status: e.target.value as any } : u
                            );
                            setLocalSettings({ ...localSettings, users: newUsers });
                          }}
                        >
                          <option value="Active">Active</option>
                          <option value="Inactive">Inactive</option>
                        </select>
                      </td>
                      <td className="py-3 px-4 text-right">
                        <button 
                          onClick={() => {
                            const newUsers = (localSettings.users || []).filter((u) => u.id !== user.id);
                            setLocalSettings({ ...localSettings, users: newUsers });
                          }}
                          className="text-rose-600 hover:text-rose-900 dark:text-rose-400 dark:hover:text-rose-300 text-sm font-medium"
                        >
                          Remove
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="flex justify-end pt-4 border-t border-zinc-100 dark:border-zinc-700">
              <button
                onClick={handleSave}
                disabled={isSaved}
                className="flex items-center px-6 py-2 bg-primary-600 hover:bg-primary-700 text-white font-medium rounded-lg transition-colors disabled:bg-primary-400"
              >
                {isSaved ? (
                  <Check className="w-5 h-5 mr-2" />
                ) : (
                  <Save className="w-5 h-5 mr-2" />
                )}
                {isSaved ? "Saved!" : "Save Changes"}
              </button>
            </div>
          </div>
        )}

        {activeTab === "materials" && (
          <div className="space-y-6">
            <div className="flex justify-between items-center">
              <h3 className="text-lg font-semibold text-zinc-900 dark:text-white">
                Materials & Pricing
              </h3>
              <button 
                onClick={() => {
                  const newMats = [...(localSettings.materials || [])];
                  newMats.push({
                    id: crypto.randomUUID(),
                    name: "New Material",
                    defaultPrice: 0,
                    unit: "Ton",
                    hsnCode: "",
                    gstRate: 5
                  });
                  setLocalSettings({ ...localSettings, materials: newMats });
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
                    <th className="py-3 px-4 text-sm font-semibold text-zinc-600 dark:text-zinc-300">
                      Material Name
                    </th>
                    <th className="py-3 px-4 text-sm font-semibold text-zinc-600 dark:text-zinc-300">
                      Default Price (₹)
                    </th>
                    <th className="py-3 px-4 text-sm font-semibold text-zinc-600 dark:text-zinc-300">
                      Unit
                    </th>
                    <th className="py-3 px-4 text-sm font-semibold text-zinc-600 dark:text-zinc-300">
                      HSN Code
                    </th>
                    <th className="py-3 px-4 text-sm font-semibold text-zinc-600 dark:text-zinc-300">
                      GST Rate (%)
                    </th>
                    <th className="py-3 px-4 text-sm font-semibold text-zinc-600 dark:text-zinc-300">
                      Status
                    </th>
                    <th className="py-3 px-4 text-sm font-semibold text-zinc-600 dark:text-zinc-300 text-right">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800">
                  {(localSettings.materials || []).map((material) => (
                    <tr key={material.id} className="hover:bg-zinc-50 dark:hover:bg-zinc-800/50">
                      <td className="py-3 px-4">
                        <input
                          type="text"
                          value={material.name}
                          onChange={(e) => {
                            const newMats = (localSettings.materials || []).map((m) =>
                              m.id === material.id
                                ? { ...m, name: e.target.value }
                                : m,
                            );
                            setLocalSettings({ ...localSettings, materials: newMats });
                          }}
                          className="w-full bg-transparent border-b border-transparent focus:border-primary-500 outline-none text-zinc-900 dark:text-white font-medium"
                        />
                      </td>
                      <td className="py-3 px-4">
                        <input
                          type="number"
                          value={material.defaultPrice}
                          onChange={(e) => {
                            const newMats = (localSettings.materials || []).map((m) =>
                              m.id === material.id
                                ? { ...m, defaultPrice: Number(e.target.value) }
                                : m,
                            );
                            setLocalSettings({...localSettings, materials: newMats});
                          }}
                          className="w-24 border border-zinc-300 dark:border-zinc-600 bg-white dark:bg-zinc-900 rounded px-2 py-1 text-sm outline-none focus:border-primary-500 text-zinc-900 dark:text-white"
                        />
                      </td>
                      <td className="py-3 px-4 text-zinc-500 dark:text-zinc-400">
                        <select
                          className="border border-zinc-300 dark:border-zinc-600 rounded px-2 py-1 text-sm bg-white dark:bg-zinc-900 outline-none focus:border-primary-500 text-zinc-900 dark:text-white"
                          value={material.unit}
                          onChange={(e) => {
                            const newMats = (localSettings.materials || []).map((m) =>
                              m.id === material.id ? { ...m, unit: e.target.value } : m
                            );
                            setLocalSettings({ ...localSettings, materials: newMats });
                          }}
                        >
                          <option value="Ton">Ton</option>
                          <option value="Brass">Brass</option>
                          <option value="Kg">Kg</option>
                          <option value="Nos">Nos</option>
                        </select>
                      </td>
                      <td className="py-3 px-4">
                        <input
                          type="text"
                          value={material.hsnCode}
                          onChange={(e) => {
                            const newMats = (localSettings.materials || []).map((m) =>
                              m.id === material.id
                                ? { ...m, hsnCode: e.target.value }
                                : m,
                            );
                            setLocalSettings({...localSettings, materials: newMats});
                          }}
                          className="w-24 border border-zinc-300 dark:border-zinc-600 bg-white dark:bg-zinc-900 rounded px-2 py-1 text-sm outline-none focus:border-primary-500 text-zinc-900 dark:text-white"
                        />
                      </td>
                      <td className="py-3 px-4">
                        <input
                          type="number"
                          value={material.gstRate}
                          onChange={(e) => {
                            const newMats = (localSettings.materials || []).map((m) =>
                              m.id === material.id
                                ? { ...m, gstRate: Number(e.target.value) }
                                : m,
                            );
                            setLocalSettings({...localSettings, materials: newMats});
                          }}
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
                          onClick={() => {
                            const newMats = (localSettings.materials || []).map(m => 
                              m.id === material.id ? { ...m, isActive: m.isActive === false } : m
                            );
                            setLocalSettings({ ...localSettings, materials: newMats });
                          }}
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
              <button
                onClick={handleSave}
                disabled={isSaved}
                className="flex items-center px-6 py-2 bg-primary-600 hover:bg-primary-700 text-white font-medium rounded-lg transition-colors disabled:bg-primary-400"
              >
                {isSaved ? (
                  <Check className="w-5 h-5 mr-2" />
                ) : (
                  <Save className="w-5 h-5 mr-2" />
                )}
                {isSaved ? "Saved!" : "Save Changes"}
              </button>
            </div>
          </div>
        )}
        {activeTab === "invoicing" && (
          <div className="space-y-6">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-lg font-semibold text-zinc-900 dark:text-white">
                Invoicing Configuration
              </h3>
              <button
                onClick={handleSave}
                className="bg-primary-600 hover:bg-primary-700 text-white px-4 py-2 rounded-lg font-medium flex items-center transition-colors"
              >
                {isSaved ? (
                  <Check className="w-5 h-5 mr-2" />
                ) : (
                  <Save className="w-5 h-5 mr-2" />
                )}
                {isSaved ? "Saved" : "Save Changes"}
              </button>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-200 mb-1">
                  Show Due Date on Invoice
                </label>
                <select
                  value={localSettings.invoiceShowDueDate ? "true" : "false"}
                  onChange={(e) =>
                    setLocalSettings({ ...localSettings, invoiceShowDueDate: e.target.value === "true" })
                  }
                  className="w-full border border-zinc-300 dark:border-zinc-600 rounded-lg px-4 py-2 focus:ring-2 focus:ring-primary-500 focus:border-primary-500 outline-none transition-shadow bg-transparent"
                >
                  <option value="true">Yes</option>
                  <option value="false">No</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-200 mb-1">
                  Invoice Watermark Type
                </label>
                <select
                  value={localSettings.invoiceWatermark || "None"}
                  onChange={(e) =>
                    setLocalSettings({
                      ...localSettings,
                      invoiceWatermark: e.target.value as any,
                    })
                  }
                  className="w-full border border-zinc-300 dark:border-zinc-600 rounded-lg px-4 py-2 focus:ring-2 focus:ring-primary-500 focus:border-primary-500 outline-none transition-shadow bg-transparent"
                >
                  <option value="None">None</option>
                  <option value="Company Name">Company Name</option>
                  <option value="Status">Invoice Status (e.g. PENDING)</option>
                  <option value="Custom">Custom Text</option>
                </select>
              </div>

              {localSettings.invoiceWatermark === "Custom" && (
                <div>
                  <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-200 mb-1">
                    Custom Watermark Text
                  </label>
                  <input
                    type="text"
                    value={localSettings.invoiceWatermarkText || ""}
                    onChange={(e) =>
                      setLocalSettings({ ...localSettings, invoiceWatermarkText: e.target.value })
                    }
                    placeholder="Enter watermark text"
                    className="w-full border border-zinc-300 dark:border-zinc-600 rounded-lg px-4 py-2 focus:ring-2 focus:ring-primary-500 focus:border-primary-500 outline-none transition-shadow bg-transparent"
                  />
                </div>
              )}

              <div>
                <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-200 mb-1">
                  Invoice Theme Color
                </label>
                <div className="flex items-center space-x-3">
                  <input
                    type="color"
                    value={localSettings.invoiceColor || "#000000"}
                    onChange={(e) =>
                      setLocalSettings({ ...localSettings, invoiceColor: e.target.value })
                    }
                    className="w-10 h-10 rounded cursor-pointer border-0 p-0 bg-transparent"
                  />
                  <span className="text-sm text-zinc-500 dark:text-zinc-400 font-mono">
                    {localSettings.invoiceColor || "#000000"}
                  </span>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-200 mb-1">
                  Invoice Template
                </label>
                <select
                  value={localSettings.invoiceTemplate || "Classic"}
                  onChange={(e) =>
                    setLocalSettings({
                      ...localSettings,
                      invoiceTemplate: e.target.value as any,
                    })
                  }
                  className="w-full border border-zinc-300 dark:border-zinc-600 rounded-lg px-4 py-2 focus:ring-2 focus:ring-primary-500 focus:border-primary-500 outline-none transition-shadow bg-transparent"
                >
                  <option value="Classic">Classic</option>
                  <option value="Modern">Modern</option>
                  <option value="Minimal">Minimal</option>
                </select>
                <p className="mt-1 text-xs text-zinc-500">
                  Choose the aesthetic design for PDF generation.
                </p>
              </div>
            </div>
            
            <div className="mt-6 border-t border-zinc-200 dark:border-zinc-700 pt-6">
              <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-200 mb-2">
                Terms and Conditions
              </label>
              <textarea
                value={localSettings.termsAndConditions || ""}
                onChange={(e) =>
                  setLocalSettings({ ...localSettings, termsAndConditions: e.target.value })
                }
                rows={5}
                placeholder="Enter the terms and conditions to be printed on the invoice (one per line)..."
                className="w-full border border-zinc-300 dark:border-zinc-600 rounded-lg px-4 py-2 focus:ring-2 focus:ring-primary-500 focus:border-primary-500 outline-none transition-shadow bg-transparent resize-y"
              />
              <p className="mt-2 text-xs text-zinc-500">
                These terms will be displayed at the bottom of the A4 Tax Invoice.
              </p>
            </div>
          </div>
        )}
      </div>
    </div>

      {/* Invite User Modal */}
      {isInviteModalOpen && (
        <div className="fixed inset-0 bg-zinc-900/50 flex items-center justify-center p-4 z-50">
          <div className="bg-white dark:bg-zinc-800 rounded-2xl w-full max-w-md shadow-xl overflow-hidden">
            <div className="px-6 py-4 border-b border-zinc-100 dark:border-zinc-700 flex justify-between items-center bg-zinc-50 dark:bg-zinc-900/50">
              <h3 className="text-lg font-bold text-zinc-900 dark:text-white flex items-center gap-2">
                <Mail className="w-5 h-5 text-primary-600" />
                Invite Team Member
              </h3>
              <button
                onClick={() => setIsInviteModalOpen(false)}
                className="text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-300"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            
            <form onSubmit={handleInviteUser} className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-200 mb-1">
                  Full Name
                </label>
                <input
                  required
                  type="text"
                  value={inviteFormData.name}
                  onChange={(e) => setInviteFormData({...inviteFormData, name: e.target.value})}
                  placeholder="e.g. Jane Doe"
                  className="w-full border border-zinc-300 dark:border-zinc-600 rounded-lg px-4 py-2 focus:ring-2 focus:ring-primary-500 focus:border-primary-500 outline-none"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-200 mb-1">
                  Email Address
                </label>
                <input
                  required
                  type="email"
                  value={inviteFormData.email}
                  onChange={(e) => setInviteFormData({...inviteFormData, email: e.target.value})}
                  placeholder="jane@example.com"
                  className="w-full border border-zinc-300 dark:border-zinc-600 rounded-lg px-4 py-2 focus:ring-2 focus:ring-primary-500 focus:border-primary-500 outline-none"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-200 mb-1">
                  Assign Role
                </label>
                <select
                  value={inviteFormData.role}
                  onChange={(e) => setInviteFormData({...inviteFormData, role: e.target.value})}
                  className="w-full border border-zinc-300 dark:border-zinc-600 rounded-lg px-4 py-2 focus:ring-2 focus:ring-primary-500 focus:border-primary-500 outline-none bg-white dark:bg-zinc-800"
                >
                  <option value="Admin">Admin (Full Access)</option>
                  <option value="Manager">Manager (Operations & Settings)</option>
                  <option value="Partner">Partner (View Only / Basic)</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-200 mb-1">
                  Password
                </label>
                <input
                  required
                  type="password"
                  minLength={6}
                  value={inviteFormData.password}
                  onChange={(e) => setInviteFormData({...inviteFormData, password: e.target.value})}
                  placeholder="Min. 6 characters"
                  className="w-full border border-zinc-300 dark:border-zinc-600 rounded-lg px-4 py-2 focus:ring-2 focus:ring-primary-500 focus:border-primary-500 outline-none"
                />
              </div>

              <div className="pt-4 flex justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setIsInviteModalOpen(false)}
                  className="px-4 py-2 text-zinc-600 dark:text-zinc-300 font-medium hover:bg-zinc-100 dark:hover:bg-zinc-700 rounded-lg transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-primary-600 text-white font-medium hover:bg-primary-700 rounded-lg transition-colors flex items-center shadow-sm"
                >
                  Send Invite
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      <ConfirmationModal
        isOpen={isRestoreConfirmOpen}
        title="Restore Backup"
        message="WARNING: This will overwrite ALL current data with the backup file. This cannot be undone. Are you sure?"
        confirmText="Yes, Restore"
        isDestructive
        onConfirm={confirmRestore}
        onCancel={() => {
          setIsRestoreConfirmOpen(false);
          pendingRestoreFileRef.current = null;
          if (fileInputRef.current) fileInputRef.current.value = '';
        }}
      />

      <ConfirmationModal
        isOpen={isPurgeConfirmOpen}
        title="Purge Inactive Records"
        message="This will permanently delete all inactive (soft-deleted) customers and vehicles. This action cannot be undone."
        confirmText="Yes, Purge"
        isDestructive
        onConfirm={() => {
          setIsPurgeConfirmOpen(false);
          purgeInactiveRecords();
        }}
        onCancel={() => setIsPurgeConfirmOpen(false)}
      />
    </>
  );
}
