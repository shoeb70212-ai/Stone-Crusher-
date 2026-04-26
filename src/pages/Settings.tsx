import React, { useState } from "react";
import { useErp } from "../context/ErpContext";
import { Building2, Users, Receipt, Save, Check, Palette, Truck } from "lucide-react";

export function Settings() {
  const { userRole, companySettings, updateCompanySettings, vehicles, updateVehicle } = useErp();
  const [activeTab, setActiveTab] = useState<"general" | "categories" | "users" | "materials" | "appearance" | "vehicles" | "invoicing">(
    "general",
  );
  const [isSaved, setIsSaved] = useState(false);

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

  const [materials, setMaterials] = useState([
    {
      id: 1,
      name: "10mm",
      defaultPrice: 450,
      unit: "Ton",
      hsnCode: "25171010",
      gstRate: 5,
    },
    {
      id: 2,
      name: "20mm",
      defaultPrice: 480,
      unit: "Ton",
      hsnCode: "25171010",
      gstRate: 5,
    },
    {
      id: 3,
      name: "40mm",
      defaultPrice: 400,
      unit: "Ton",
      hsnCode: "25171010",
      gstRate: 5,
    },
    {
      id: 4,
      name: "Dust",
      defaultPrice: 350,
      unit: "Ton",
      hsnCode: "25171010",
      gstRate: 5,
    },
    {
      id: 5,
      name: "GSB",
      defaultPrice: 300,
      unit: "Ton",
      hsnCode: "25171020",
      gstRate: 5,
    },
    {
      id: 6,
      name: "Boulders",
      defaultPrice: 250,
      unit: "Ton",
      hsnCode: "25169090",
      gstRate: 5,
    },
  ]);

  const [users, setUsers] = useState([
    {
      id: 1,
      name: "Admin User",
      email: "admin@crushtrack.com",
      role: "Admin",
      status: "Active",
    },
    {
      id: 2,
      name: "Operations Manager",
      email: "manager@crushtrack.com",
      role: "Manager",
      status: "Active",
    },
    {
      id: 3,
      name: "Sales Partner",
      email: "partner@crushtrack.com",
      role: "Partner",
      status: "Active",
    },
  ]);

  const handleSave = () => {
    updateCompanySettings(localSettings);
    setIsSaved(true);
    setTimeout(() => setIsSaved(false), 2000);
  };

  return (
    <div className="space-y-6 max-w-5xl">
      <div>
        <h2 className="text-xl md:text-xl md:text-2xl font-bold font-display text-zinc-900 dark:text-white tracking-tight">
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
          onClick={() => setActiveTab("vehicles")}
          className={`flex items-center px-4 py-3 text-sm font-medium border-b-2 transition-colors ${
            activeTab === "vehicles"
              ? "border-primary-500 text-primary-600 dark:text-primary-400"
              : "border-transparent text-zinc-500 dark:text-zinc-400 hover:text-zinc-700 dark:text-zinc-200 dark:hover:text-zinc-200 hover:border-zinc-300 dark:border-zinc-600"
          }`}
        >
          <Truck className="w-4 h-4 mr-2" />
          Vehicles
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
            
            <div className="md:p-6 pb-0">
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

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 md:p-6 md:pt-4">
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
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 md:p-6">
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
              <button className="text-sm font-medium text-primary-600 hover:text-primary-700 bg-primary-50 px-4 py-2 rounded-lg transition-colors">
                + Invite User
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
                <tbody className="divide-y divide-zinc-100">
                  {users.map((user) => (
                    <tr key={user.id} className="hover:bg-zinc-50 dark:hover:bg-zinc-800">
                      <td className="py-3 px-4 font-medium text-zinc-900 dark:text-white">
                        {user.name}
                      </td>
                      <td className="py-3 px-4 text-zinc-500 dark:text-zinc-400">{user.email}</td>
                      <td className="py-3 px-4">
                        <select
                          className="border border-zinc-300 dark:border-zinc-600 rounded px-2 py-1 text-sm bg-white dark:bg-zinc-800 outline-none focus:border-primary-500"
                          value={user.role}
                          onChange={(e) => {
                            const newUsers = users.map((u) =>
                              u.id === user.id
                                ? { ...u, role: e.target.value }
                                : u,
                            );
                            setUsers(newUsers);
                          }}
                        >
                          <option value="Admin">Admin</option>
                          <option value="Manager">Manager</option>
                          <option value="Partner">Partner</option>
                        </select>
                      </td>
                      <td className="py-3 px-4">
                        <span
                          className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${user.status === "Active" ? "bg-primary-100 text-primary-800" : "bg-zinc-100 dark:bg-zinc-800 text-zinc-800 dark:text-zinc-200"}`}
                        >
                          {user.status}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-right">
                        <button className="text-indigo-600 hover:text-indigo-900 text-sm font-medium">
                          Edit
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {activeTab === "materials" && (
          <div className="space-y-6">
            <div className="flex justify-between items-center">
              <h3 className="text-lg font-semibold text-zinc-900 dark:text-white">
                Materials & Pricing
              </h3>
              <button className="text-sm font-medium text-primary-600 hover:text-primary-700 bg-primary-50 px-4 py-2 rounded-lg transition-colors">
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
                    <th className="py-3 px-4 text-sm font-semibold text-zinc-600 dark:text-zinc-300 text-right">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-100">
                  {materials.map((material) => (
                    <tr key={material.id} className="hover:bg-zinc-50 dark:hover:bg-zinc-800">
                      <td className="py-3 px-4 font-medium text-zinc-900 dark:text-white">
                        {material.name}
                      </td>
                      <td className="py-3 px-4">
                        <input
                          type="number"
                          value={material.defaultPrice}
                          onChange={(e) => {
                            const newMats = materials.map((m) =>
                              m.id === material.id
                                ? { ...m, defaultPrice: Number(e.target.value) }
                                : m,
                            );
                            setMaterials(newMats);
                          }}
                          className="w-24 border border-zinc-300 dark:border-zinc-600 rounded px-2 py-1 text-sm outline-none focus:border-primary-500"
                        />
                      </td>
                      <td className="py-3 px-4 text-zinc-500 dark:text-zinc-400">
                        {material.unit}
                      </td>
                      <td className="py-3 px-4">
                        <input
                          type="text"
                          value={material.hsnCode}
                          onChange={(e) => {
                            const newMats = materials.map((m) =>
                              m.id === material.id
                                ? { ...m, hsnCode: e.target.value }
                                : m,
                            );
                            setMaterials(newMats);
                          }}
                          className="w-24 border border-zinc-300 dark:border-zinc-600 rounded px-2 py-1 text-sm outline-none focus:border-primary-500"
                        />
                      </td>
                      <td className="py-3 px-4">
                        <input
                          type="number"
                          value={material.gstRate}
                          onChange={(e) => {
                            const newMats = materials.map((m) =>
                              m.id === material.id
                                ? { ...m, gstRate: Number(e.target.value) }
                                : m,
                            );
                            setMaterials(newMats);
                          }}
                          className="w-16 border border-zinc-300 dark:border-zinc-600 rounded px-2 py-1 text-sm outline-none focus:border-primary-500"
                        />
                      </td>
                      <td className="py-3 px-4 text-right">
                        <button className="text-rose-600 hover:text-rose-900 text-sm font-medium">
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
        {activeTab === "vehicles" && (
          <div className="space-y-6">
            <h3 className="text-lg font-semibold text-zinc-900 dark:text-white">
              Vehicles & Drivers
            </h3>
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-zinc-50 dark:bg-zinc-900/50 border-y border-zinc-200 dark:border-zinc-700">
                    <th className="py-3 px-4 text-sm font-semibold text-zinc-600 dark:text-zinc-300">
                      Vehicle No
                    </th>
                    <th className="py-3 px-4 text-sm font-semibold text-zinc-600 dark:text-zinc-300">
                      Owner Info
                    </th>
                    <th className="py-3 px-4 text-sm font-semibold text-zinc-600 dark:text-zinc-300">
                      Driver Info
                    </th>
                    <th className="py-3 px-4 text-sm font-semibold text-zinc-600 dark:text-zinc-300">
                      Default Measurement
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-100 dark:divide-zinc-700/50">
                  {vehicles.map((vehicle) => (
                    <tr key={vehicle.id} className="hover:bg-zinc-50 dark:hover:bg-zinc-800">
                      <td className="py-3 px-4 font-semibold text-zinc-900 dark:text-white">
                        {vehicle.vehicleNo}
                      </td>
                      <td className="py-3 px-4 space-y-2">
                        <input
                          type="text"
                          value={vehicle.ownerName || ""}
                          placeholder="Owner Name"
                          onChange={(e) => updateVehicle({ ...vehicle, ownerName: e.target.value })}
                          className="w-full max-w-[200px] border border-zinc-300 dark:border-zinc-600 rounded px-3 py-1.5 text-sm outline-none focus:border-primary-500 bg-white dark:bg-zinc-900 text-zinc-900 dark:text-white block"
                        />
                        <input
                          type="text"
                          value={vehicle.ownerPhone || ""}
                          placeholder="Owner Phone"
                          onChange={(e) => updateVehicle({ ...vehicle, ownerPhone: e.target.value })}
                          className="w-full max-w-[200px] border border-zinc-300 dark:border-zinc-600 rounded px-3 py-1.5 text-sm outline-none focus:border-primary-500 bg-white dark:bg-zinc-900 text-zinc-900 dark:text-white block"
                        />
                      </td>
                      <td className="py-3 px-4 space-y-2">
                        <input
                          type="text"
                          value={vehicle.driverName || ""}
                          placeholder="Driver Name"
                          onChange={(e) => updateVehicle({ ...vehicle, driverName: e.target.value })}
                          className="w-full max-w-[200px] border border-zinc-300 dark:border-zinc-600 rounded px-3 py-1.5 text-sm outline-none focus:border-primary-500 bg-white dark:bg-zinc-900 text-zinc-900 dark:text-white block"
                        />
                        <input
                          type="text"
                          value={vehicle.driverPhone || ""}
                          placeholder="Driver Phone"
                          onChange={(e) => updateVehicle({ ...vehicle, driverPhone: e.target.value })}
                          className="w-full max-w-[200px] border border-zinc-300 dark:border-zinc-600 rounded px-3 py-1.5 text-sm outline-none focus:border-primary-500 bg-white dark:bg-zinc-900 text-zinc-900 dark:text-white block"
                        />
                      </td>
                      <td className="py-3 px-4 text-zinc-500 dark:text-zinc-400 text-sm">
                        {vehicle.defaultMeasurementType}
                      </td>
                    </tr>
                  ))}
                  {vehicles.length === 0 && (
                    <tr>
                      <td colSpan={4} className="py-8 text-center text-zinc-500 dark:text-zinc-400">
                        No vehicles found. Add one from Dispatch.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
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
  );
}
