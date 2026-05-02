import { clearBiometricCredentials } from "./biometrics";
import { secureRemove } from "./secure-storage";

export async function clearAuthSession(): Promise<void> {
  await secureRemove("erp_auth_token");
  localStorage.removeItem("erp_auth_token");
  localStorage.removeItem("erp_user_role");
  await clearBiometricCredentials();
}
