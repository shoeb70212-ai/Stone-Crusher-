import React, { useState, useEffect } from "react";
import { useErp } from "../context/ErpContext";
import { CompanySettings } from "../types";
import { Building2, Users, Receipt, Palette, X, Mail, KeyRound, Lock, Database, Upload, Download } from "lucide-react";
import { supabase } from "../lib/supabase";
import { downloadCSV } from "../lib/export-utils";
import { ConfirmationModal } from "../components/ui/ConfirmationModal";
import { useToast } from "../components/ui/Toast";
import { getDeviceSummary, type DeviceSummary } from "../lib/device-info";
import { SettingsGeneral } from "./settings/SettingsGeneral";
import { SettingsCategories } from "./settings/SettingsCategories";
import { SettingsUsers } from "./settings/SettingsUsers";
import { SettingsMaterials } from "./settings/SettingsMaterials";
import { SettingsAppearance } from "./settings/SettingsAppearance";
import { SettingsInvoicing } from "./settings/SettingsInvoicing";

type Tab = "general" | "categories" | "users" | "materials" | "appearance" | "invoicing" | "data";

const TABS: { id: Tab; label: string; icon: React.ElementType }[] = [
  { id: "general",    label: "General Info",         icon: Building2 },
  { id: "categories", label: "Categories & Roles",   icon: Receipt   },
  { id: "users",      label: "Users & Roles",        icon: Users     },
  { id: "materials",  label: "Materials Master",     icon: Receipt   },
  { id: "appearance", label: "Appearance",           icon: Palette   },
  { id: "invoicing",  label: "Invoicing",            icon: Receipt   },
  { id: "data",       label: "Data",                 icon: Database  },
];

