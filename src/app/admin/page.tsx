import { redirect } from "next/navigation";

/**
  * Default entry point for admin panel redirecting to products management.
  *
  * NOTE: (§8.1) Directs authenticated staff to catalog management by default.
  */
export default function AdminPage() {
  redirect("/admin/products");
}

