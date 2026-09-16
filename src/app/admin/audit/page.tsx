import { redirect } from "next/navigation";
import { getSessionUser } from "@/lib/auth";
import { isAdminRole } from "@/lib/types";
import { AuditView } from "./AuditView";

/**
 * Server page loading audit trail view with role-specific data scoping.
 *
 * NOTE: (§8.1, §8.4) Authenticates staff and distinguishes between OWNER and MANAGER audit visibility.
 */
export default async function AdminAuditPage() {
  const user = await getSessionUser();
  if (!user || !isAdminRole(user.role)) redirect("/admin/products");
  return <AuditView isOwner={user.role === "OWNER"} />;
}

