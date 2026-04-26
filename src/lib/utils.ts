import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/**
 * Parses a feet.inches notation commonly used in the stone crusher industry.
 * Workers enter "5.6" to mean 5 feet 6 inches (not 5.6 feet).
 * This converts that to decimal feet: 5 + (6/12) = 5.5 feet.
 */
export function parseFeetInches(val: string | number): number {
  if (!val) return 0;
  const parts = val.toString().split('.');
  const feet = parseInt(parts[0], 10) || 0;
  if (parts.length > 1) {
    const inchesStr = parts[1];
    const inches = parseInt(inchesStr, 10) || 0;
    return feet + (inches / 12);
  }
  return feet;
}
