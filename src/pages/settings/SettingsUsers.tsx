import React from "react";
import { Save, Check, Mail, Lock, KeyRound } from "lucide-react";
import { CompanySettings } from "../../types";
import { useErp } from "../../context/ErpContext";

interface Props {
  localSettings: CompanySettings;
  setLocalSettings: (s: CompanySettings) => void;
  isSaved: boolean;
  userRole: string;
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

      <div className="overflow-x-auto">
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
                      onChange={(e) => updUsers({ role: e.target.value as any })}
                      className="border border-zinc-300 dark:border-zinc-600 rounded px-2 py-1 text-sm bg-white dark:bg-zinc-800 outline-none focus:border-primary-500 dark:text-white"
                    >
                      <option value="Admin">Admin</option>
                      <option value="Manager">Manager</option>
                      <option value="Partner">Partner</option>
                    </select>
                  </td>
                  <td className="py-3 px-4">
                    <select value={user.status}
                      onChange={(e) => updUsers({ status: e.target.value as any })}
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

      <div className="flex justify-end pt-4 border-t border-zinc-100 dark:border-zinc-700">
        <button onClick={onSave} disabled={isSaved} className="flex items-center px-6 py-2 bg-primary-600 hover:bg-primary-700 text-white font-medium rounded-lg transition-colors disabled:bg-primary-400">
          {isSaved ? <Check className="w-5 h-5 mr-2" /> : <Save className="w-5 h-5 mr-2" />}
          {isSaved ? "Saved!" : "Save Changes"}
        </button>
      </div>
    </div>
  );
}
