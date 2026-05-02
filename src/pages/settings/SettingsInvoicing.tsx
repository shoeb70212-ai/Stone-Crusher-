import React from "react";
import { Save, Check } from "lucide-react";
import { CompanySettings } from "../../types";

interface Props {
  localSettings: CompanySettings;
  setLocalSettings: (s: CompanySettings) => void;
  isSaved: boolean;
  onSave: () => void;
}

export function SettingsInvoicing({ localSettings, setLocalSettings, isSaved, onSave }: Props) {
  const upd = (patch: Partial<CompanySettings>) => setLocalSettings({ ...localSettings, ...patch });

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center mb-4">
        <h3 className="text-lg font-semibold text-zinc-900 dark:text-white">Invoicing Configuration</h3>
        <button onClick={onSave} className="bg-primary-600 hover:bg-primary-700 text-white px-4 py-2 rounded-lg font-medium flex items-center transition-colors">
          {isSaved ? <Check className="w-5 h-5 mr-2" /> : <Save className="w-5 h-5 mr-2" />}
          {isSaved ? "Saved" : "Save Changes"}
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div>
          <label htmlFor="inv-show-due-date" className="block text-sm font-medium text-zinc-700 dark:text-zinc-200 mb-1">Show Due Date on Invoice</label>
          <select
            id="inv-show-due-date"
            value={localSettings.invoiceShowDueDate ? "true" : "false"}
            onChange={(e) => upd({ invoiceShowDueDate: e.target.value === "true" })}
            className="w-full border border-zinc-300 dark:border-zinc-600 rounded-lg px-4 py-2 focus:ring-2 focus:ring-primary-500 outline-none transition-shadow bg-transparent dark:text-white"
          >
            <option value="true">Yes</option>
            <option value="false">No</option>
          </select>
        </div>

        <div>
          <label htmlFor="inv-watermark" className="block text-sm font-medium text-zinc-700 dark:text-zinc-200 mb-1">Invoice Watermark Type</label>
          <select
            id="inv-watermark"
            value={localSettings.invoiceWatermark || "None"}
            onChange={(e) => upd({ invoiceWatermark: e.target.value as any })}
            className="w-full border border-zinc-300 dark:border-zinc-600 rounded-lg px-4 py-2 focus:ring-2 focus:ring-primary-500 outline-none transition-shadow bg-transparent dark:text-white"
          >
            <option value="None">None</option>
            <option value="Company Name">Company Name</option>
            <option value="Status">Invoice Status (e.g. PENDING)</option>
            <option value="Custom">Custom Text</option>
          </select>
        </div>

        {localSettings.invoiceWatermark === "Custom" && (
          <div>
            <label htmlFor="inv-watermark-text" className="block text-sm font-medium text-zinc-700 dark:text-zinc-200 mb-1">Custom Watermark Text</label>
            <input
              id="inv-watermark-text"
              type="text"
              value={localSettings.invoiceWatermarkText || ""}
              onChange={(e) => upd({ invoiceWatermarkText: e.target.value })}
              placeholder="Enter watermark text"
              className="w-full border border-zinc-300 dark:border-zinc-600 rounded-lg px-4 py-2 focus:ring-2 focus:ring-primary-500 outline-none transition-shadow bg-transparent dark:text-white"
            />
          </div>
        )}

        <div>
          <label htmlFor="inv-color" className="block text-sm font-medium text-zinc-700 dark:text-zinc-200 mb-1">Invoice Theme Color</label>
          <div className="flex items-center space-x-3">
            <input
              id="inv-color"
              type="color"
              value={localSettings.invoiceColor || "#000000"}
              onChange={(e) => upd({ invoiceColor: e.target.value })}
              className="w-10 h-10 rounded cursor-pointer border-0 p-0 bg-transparent"
            />
            <span className="text-sm text-zinc-500 dark:text-zinc-400 font-mono">{localSettings.invoiceColor || "#000000"}</span>
          </div>
        </div>

        <div>
          <label htmlFor="inv-template" className="block text-sm font-medium text-zinc-700 dark:text-zinc-200 mb-1">Invoice Template</label>
          <select
            id="inv-template"
            value={localSettings.invoiceTemplate || "Classic"}
            onChange={(e) => upd({ invoiceTemplate: e.target.value as any })}
            className="w-full border border-zinc-300 dark:border-zinc-600 rounded-lg px-4 py-2 focus:ring-2 focus:ring-primary-500 outline-none transition-shadow bg-transparent dark:text-white"
          >
            <option value="Classic">Classic</option>
            <option value="Modern">Modern</option>
            <option value="Minimal">Minimal</option>
          </select>
          <p className="mt-1 text-xs text-zinc-500">Choose the aesthetic design for PDF generation.</p>
        </div>
      </div>

      <div className="mt-6 border-t border-zinc-200 dark:border-zinc-700 pt-6">
        <label htmlFor="inv-terms" className="block text-sm font-medium text-zinc-700 dark:text-zinc-200 mb-2">Terms and Conditions</label>
        <textarea
          id="inv-terms"
          value={localSettings.termsAndConditions || ""}
          onChange={(e) => upd({ termsAndConditions: e.target.value })}
          rows={5}
          placeholder="Enter the terms and conditions to be printed on the invoice (one per line)..."
          className="w-full border border-zinc-300 dark:border-zinc-600 rounded-lg px-4 py-2 focus:ring-2 focus:ring-primary-500 outline-none transition-shadow bg-transparent dark:text-white resize-y"
        />
        <p className="mt-2 text-xs text-zinc-500">These terms will be displayed at the bottom of the A4 Tax Invoice.</p>
      </div>
    </div>
  );
}
