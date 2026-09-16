import "server-only";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import type { SupabaseClient } from "@supabase/supabase-js";
import { hardenSessionCookie } from "./sessionCookie";

/**
 * Server-side Supabase client factory.
 *
 * NOTE: (§3.4) Supabase clients are instantiated strictly on the server;
 * public client-side Supabase bundle is omitted to prevent credential exposure.
 */

function requireEnv(name: string): string {
  const value = process.env[name]?.trim();
  if (!value) throw new Error(`${name} is not set — Supabase Auth cannot start`);
  return value;
}

/**
 * Creates a server client scoped to incoming request session cookies.
 *
 * @returns Authenticated Supabase client.
 */
export async function getSupabaseServerClient(): Promise<SupabaseClient> {
  const store = await cookies();

  return createServerClient(requireEnv("SUPABASE_URL"), requireEnv("SUPABASE_ANON_KEY"), {
    cookies: {
      getAll: () => store.getAll().map(({ name, value }) => ({ name, value })),
      setAll: (cookiesToSet) => {
        try {
          for (const { name, value, options } of cookiesToSet) {
            store.set(name, value, hardenSessionCookie(options));
          }
        } catch {
          // Next.js disallows setting cookies during Server Component rendering; proxy.ts handles refresh.
        }
      },
    },
  });
}

/**
 * Creates an unconstrained admin client with service_role privileges.
 *
 * NOTE: (§3.4) Bypasses RLS. Restricted to administrative user provisioning,
 * MFA reset, and bucket storage management.
 */
export function getSupabaseAdminClient(): SupabaseClient {
  return createServerClient(
    requireEnv("SUPABASE_URL"),
    requireEnv("SUPABASE_SERVICE_ROLE_KEY"),
    {
      cookies: { getAll: () => [], setAll: () => {} },
      auth: { persistSession: false, autoRefreshToken: false },
    },
  );
}

