"use client";

import { useRouter } from "next/navigation";
import { AdminHeader } from "./AdminHeader";

/**
 * Client-side shell wrapper managing admin logout navigation and structural chrome.
 *
 * NOTE: (§3.4, §8.1) Provides unified typography and layout container for admin pages.
 */
export function AdminShell({ children }: { children: React.ReactNode }) {
  const router = useRouter();

  const handleLogout = async () => {
    await fetch("/api/auth/logout", { method: "DELETE" });
    router.push("/auth/login");
  };

  return (
    <main className="min-h-screen bg-[#F5F5F5] text-black font-[family-name:var(--font-montserrat)]">
      <AdminHeader onLogout={handleLogout} />
      {children}
    </main>
  );
}

