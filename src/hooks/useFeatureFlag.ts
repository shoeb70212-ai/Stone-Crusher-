import { useErp } from '../context/ErpContext';

/**
 * Reads a feature flag from companySettings.flags.
 * Returns false if the flag is absent.
 */
export function useFeatureFlag(key: string): boolean {
  const { companySettings } = useErp();
  return companySettings.flags?.[key] ?? false;
}
