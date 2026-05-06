import React, { useState } from "react";
import { Save, Check, Mail, Lock, KeyRound, Shield, X } from "lucide-react";
import { CompanySettings } from "../../types";
import { useErp } from "../../context/ErpContext";

interface Props {
  localSettings: CompanySettings;
  setLocalSettings: (s: CompanySettings) => void;
  isSaved: boolean;
  userRole: string | null;
  onSave: () => void;
  // Modals are kept in Settings.tsx to avoid extra prop drilling of async handlers
  onOpenInvite: () => void;
  onOpenChangePassword: () => void;
  onOpenResetPassword: (userId: string) => void;
}

export function SettingsUsers({
  localSettings, setLocalSettings, isSaved, userRole,
  onSave, onOpenInvite, onOpenChangePassword, onOpenResetPassword,
}: Props) {
  const { session } = useErp();
  // Identify the currently logged-in user so the Remove button is hidden for them.
  const currentUserId = session?.user.id ?? null;

  const [editingPermissionsUserId, setEditingPermissionsUserId] = useState<string | null>(null);

  const editingUser = (localSettings.users || []).find((u) => u.id === editingPermissionsUserId);

  const handleTogglePermission = (key: keyof import("../../types").UserPermissions) => {
    if (!editingUser) return;
    const currentPerms = editingUser.permissions || {};
    const newVal = !(currentPerms[key] ?? getDefaultPermission(editingUser.role, key));
    
    setLocalSettings({
      ...localSettings,
      users: (localSettings.users || []).map((u) =>
        u.id === editingUser.id
          ? { ...u, permissions: { ...currentPerms, [key]: newVal } }
          : u
      ),
    });
  };

  const getDefaultPermission = (role: string, key: string) => {
    if (role === "Admin") return true;
    if (role === "Manager") {
      return ["viewAllCustomers", "viewCustomerLedger", "viewCustomerStatement", "viewPendingAmounts", "viewAllDispatches", "viewDaybook", "viewReports", "manageVehicles", "manageEmployees"].includes(key);
    }
    // Partner default
    return ["viewAllCustomers", "viewCustomerLedger", "viewCustomerStatement", "viewPendingAmounts", "viewAllDispatches", "viewReports"].includes(key);
  };

  const PERMISSIONS_CONFIG = [
    { key: "viewAllCustomers", label: "View All Customers" },
    { key: "viewCustomerLedger", label: "View Customer Ledger" },
    { key: "viewCustomerStatement", label: "View Customer Statements" },
    { key: "viewPendingAmounts", label: "View Pending Amounts" },
    { key: "viewAllDispatches", label: "View All Dispatches" },
    { key: "viewDaybook", label: "View Daybook" },
    { key: "viewReports", label: "View Reports" },
    { key: "manageVehicles", label: "Manage Vehicles" },
    { key: "manageEmployees", label: "Manage Employees" },
    { key: "viewOnlyOwnRecords", label: "View Only Own Added Records", desc: "If enabled, the user will only see customers/dispatches they created." },
  ] as const;

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center flex-wrap gap-2">
        <h3 className="text-lg font-semibold text-zinc-900 dark:text-white">User Roles & Permissions</h3>
        <div className="flex items-center gap-2">
          <button
            onClick={onOpenChangePassword}
            className="text-sm font-medium text-zinc-600 dark:text-zinc-300 hover:text-zinc-900 dark:hover:text-white bg-zinc-100 dark:bg-zinc-700 px-3 py-2 rounded-lg transition-colors flex items-center gap-1.5"
          >
            <Lock className="w-4 h-4" />
            Change My Password
          </button>
          {userRole === "Admin" && (
            <button
              onClick={onOpenInvite}
              className="text-sm font-medium text-primary-600 hover:text-primary-700 bg-primary-50 dark:bg-primary-900/30 dark:text-primary-400 px-3 py-2 rounded-lg transition-colors flex items-center gap-1.5"
            >
              <Mail className="w-4 h-4" />
              Invite User
            </button>
          )}
        </div>
      </div>

      {/* Desktop table */}
      <div className="hidden md:block overflow-x-auto">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="bg-zinc-50 dark:bg-zinc-900/50 border-y border-zinc-200 dark:border-zinc-700">
              {["Name", "Email", "Role", "Status", "Actions"].map((h) => (
                <th key={h} className={`py-3 px-4 text-sm font-semibold text-zinc-600 dark:text-zinc-300 ${h === "Actions" ? "text-right" : ""}`}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800">
            {(localSettings.users || []).map((user) => {
              const isCurrentUser = user.id === currentUserId;
              const updUsers = (patch: Partial<typeof user>) =>
                setLocalSettings({
                  ...localSettings,
                  users: (localSettings.users || []).map((u) => u.id === user.id ? { ...u, ...patch } : u),
                });
              return (
                <tr key={user.id} className="hover:bg-zinc-50 dark:hover:bg-zinc-800/50">
                  <td className="py-3 px-4">
                    <input type="text" value={user.name}
                      onChange={(e) => updUsers({ name: e.target.value })}
                      className="w-full bg-transparent border-b border-transparent focus:border-primary-500 outline-none text-zinc-900 dark:text-white"
                    />
                  </td>
                  <td className="py-3 px-4">
                    <input type="email" value={user.email}
                      onChange={(e) => updUsers({ email: e.target.value })}
                      className="w-full bg-transparent border-b border-transparent focus:border-primary-500 outline-none text-zinc-500 dark:text-zinc-400"
                    />
                  </td>
                  <td className="py-3 px-4">
                    <select value={user.role}
                      onChange={(e) => updUsers({ role: e.target.value as "Admin" | "Manager" | "Partner" })}
                      className="border border-zinc-300 dark:border-zinc-600 rounded px-2 py-1 text-sm bg-white dark:bg-zinc-800 outline-none focus:border-primary-500 dark:text-white"
                    >
                      <option value="Admin">Admin</option>
                      <option value="Manager">Manager</option>
                      <option value="Partner">Partner</option>
                    </select>
                  </td>
                  <td className="py-3 px-4">
                    <select value={user.status}
                      onChange={(e) => updUsers({ status: e.target.value as "Active" | "Inactive" })}
                      className={`inline-flex items-center border border-transparent rounded px-2 py-1 text-xs font-medium outline-none focus:border-primary-500 ${user.status === "Active" ? "bg-primary-100 text-primary-800 dark:bg-primary-900/30 dark:text-primary-300" : "bg-zinc-100 dark:bg-zinc-800 text-zinc-800 dark:text-zinc-200"}`}
                    >
                      <option value="Active">Active</option>
                      <option value="Inactive">Inactive</option>
                    </select>
                  </td>
                  <td className="py-3 px-4 text-right">
                    <div className="flex items-center justify-end gap-3">
                      {userRole === "Admin" && (
                        <button
                          onClick={() => onOpenResetPassword(user.id)}
                          className="text-amber-600 hover:text-amber-800 dark:text-amber-400 dark:hover:text-amber-300 text-sm font-medium flex items-center gap-1"
                          title="Reset password for this user"
                        >
                          <KeyRound className="w-3.5 h-3.5" /> Reset
                        </button>
                      )}
                      {userRole === "Admin" && (
                        <button
                          onClick={() => setEditingPermissionsUserId(user.id)}
                          className="text-primary-600 hover:text-primary-800 dark:text-primary-400 dark:hover:text-primary-300 text-sm font-medium flex items-center gap-1"
                          title="Manage Permissions"
                        >
                          <Shield className="w-3.5 h-3.5" /> Permissions
                        </button>
                      )}
                      {userRole === "Admin" && !isCurrentUser && (
                        <button
                          onClick={() =>
                            setLocalSettings({
                              ...localSettings,
                              users: (localSettings.users || []).filter((u) => u.id !== user.id),
                            })
                          }
                          className="text-rose-600 hover:text-rose-900 dark:text-rose-400 dark:hover:text-rose-300 text-sm font-medium"
                        >
                          Remove
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Mobile card list */}
      <div className="md:hidden space-y-3">
        {(localSettings.users || []).map((user) => {
          const isCurrentUser = user.id === currentUserId;
          const updUsers = (patch: Partial<typeof user>) =>
            setLocalSettings({
              ...localSettings,
              users: (localSettings.users || []).map((u) => u.id === user.id ? { ...u, ...patch } : u),
            });
          return (
            <div key={user.id} className="bg-white dark:bg-zinc-800 rounded-xl border border-zinc-200 dark:border-zinc-700 p-4 space-y-3">
              <div className="space-y-2">
                <div>
                  <label className="text-[10px] font-semibold uppercase tracking-wide text-zinc-500">Name</label>
                  <input type="text" value={user.name}
                    onChange={(e) => updUsers({ name: e.target.value })}
                    className="w-full bg-transparent border-b border-transparent focus:border-primary-500 outline-none text-zinc-900 dark:text-white font-medium"
                  />
                </div>
                <div>
                  <label className="text-[10px] font-semibold uppercase tracking-wide text-zinc-500">Email</label>
                  <input type="email" value={user.email}
                    onChange={(e) => updUsers({ email: e.target.value })}
                    className="w-full bg-transparent border-b border-transparent focus:border-primary-500 outline-none text-zinc-500 dark:text-zinc-400 text-sm"
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="text-[10px] font-semibold uppercase tracking-wide text-zinc-500 block mb-1">Role</label>
                  <select value={user.role}
                    onChange={(e) => updUsers({ role: e.target.value as "Admin" | "Manager" | "Partner" })}
                    className="w-full border border-zinc-300 dark:border-zinc-600 rounded-lg px-2 py-1.5 text-sm bg-white dark:bg-zinc-800 outline-none focus:border-primary-500 dark:text-white"
                  >
                    <option value="Admin">Admin</option>
                    <option value="Manager">Manager</option>
                    <option value="Partner">Partner</option>
                  </select>
                </div>
                <div>
                  <label className="text-[10px] font-semibold uppercase tracking-wide text-zinc-500 block mb-1">Status</label>
                  <select value={user.status}
                    onChange={(e) => updUsers({ status: e.target.value as "Active" | "Inactive" })}
                    className={`w-full border border-transparent rounded-lg px-2 py-1.5 text-xs font-medium outline-none focus:border-primary-500 ${user.status === "Active" ? "bg-primary-100 text-primary-800 dark:bg-primary-900/30 dark:text-primary-300" : "bg-zinc-100 dark:bg-zinc-800 text-zinc-800 dark:text-zinc-200"}`}
                  >
                    <option value="Active">Active</option>
                    <option value="Inactive">Inactive</option>
                  </select>
                </div>
              </div>
              <div className="flex items-center justify-end gap-3 pt-2 border-t border-zinc-100 dark:border-zinc-700">
                {userRole === "Admin" && (
                  <button
                    onClick={() => onOpenResetPassword(user.id)}
                    className="text-amber-600 hover:text-amber-800 dark:text-amber-400 dark:hover:text-amber-300 text-xs font-medium flex items-center gap-1"
                    title="Reset password for this user"
                  >
                    <KeyRound className="w-3.5 h-3.5" /> Reset
                  </button>
                )}
                {userRole === "Admin" && (
                  <button
                    onClick={() => setEditingPermissionsUserId(user.id)}
                    className="text-primary-600 hover:text-primary-800 dark:text-primary-400 dark:hover:text-primary-300 text-xs font-medium flex items-center gap-1"
                    title="Manage Permissions"
                  >
                    <Shield className="w-3.5 h-3.5" /> Permissions
                  </button>
                )}
                {userRole === "Admin" && !isCurrentUser && (
                  <button
                    onClick={() =>
                      setLocalSettings({
                        ...localSettings,
                        users: (localSettings.users || []).filter((u) => u.id !== user.id),
                      })
                    }
                    className="text-rose-600 hover:text-rose-900 dark:text-rose-400 dark:hover:text-rose-300 text-xs font-medium"
                  >
                    Remove
                  </button>
                )}
              </div>
            </div>
          );
        })}
      </div>

      <div className="flex justify-end pt-4 border-t border-zinc-100 dark:border-zinc-700">
        <button onClick={onSave} disabled={isSaved} className="flex items-center px-6 py-2 bg-primary-600 hover:bg-primary-700 text-white font-medium rounded-lg transition-colors disabled:bg-primary-400">
          {isSaved ? <Check className="w-5 h-5 mr-2" /> : <Save className="w-5 h-5 mr-2" />}
          {isSaved ? "Saved!" : "Save Changes"}
        </button>
      </div>

      {/* Permissions Modal */}
      {editingPermissionsUserId && editingUser && (
        <div className="fixed inset-0 bg-zinc-900/50 flex items-center justify-center p-4 z-50">
          <div className="bg-white dark:bg-zinc-800 rounded-2xl w-full max-w-md shadow-xl overflow-hidden max-h-[90vh] flex flex-col">
            <div className="px-6 py-4 border-b border-zinc-100 dark:border-zinc-700 flex justify-between items-center bg-zinc-50 dark:bg-zinc-900/50 shrink-0">
              <h3 className="text-lg font-bold text-zinc-900 dark:text-white flex items-center gap-2">
                <Shield className="w-5 h-5 text-primary-600" /> 
                Permissions: {editingUser.name}
              </h3>
              <button onClick={() => setEditingPermissionsUserId(null)} className="text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-300"><X className="w-5 h-5" /></button>
            </div>
            <div className="p-6 overflow-y-auto space-y-4">
              <p className="text-sm text-zinc-500 dark:text-zinc-400">
                Configure specific access rights for this user. These override default role permissions.
              </p>
              
              <div className="space-y-3">
                {PERMISSIONS_CONFIG.map(({ key, label, desc }) => {
                  const isChecked = editingUser.permissions?.[key] ?? getDefaultPermission(editingUser.role, key);
                  return (
                    <label key={key} className="flex items-start gap-3 p-3 rounded-lg border border-zinc-200 dark:border-zinc-700 hover:bg-zinc-50 dark:hover:bg-zinc-800/50 cursor-pointer transition-colors">
                      <div className="flex items-center h-5">
                        <input
                          type="checkbox"
                          checked={!!isChecked}
                          onChange={() => handleTogglePermission(key)}
                          className="w-4 h-4 rounded border-zinc-300 text-primary-600 focus:ring-primary-500"
                        />
                      </div>
                      <div className="flex flex-col">
                        <span className="text-sm font-medium text-zinc-900 dark:text-white">{label}</span>
                        {desc && <span className="text-xs text-zinc-500 dark:text-zinc-400">{desc}</span>}
                      </div>
                    </label>
                  );
                })}
              </div>
            </div>
            <div className="p-4 border-t border-zinc-100 dark:border-zinc-700 flex justify-end shrink-0 bg-white dark:bg-zinc-800">
              <button onClick={() => setEditingPermissionsUserId(null)} className="px-4 py-2 bg-primary-600 text-white font-medium hover:bg-primary-700 rounded-lg transition-colors">
                Done
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
