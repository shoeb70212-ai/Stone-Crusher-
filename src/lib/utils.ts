import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";
import { ToWords } from "to-words";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/** Shared instance for converting amounts to Indian-English words (currency mode). */
export const toWords = new ToWords({
  localeCode: "en-IN",
  converterOptions: {
    currency: true,
    ignoreDecimal: false,
    ignoreZeroCurrency: false,
    doNotAddOnly: false,
    currencyOptions: {
      name: "Rupee",
      plural: "Rupees",
      symbol: "₹",
      fractionalUnit: { name: "Paisa", plural: "Paise", symbol: "" },
    },
  },
});

/**
 * Generates a unique ID safely across all browser contexts.
 * Falls back to a timestamp + random suffix when crypto.randomUUID is unavailable
 * (HTTP contexts, old browsers, etc.).
 */
export function generateId(): string {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }
  return `id_${Date.now()}_${Math.random().toString(36).slice(2, 11)}`;
}

/**
 * Parses a feet.inches notation commonly used in the stone crusher industry.
 * Workers enter "5.6" to mean 5 feet 6 inches (not 5.6 feet).
 * This converts that to decimal feet: 5 + (6/12) = 5.5 feet.
 *
 * Inches must be 0–11. A value ≥ 12 (e.g. "5.13") is clamped to 11 and
 * a console warning is emitted so billing is never silently inflated.
 *
 * Bounds: feet must be 0–100. Negative or oversized values return 0.
 */
export function parseFeetInches(val: string | number): number {
  if (!val && val !== 0) return 0;
  const str = val.toString().trim();
  if (!str) return 0;

  const parts = str.split('.');
  const feet = parseInt(parts[0], 10);
  if (!Number.isFinite(feet) || feet < 0 || feet > 100) {
    console.warn(`parseFeetInches: feet value "${feet}" out of range [0, 100] for input "${val}".`);
    return 0;
  }

  if (parts.length > 1) {
    const inchesStr = parts[1];
    const raw = parseInt(inchesStr, 10) || 0;
    if (raw >= 12) {
      console.warn(
        `parseFeetInches: inches value "${raw}" is ≥ 12 for input "${val}". ` +
        `Did you mean to enter decimal feet? Clamping to 11 inches to prevent billing inflation.`,
      );
    }
    const inches = Math.min(raw, 11);
    return feet + (inches / 12);
  }
  return feet;
}