export function Settings() {
  const { userRole, companySettings, updateCompanySettings, purgeInactiveRecords, session, invoices, addInvoice } = useErp();
  const { addToast } = useToast();

  const [activeTab, setActiveTab] = useState<Tab>("general");
  const [isSaved, setIsSaved] = useState(false);

  // Invite modal
  const [isInviteModalOpen, setIsInviteModalOpen] = useState(false);
  const [inviteFormData, setInviteFormData] = useState({ name: "", email: "", role: "Partner", password: "" });

  // Change-password modal (logged-in user)
  const [isChangePasswordOpen, setIsChangePasswordOpen] = useState(false);
  const [changePasswordData, setChangePasswordData] = useState({ current: "", next: "", confirm: "" });
  const [changePasswordSubmitting, setChangePasswordSubmitting] = useState(false);

  // Admin reset-password modal
  const [resetTargetId, setResetTargetId] = useState<string | null>(null);
  const [resetPasswordValue, setResetPasswordValue] = useState("");
  const [resetPasswordSubmitting, setResetPasswordSubmitting] = useState(false);

  const fileInputRef = React.useRef<HTMLInputElement>(null);
  const pendingRestoreFileRef = React.useRef<string | null>(null);
  const [isRestoreConfirmOpen, setIsRestoreConfirmOpen] = useState(false);
  const [isPurgeConfirmOpen, setIsPurgeConfirmOpen] = useState(false);
  const [deviceInfo, setDeviceInfo] = useState<DeviceSummary | null>(null);

  const [localSettings, setLocalSettings] = useState<CompanySettings>({
    ...companySettings,
    theme: companySettings.theme ?? "system",
    primaryColor: companySettings.primaryColor ?? "emerald",
  });

  const getAuthHeaders = (includeJson = false): Record<string, string> => {
    const headers: Record<string, string> = includeJson ? { "Content-Type": "application/json" } : {};
    const apiKey = import.meta.env.VITE_API_KEY as string | undefined;
    if (apiKey) headers["x-api-key"] = apiKey;
    if (session?.access_token) headers.Authorization = `Bearer ${session.access_token}`;
    return headers;
  };

  useEffect(() => {
    setLocalSettings({
      ...companySettings,
      theme: companySettings.theme ?? "system",
      primaryColor: companySettings.primaryColor ?? "emerald",
    });
  }, [companySettings]);

  useEffect(() => {
    if (activeTab === "general" && !deviceInfo) {
      getDeviceSummary().then(setDeviceInfo);
    }
  }, [activeTab, deviceInfo]);

  const syncUserAdminChanges = async (): Promise<boolean> => {
    if (userRole !== "Admin") return true;
    const before = companySettings.users || [];
    const after = localSettings.users || [];
    const hasChanges =
      before.length !== after.length ||
      before.some((oldUser) => {
        const nextUser = after.find((u) => u.id === oldUser.id);
        return (
          !nextUser ||
          nextUser.name !== oldUser.name ||
          nextUser.email !== oldUser.email ||
          nextUser.role !== oldUser.role ||
          nextUser.status !== oldUser.status
        );
      });

    if (!hasChanges) return true;
    if (!session?.access_token) {
      addToast("error", "You must be signed in to update users.");
      return false;
    }

    const API_URL = import.meta.env.VITE_API_URL as string || "";

    for (const oldUser of before) {
      if (!after.some((u) => u.id === oldUser.id)) {
        const res = await fetch(`${API_URL}/api/admin-users?id=${encodeURIComponent(oldUser.id)}`, {
          method: "DELETE",
          headers: getAuthHeaders(),
        });
        if (!res.ok) {
          const body = await res.json().catch(() => ({}));
          addToast("error", body.error || `Could not remove ${oldUser.name}.`);
          return false;
        }
      }
    }

    for (const nextUser of after) {
      const oldUser = before.find((u) => u.id === nextUser.id);
      if (!oldUser) continue;
      if (
        nextUser.name === oldUser.name &&
        nextUser.email === oldUser.email &&
        nextUser.role === oldUser.role &&
        nextUser.status === oldUser.status
      ) {
        continue;
      }

      const res = await fetch(`${API_URL}/api/admin-users`, {
        method: "PATCH",
        headers: getAuthHeaders(true),
        body: JSON.stringify({
          id: nextUser.id,
          name: nextUser.name,
          email: nextUser.email,
          role: nextUser.role,
          status: nextUser.status,
        }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        addToast("error", body.error || `Could not update ${nextUser.name}.`);
        return false;
      }
    }

    return true;
  };

  const handleSave = async () => {
    const usersSynced = await syncUserAdminChanges();
    if (!usersSynced) return;

    const saved = await updateCompanySettings(localSettings);
    if (!saved) {
      addToast("error", "Could not save settings to Supabase. Check your connection and try again.");
      return;
    }
    setIsSaved(true);
    addToast("success", "Settings saved to Supabase.");
    setTimeout(() => setIsSaved(false), 2000);
  };

  const handleDownloadBackup = async () => {
    try {
      const API_URL = import.meta.env.VITE_API_URL || "";
      const res = await fetch(`${API_URL}/api/data`, { headers: getAuthHeaders() });
      if (!res.ok) throw new Error("Failed to fetch");
      const data = await res.json();
      const jsonStr = JSON.stringify(data, null, 2);
      const filename = `crushtrack-backup-${new Date().toISOString().split("T")[0]}.json`;

      const { isNative } = await import("../lib/capacitor");
      if (isNative()) {
        const { Filesystem, Directory } = await import("@capacitor/filesystem");
        const { Share } = await import("@capacitor/share");
        const result = await Filesystem.writeFile({ path: filename, data: btoa(unescape(encodeURIComponent(jsonStr))), directory: Directory.Documents, recursive: true });
        await Share.share({ title: "CrushTrack Backup", url: result.uri, dialogTitle: "Save Backup" });
        addToast("success", "Backup saved to Documents.");
        return;
      }

      const blob = new Blob([jsonStr], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = filename;
      link.click();
      URL.revokeObjectURL(url);
    } catch {
      addToast("error", "Failed to download backup.");
    }
  };

  const REQUIRED_BACKUP_KEYS = ["customers", "slips", "transactions", "vehicles", "invoices", "tasks", "companySettings"];

  const handleRestoreBackup = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const content = event.target?.result as string;
        const data = JSON.parse(content);
        if (!data || typeof data !== "object" || Array.isArray(data)) {
          addToast("error", "Invalid backup file: payload must be a JSON object.");
          if (fileInputRef.current) fileInputRef.current.value = "";
          return;
        }
        const missing = REQUIRED_BACKUP_KEYS.filter((k) => !(k in data));
        if (missing.length > 0) {
          addToast("error", `Invalid backup file: missing required keys: ${missing.join(", ")}.`);
          if (fileInputRef.current) fileInputRef.current.value = "";
          return;
        }
        pendingRestoreFileRef.current = content;
        setIsRestoreConfirmOpen(true);
      } catch {
        addToast("error", "Invalid backup file — could not parse JSON.");
        if (fileInputRef.current) fileInputRef.current.value = "";
      }
    };
    reader.readAsText(file);
  };

  const confirmRestore = async () => {
    setIsRestoreConfirmOpen(false);
    const content = pendingRestoreFileRef.current;
    pendingRestoreFileRef.current = null;
    if (fileInputRef.current) fileInputRef.current.value = "";
    if (!content) return;
    try {
      const data = JSON.parse(content);
      data.employees = Array.isArray(data.employees) ? data.employees : [];
      data.employeeTransactions = Array.isArray(data.employeeTransactions) ? data.employeeTransactions : [];
      const API_URL = import.meta.env.VITE_API_URL || "";
      const headers = getAuthHeaders(true);
      const res = await fetch(`${API_URL}/api/data`, { method: "POST", headers, body: JSON.stringify(data) });
      if (res.ok) {
        addToast("success", "Backup restored successfully! Reloading…");
        setTimeout(() => window.location.reload(), 1200);
      } else {
        const err = await res.json().catch(() => ({}));
        addToast("error", `Failed to restore backup: ${err.error || "Server error"}`);
      }
    } catch {
      addToast("error", "Failed to restore backup.");
    }
  };

  const handleInviteUser = async (e: React.FormEvent) => {
    e.preventDefault();
    if (inviteFormData.password.length < 8) { addToast("error", "Password must be at least 8 characters."); return; }
    const name = inviteFormData.name.trim();
    const email = inviteFormData.email.trim().toLowerCase();
    if (!name) { addToast("error", "Full name is required."); return; }
    if (!email) { addToast("error", "Email address is required."); return; }
    const duplicate = (localSettings.users || []).some((user) => (user.email || "").trim().toLowerCase() === email);
    if (duplicate) { addToast("error", "A user with this email already exists."); return; }

    const { data: sessionData } = await supabase.auth.getSession();
    const token = sessionData.session?.access_token;
    if (!token) { addToast("error", "You must be signed in to invite users."); return; }

    const API_URL = import.meta.env.VITE_API_URL as string || "";
    const res = await fetch(`${API_URL}/api/admin-users`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      body: JSON.stringify({ name, email, password: inviteFormData.password, role: inviteFormData.role }),
    });

    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      addToast("error", body.error || "Failed to create user. Check your connection and try again.");
      return;
    }

    const { user: newUser } = await res.json();
    const updated = { ...localSettings, users: [...(localSettings.users || []), newUser] };
    setLocalSettings(updated);
    setIsInviteModalOpen(false);
    setInviteFormData({ name: "", email: "", role: "Partner", password: "" });
    addToast("success", "User created. They can sign in with this email and password.");
  };

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (changePasswordData.next.length < 8) { addToast("error", "New password must be at least 8 characters."); return; }
    if (changePasswordData.next !== changePasswordData.confirm) { addToast("error", "New passwords do not match."); return; }
    setChangePasswordSubmitting(true);
    try {
      // Re-authenticate with current password first to verify identity.
      const { data: sessionData } = await supabase.auth.getSession();
      const email = sessionData.session?.user.email;
      if (!email) { addToast("error", "Cannot find your account. Please sign out and sign back in."); return; }

      const { error: verifyError } = await supabase.auth.signInWithPassword({
        email,
        password: changePasswordData.current,
      });
      if (verifyError) { addToast("error", "Current password is incorrect."); return; }

      // Update password through Supabase Auth.
      const { error: updateError } = await supabase.auth.updateUser({ password: changePasswordData.next });
      if (updateError) { addToast("error", updateError.message || "Failed to update password."); return; }

      setIsChangePasswordOpen(false);
      setChangePasswordData({ current: "", next: "", confirm: "" });
      addToast("success", "Password changed successfully.");
    } finally {
      setChangePasswordSubmitting(false);
    }
  };

  const handleAdminResetPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!resetTargetId) return;
    if (resetPasswordValue.length < 8) { addToast("error", "Password must be at least 8 characters."); return; }
    setResetPasswordSubmitting(true);
    try {
      const { data: sessionData } = await supabase.auth.getSession();
      const token = sessionData.session?.access_token;
      if (!token) { addToast("error", "You must be signed in to reset passwords."); return; }

      const API_URL = import.meta.env.VITE_API_URL as string || "";
      const res = await fetch(`${API_URL}/api/admin-users`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ id: resetTargetId, password: resetPasswordValue }),
      });

      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        addToast("error", body.error || "Failed to reset password. Try again.");
        return;
      }

      setResetTargetId(null);
      setResetPasswordValue("");
      addToast("success", "Password reset successfully.");
    } finally {
      setResetPasswordSubmitting(false);
    }
  };

  const sharedProps = { localSettings, setLocalSettings, isSaved, onSave: handleSave };

  return (
    <>
      <div className="space-y-5 md:space-y-6 max-w-5xl pb-[calc(6rem+env(safe-area-inset-bottom))] md:pb-0">
        <div>
          <h2 className="text-2xl md:text-3xl font-display font-bold text-foreground tracking-tight">Settings</h2>
          <p className="text-sm text-muted-foreground mt-1">Manage system configurations, users, and masters.</p>
        </div>

        {/* Tab bar — horizontally scrollable on mobile, semantic tokens */}
        <div className="relative -mx-2 md:mx-0">
          <div className="pointer-events-none absolute inset-y-0 right-0 w-8 bg-gradient-to-l from-background to-transparent z-10 md:hidden" />
          <div
            role="tablist"
            aria-label="Settings sections"
            className="flex md:flex-wrap overflow-x-auto no-scrollbar md:overflow-visible md:space-x-1 border-b border-border px-2 md:px-0"
          >
            {TABS.map(({ id, label, icon: Icon }) => (
              <button
                key={id}
                role="tab"
                onClick={() => setActiveTab(id)}
                aria-current={activeTab === id ? "page" : undefined}
                aria-selected={activeTab === id}
                className={`flex items-center gap-1.5 px-3 md:px-4 py-2.5 md:py-3 text-xs md:text-sm font-medium border-b-2 -mb-px transition-colors whitespace-nowrap shrink-0 min-h-[44px] ${
                  activeTab === id
                    ? "border-primary-600 text-foreground"
                    : "border-transparent text-muted-foreground hover:text-foreground hover:border-border-strong"
                }`}
              >
                <Icon className="w-4 h-4 shrink-0" />
                <span className="hidden sm:inline">{label}</span>
                <span className="sm:hidden">{label.split(' ')[0]}</span>
              </button>
            ))}
          </div>
        </div>

        <div className="card-surface p-4 md:p-6">
          {activeTab === "general" && (
            <SettingsGeneral
              {...sharedProps}
              userRole={userRole}
              deviceInfo={deviceInfo}
              fileInputRef={fileInputRef}
              onDownloadBackup={handleDownloadBackup}
              onRestoreBackup={handleRestoreBackup}
              onPurgeClick={() => setIsPurgeConfirmOpen(true)}
            />
          )}
          {activeTab === "categories" && <SettingsCategories {...sharedProps} />}
          {activeTab === "users" && (
            <SettingsUsers
              {...sharedProps}
              userRole={userRole}
              onOpenInvite={() => setIsInviteModalOpen(true)}
              onOpenChangePassword={() => setIsChangePasswordOpen(true)}
              onOpenResetPassword={(id) => { setResetTargetId(id); setResetPasswordValue(""); }}
            />
          )}
          {activeTab === "materials" && <SettingsMaterials {...sharedProps} />}
          {activeTab === "appearance" && <SettingsAppearance {...sharedProps} />}
          {activeTab === "invoicing" && <SettingsInvoicing {...sharedProps} />}
          {activeTab === "data" && (
            <div className="space-y-6">
              <div>
                <h3 className="text-xl font-display font-bold text-foreground tracking-tight">Data Management</h3>
                <p className="text-sm text-muted-foreground mt-1">Import and export invoice records.</p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="border border-border rounded-xl p-4 space-y-3 bg-surface">
                  <div className="flex items-center gap-2">
                    <Upload className="w-5 h-5 text-primary-600" />
                    <h4 className="font-semibold text-foreground">Import Invoices</h4>
                  </div>
                  <p className="text-xs text-muted-foreground">Upload a JSON file containing invoice records.</p>
                  <label className="inline-flex items-center gap-2 px-4 py-2 bg-primary-600 text-white text-sm font-medium rounded-lg cursor-pointer hover:bg-primary-700 transition-colors active:scale-95">
                    <Upload className="w-4 h-4" />
                    Choose JSON File
                    <input
                      type="file"
                      accept=".json"
                      className="hidden"
                      onChange={async (e) => {
                        const file = e.target.files?.[0];
                        if (!file) return;
                        try {
                          const text = await file.text();
                          const data = JSON.parse(text);
                          const items = Array.isArray(data) ? data : data.invoices;
                          if (!Array.isArray(items)) {
                            addToast("error", "Invalid file format. Expected an array of invoices.");
                            return;
                          }
                          let imported = 0;
                          for (const inv of items) {
                            if (inv && inv.id && inv.invoiceNo) {
                              addInvoice(inv);
                              imported++;
                            }
                          }
                          addToast("success", `Imported ${imported} invoice(s).`);
                        } catch {
                          addToast("error", "Failed to import invoices. Ensure the file is valid JSON.");
                        } finally {
                          if (e.target) e.target.value = "";
                        }
                      }}
                    />
                  </label>
                </div>

                <div className="border border-zinc-200 dark:border-zinc-700 rounded-xl p-4 space-y-3">
                  <div className="flex items-center gap-2">
                    <Download className="w-5 h-5 text-primary-600" />
                    <h4 className="font-semibold text-zinc-900 dark:text-white">Export Invoices</h4>
                  </div>
                  <p className="text-xs text-zinc-500 dark:text-zinc-400">Download all invoices as a CSV file.</p>
                  <button
                    onClick={async () => {
                      try {
                        const rows = invoices.map((inv) => ({
                          invoiceNo: inv.invoiceNo,
                          date: new Date(inv.date).toLocaleDateString(),
                          type: inv.type,
                          customerId: inv.customerId,
                          total: inv.total,
                          status: inv.status,
                        }));
                        await downloadCSV(rows, {
                          invoiceNo: "Invoice No",
                          date: "Date",
                          type: "Type",
                          customerId: "Customer ID",
                          total: "Total (₹)",
                          status: "Status",
                        }, `Invoices_${new Date().toISOString().split("T")[0]}`);
                        addToast("success", "Invoices exported successfully.");
                      } catch {
                        addToast("error", "Failed to export invoices.");
                      }
                    }}
                    className="inline-flex items-center gap-2 px-4 py-2 bg-zinc-900 dark:bg-white text-white dark:text-zinc-900 text-sm font-medium rounded-lg hover:bg-zinc-700 dark:hover:bg-zinc-200 transition-colors active:scale-95"
                  >
                    <Download className="w-4 h-4" />
                    Export CSV
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Change My Password Modal */}
      {isChangePasswordOpen && (
        <div className="fixed inset-0 bg-zinc-900/50 flex items-center justify-center p-4 z-50">
          <div className="bg-white dark:bg-zinc-800 rounded-2xl w-full max-w-md shadow-xl overflow-hidden">
            <div className="px-6 py-4 border-b border-zinc-100 dark:border-zinc-700 flex justify-between items-center bg-zinc-50 dark:bg-zinc-900/50">
              <h3 className="text-lg font-bold text-zinc-900 dark:text-white flex items-center gap-2"><Lock className="w-5 h-5 text-primary-600" /> Change Password</h3>
              <button onClick={() => setIsChangePasswordOpen(false)} className="text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-300"><X className="w-5 h-5" /></button>
            </div>
            <form onSubmit={handleChangePassword} className="p-6 space-y-4">
              {[
                { label: "Current Password", key: "current" as const },
                { label: "New Password",     key: "next"    as const, placeholder: "Min. 8 characters" },
                { label: "Confirm New Password", key: "confirm" as const },
              ].map(({ label, key, placeholder }) => (
                <div key={key}>
                  <label htmlFor={`cp-${key}`} className="block text-sm font-medium text-zinc-700 dark:text-zinc-200 mb-1">{label}</label>
                  <input
                    id={`cp-${key}`}
                    required type="password" minLength={key !== "current" ? 8 : undefined}
                    value={changePasswordData[key]}
                    onChange={(e) => setChangePasswordData({ ...changePasswordData, [key]: e.target.value })}
                    placeholder={placeholder}
                    className="w-full border border-zinc-300 dark:border-zinc-600 rounded-lg px-4 py-2 focus:ring-2 focus:ring-primary-500 outline-none bg-transparent dark:text-white"
                  />
                </div>
              ))}
              <div className="pt-2 flex justify-end gap-3">
                <button type="button" onClick={() => { setIsChangePasswordOpen(false); setChangePasswordData({ current: "", next: "", confirm: "" }); }} className="px-4 py-2 text-zinc-600 dark:text-zinc-300 font-medium hover:bg-zinc-100 dark:hover:bg-zinc-700 rounded-lg transition-colors">Cancel</button>
                <button type="submit" disabled={changePasswordSubmitting} className="px-4 py-2 bg-primary-600 text-white font-medium hover:bg-primary-700 disabled:opacity-60 rounded-lg transition-colors">
                  {changePasswordSubmitting ? "Saving…" : "Save Password"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Admin Reset Password Modal */}
      {resetTargetId && (
        <div className="fixed inset-0 bg-zinc-900/50 flex items-center justify-center p-4 z-50">
          <div className="bg-white dark:bg-zinc-800 rounded-2xl w-full max-w-md shadow-xl overflow-hidden">
            <div className="px-6 py-4 border-b border-zinc-100 dark:border-zinc-700 flex justify-between items-center bg-zinc-50 dark:bg-zinc-900/50">
              <h3 className="text-lg font-bold text-zinc-900 dark:text-white flex items-center gap-2"><KeyRound className="w-5 h-5 text-amber-600" /> Reset Password</h3>
              <button onClick={() => setResetTargetId(null)} className="text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-300"><X className="w-5 h-5" /></button>
            </div>
            <form onSubmit={handleAdminResetPassword} className="p-6 space-y-4">
              <p className="text-sm text-zinc-500 dark:text-zinc-400">
                Set a new password for <strong className="text-zinc-900 dark:text-white">{(localSettings.users || []).find((u) => u.id === resetTargetId)?.name ?? "this user"}</strong>.
              </p>
              <div>
                <label htmlFor="rp-new" className="block text-sm font-medium text-zinc-700 dark:text-zinc-200 mb-1">New Password</label>
                <input id="rp-new" required type="password" minLength={8} value={resetPasswordValue} onChange={(e) => setResetPasswordValue(e.target.value)} placeholder="Min. 8 characters"
                  className="w-full border border-zinc-300 dark:border-zinc-600 rounded-lg px-4 py-2 focus:ring-2 focus:ring-primary-500 outline-none bg-transparent dark:text-white"
                />
              </div>
              <div className="pt-2 flex justify-end gap-3">
                <button type="button" onClick={() => { setResetTargetId(null); setResetPasswordValue(""); }} className="px-4 py-2 text-zinc-600 dark:text-zinc-300 font-medium hover:bg-zinc-100 dark:hover:bg-zinc-700 rounded-lg transition-colors">Cancel</button>
                <button type="submit" disabled={resetPasswordSubmitting} className="px-4 py-2 bg-amber-600 text-white font-medium hover:bg-amber-700 disabled:opacity-60 rounded-lg transition-colors">
                  {resetPasswordSubmitting ? "Resetting…" : "Reset Password"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Invite User Modal */}
      {isInviteModalOpen && (
        <div className="fixed inset-0 bg-zinc-900/50 flex items-center justify-center p-4 z-50">
          <div className="bg-white dark:bg-zinc-800 rounded-2xl w-full max-w-md shadow-xl overflow-hidden">
            <div className="px-6 py-4 border-b border-zinc-100 dark:border-zinc-700 flex justify-between items-center bg-zinc-50 dark:bg-zinc-900/50">
              <h3 className="text-lg font-bold text-zinc-900 dark:text-white flex items-center gap-2"><Mail className="w-5 h-5 text-primary-600" /> Invite Team Member</h3>
              <button onClick={() => setIsInviteModalOpen(false)} className="text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-300"><X className="w-5 h-5" /></button>
            </div>
            <form onSubmit={handleInviteUser} className="p-6 space-y-4">
              {[
                { label: "Full Name",      key: "name"     as const, type: "text",     placeholder: "e.g. Jane Doe"         },
                { label: "Email Address",  key: "email"    as const, type: "email",    placeholder: "jane@example.com"      },
                { label: "Password",       key: "password" as const, type: "password", placeholder: "Min. 8 characters"     },
              ].map(({ label, key, type, placeholder }) => (
                <div key={key}>
                  <label htmlFor={`inv-${key}`} className="block text-sm font-medium text-zinc-700 dark:text-zinc-200 mb-1">{label}</label>
                  <input id={`inv-${key}`} required type={type} minLength={key === "password" ? 8 : undefined}
                    value={inviteFormData[key]} onChange={(e) => setInviteFormData({ ...inviteFormData, [key]: e.target.value })}
                    placeholder={placeholder}
                    className="w-full border border-zinc-300 dark:border-zinc-600 rounded-lg px-4 py-2 focus:ring-2 focus:ring-primary-500 outline-none dark:text-white"
                  />
                </div>
              ))}
              <div>
                <label htmlFor="inv-role" className="block text-sm font-medium text-zinc-700 dark:text-zinc-200 mb-1">Assign Role</label>
                <select id="inv-role" value={inviteFormData.role} onChange={(e) => setInviteFormData({ ...inviteFormData, role: e.target.value })}
                  className="w-full border border-zinc-300 dark:border-zinc-600 rounded-lg px-4 py-2 focus:ring-2 focus:ring-primary-500 outline-none bg-white dark:bg-zinc-800 dark:text-white"
                >
                <option value="Admin">Admin (Full Access)</option>
                <option value="Manager">Manager (Operations & Settings)</option>
                <option value="Partner">Partner (View Only / Basic)</option>
                </select>
              </div>
              <div className="pt-4 flex justify-end gap-3">
                <button type="button" onClick={() => setIsInviteModalOpen(false)} className="px-4 py-2 text-zinc-600 dark:text-zinc-300 font-medium hover:bg-zinc-100 dark:hover:bg-zinc-700 rounded-lg transition-colors">Cancel</button>
                <button type="submit" className="px-4 py-2 bg-primary-600 text-white font-medium hover:bg-primary-700 rounded-lg transition-colors flex items-center shadow-sm">Send Invite</button>
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
        onCancel={() => { setIsRestoreConfirmOpen(false); pendingRestoreFileRef.current = null; if (fileInputRef.current) fileInputRef.current.value = ""; }}
      />
      <ConfirmationModal
        isOpen={isPurgeConfirmOpen}
        title="Purge Inactive Records"
        message="This will permanently delete all inactive (soft-deleted) customers and vehicles. This action cannot be undone."
        confirmText="Yes, Purge"
        isDestructive
        onConfirm={() => {
          setIsPurgeConfirmOpen(false);
          const { purged, skipped } = purgeInactiveRecords();
          if (skipped > 0) {
            addToast("warning", `Purged ${purged} record(s). ${skipped} customer(s) skipped — they still have financial history and were not deleted.`);
          } else {
            addToast("success", `Purged ${purged} inactive record(s).`);
          }
        }}
        onCancel={() => setIsPurgeConfirmOpen(false)}
      />
    </>
  );
}
