import { redirect } from "next/navigation";

/**
 * Legacy admin login URL redirecting to unified `/auth/login`.
 *
 * NOTE: (§3.4, §8.1) Preserves bookmark backwards compatibility.
 */
export default function LegacyAdminLoginPage() {
  redirect("/auth/login");
}

