import { supabase } from "./supabase";
import { clearBiometricCredentials } from "./biometrics";

/** Signs the current user out of Supabase Auth and clears all local state. */
export async function clearAuthSession(): Promise<void> {
  await supabase.auth.signOut();
  localStorage.removeItem("erp_auth_token");
  localStorage.removeItem("erp_user_role");
  await clearBiometricCredentials();
}
