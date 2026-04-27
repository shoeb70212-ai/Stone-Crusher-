import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/**
 * Parses a feet.inches notation commonly used in the stone crusher industry.
 * Workers enter "5.6" to mean 5 feet 6 inches (not 5.6 feet).
 * This converts that to decimal feet: 5 + (6/12) = 5.5 feet.
 *
 * Inches must be 0–11. A value ≥ 12 (e.g. "5.13") is clamped to 11 and
 * a console warning is emitted so billing is never silently inflated.
 */
export function parseFeetInches(val: string | number): number {
  if (!val) return 0;
  const parts = val.toString().split('.');
  const feet = parseInt(parts[0], 10) || 0;
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
