import React, { useState, useEffect } from "react";
import { useErp } from "../context/ErpContext";
import { CompanySettings } from "../types";
import { Building2, Users, Receipt, Palette, X, Mail, KeyRound, Lock } from "lucide-react";
import { hashPassword, verifyPassword } from "../lib/auth";
import { ConfirmationModal } from "../components/ui/ConfirmationModal";
import { useToast } from "../components/ui/Toast";
import { getDeviceSummary, type DeviceSummary } from "../lib/device-info";
import { SettingsGeneral } from "./settings/SettingsGeneral";
import { SettingsCategories } from "./settings/SettingsCategories";
import { SettingsUsers } from "./settings/SettingsUsers";
import { SettingsMaterials } from "./settings/SettingsMaterials";
import { SettingsAppearance } from "./settings/SettingsAppearance";
import { SettingsInvoicing } from "./settings/SettingsInvoicing";

type Tab = "general" | "categories" | "users" | "materials" | "appearance" | "invoicing";

const TABS: { id: Tab; label: string; icon: React.ElementType }[] = [
  { id: "general",    label: "General Info",         icon: Building2 },
  { id: "categories", label: "Expense Categories",   icon: Receipt   },
  { id: "users",      label: "Users & Roles",        icon: Users     },
  { id: "materials",  label: "Materials Master",     icon: Receipt   },
  { id: "appearance", label: "Appearance",           icon: Palette   },
  { id: "invoicing",  label: "Invoicing",            icon: Receipt   },
];

export function Settings() {
  const { userRole, companySettings, updateCompanySettings, purgeInactiveRecords } = useErp();
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

  const handleSave = () => {
    updateCompanySettings(localSettings);
    setIsSaved(true);
    setTimeout(() => setIsSaved(false), 2000);
  };

  const handleDownloadBackup = async () => {
    try {
      const API_URL = import.meta.env.VITE_API_URL || "";
      const res = await fetch(`${API_URL}/api/data`);
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
      const API_URL = import.meta.env.VITE_API_URL || "";
      const apiKey = import.meta.env.VITE_API_KEY as string | undefined;
      const headers: Record<string, string> = { 'Content-Type': 'application/json' };
      if (apiKey) headers['x-api-key'] = apiKey;
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
    if (inviteFormData.password.length < 6) { addToast("error", "Password must be at least 6 characters."); return; }
    const passwordHash = await hashPassword(inviteFormData.password);
    const newUsers = [...(localSettings.users || [])];
    newUsers.push({ id: crypto.randomUUID(), name: inviteFormData.name, email: inviteFormData.email, passwordHash, role: inviteFormData.role as any, status: "Active" });
    const updated = { ...localSettings, users: newUsers };
    setLocalSettings(updated);
    updateCompanySettings(updated);
    setIsInviteModalOpen(false);
    setInviteFormData({ name: "", email: "", role: "Partner", password: "" });
  };

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (changePasswordData.next.length < 6) { addToast("error", "New password must be at least 6 characters."); return; }
    if (changePasswordData.next !== changePasswordData.confirm) { addToast("error", "New passwords do not match."); return; }
    setChangePasswordSubmitting(true);
    try {
      const token = localStorage.getItem("erp_auth_token");
      const userId = token?.startsWith("session_") ? token.slice("session_".length) : null;
      const currentUser = userId ? (localSettings.users || []).find((u) => u.id === userId) : null;
      if (!currentUser?.passwordHash) { addToast("error", "Cannot find your account. Please log out and log back in."); return; }
      const currentValid = await verifyPassword(changePasswordData.current, currentUser.passwordHash);
      if (!currentValid) { addToast("error", "Current password is incorrect."); return; }
      const newHash = await hashPassword(changePasswordData.next);
      const updatedUsers = (localSettings.users || []).map((u) => u.id === currentUser.id ? { ...u, passwordHash: newHash } : u);
      const updated = { ...localSettings, users: updatedUsers };
      setLocalSettings(updated);
      updateCompanySettings(updated);
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
    if (resetPasswordValue.length < 6) { addToast("error", "Password must be at least 6 characters."); return; }
    setResetPasswordSubmitting(true);
    try {
      const newHash = await hashPassword(resetPasswordValue);
      const updatedUsers = (localSettings.users || []).map((u) => u.id === resetTargetId ? { ...u, passwordHash: newHash } : u);
      const updated = { ...localSettings, users: updatedUsers };
      setLocalSettings(updated);
      updateCompanySettings(updated);
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
      <div className="space-y-6 max-w-5xl">
        <div>
          <h2 className="text-xl md:text-2xl font-bold font-display text-zinc-900 dark:text-white tracking-tight">Settings</h2>
          <p className="text-zinc-500 dark:text-zinc-400 mt-1">Manage system configurations, users, and masters.</p>
        </div>

        {/* Tab bar */}
        <div className="flex space-x-1 border-b border-zinc-200 dark:border-zinc-700 overflow-x-auto hide-scrollbar">
          {TABS.map(({ id, label, icon: Icon }) => (
            <button
              key={id}
              onClick={() => setActiveTab(id)}
              aria-current={activeTab === id ? "page" : undefined}
              className={`flex items-center px-4 py-3 text-sm font-medium border-b-2 transition-colors whitespace-nowrap ${
                activeTab === id
                  ? "border-primary-500 text-primary-600 dark:text-primary-400"
                  : "border-transparent text-zinc-500 dark:text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200 hover:border-zinc-300"
              }`}
            >
              <Icon className="w-4 h-4 mr-2" />
              {label}
            </button>
          ))}
        </div>

        <div className="bg-white dark:bg-zinc-800 rounded-2xl shadow-sm border border-zinc-100 dark:border-zinc-700 p-3 md:p-5">
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
                { label: "New Password",     key: "next"    as const, placeholder: "Min. 6 characters" },
                { label: "Confirm New Password", key: "confirm" as const },
              ].map(({ label, key, placeholder }) => (
                <div key={key}>
                  <label htmlFor={`cp-${key}`} className="block text-sm font-medium text-zinc-700 dark:text-zinc-200 mb-1">{label}</label>
                  <input
                    id={`cp-${key}`}
                    required type="password" minLength={key !== "current" ? 6 : undefined}
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
                <input id="rp-new" required type="password" minLength={6} value={resetPasswordValue} onChange={(e) => setResetPasswordValue(e.target.value)} placeholder="Min. 6 characters"
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
                { label: "Password",       key: "password" as const, type: "password", placeholder: "Min. 6 characters"     },
              ].map(({ label, key, type, placeholder }) => (
                <div key={key}>
                  <label htmlFor={`inv-${key}`} className="block text-sm font-medium text-zinc-700 dark:text-zinc-200 mb-1">{label}</label>
                  <input id={`inv-${key}`} required type={type} minLength={key === "password" ? 6 : undefined}
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
                  <option value="Manager">Manager (Operations &amp; Settings)</option>
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
