import { redirect } from "next/navigation";
import { getAuthState } from "@/lib/auth";
import { isAdminRole } from "@/lib/types";
import { AdminShell } from "./AdminShell";

/**
 * Root server layout for the administrative back-office.
 *
 * NOTE: (§3.4, §8.1) Enforces staff role authorization and TOTP AAL2 satisfaction before rendering admin sub-routes.
 */
export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const state = await getAuthState();
  if (!state || !isAdminRole(state.user.role)) redirect("/auth/login");
  if (state.hasFactor && !state.mfaSatisfied) redirect("/auth/login");

  return <AdminShell>{children}</AdminShell>;
}

