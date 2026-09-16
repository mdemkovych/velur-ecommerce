import "server-only";
import { prisma } from "./prisma";
import { getSupabaseServerClient } from "./supabase";
import { ADMIN_ROLES, type UserRole } from "./types";

/**
 * Server-side authentication and authorization guards.
 *
 * NOTE: (§3.4, §8.1) Authenticates via Supabase Auth server client; authorizes roles and active
 * state strictly against app_users database table on every request.
 */

export interface SessionUser {
  id: string;
  email: string;
  name: string;
  role: UserRole;
}

export interface AuthState {
  user: SessionUser;
  /** True if user has registered a TOTP MFA factor. */
  hasFactor: boolean;
  /** True if current session achieved AAL2 assurance level. */
  mfaSatisfied: boolean;
}

/**
 * Evaluates current authentication, role, and MFA state.
 *
 * NOTE: (§3.4) Validates JWT token cryptographically via getUser() and reads role/isActive from app_users.
 *
 * @returns AuthState or null if session is invalid or user is deactivated.
 */
export async function getAuthState(): Promise<AuthState | null> {
  const supabase = await getSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const profile = await prisma.appUser.findUnique({ where: { id: user.id } });
  if (!profile || !profile.isActive) return null;

  const { data: aal } = await supabase.auth.mfa.getAuthenticatorAssuranceLevel();

  return {
    user: {
      id: profile.id,
      email: profile.email,
      name: profile.name,
      role: profile.role as UserRole,
    },
    hasFactor: aal?.nextLevel === "aal2",
    mfaSatisfied: aal?.currentLevel === "aal2",
  };
}

/**
 * Returns fully authenticated staff user with verified second factor (AAL2).
 *
 * NOTE: (§3.4) Demands both factor enrollment and verification.
 *
 * @returns Valid SessionUser or null.
 */
export async function getSessionUser(): Promise<SessionUser | null> {
  const state = await getAuthState();
  if (!state) return null;

  if (!state.hasFactor || !state.mfaSatisfied) return null;

  return state.user;
}

/**
 * Returns pending session user during initial password verification (AAL1).
 *
 * NOTE: (§3.4) Restricted to MFA enrollment and code verification endpoints.
 */
export async function getPendingSessionUser(): Promise<SessionUser | null> {
  return (await getAuthState())?.user ?? null;
}

/**
 * Enforces admin panel access rules (OWNER and MANAGER roles only).
 *
 * NOTE: (§8.1) Validates against explicit ADMIN_ROLES whitelist.
 */
export async function requireAdmin(): Promise<SessionUser | null> {
  const user = await getSessionUser();
  return user && ADMIN_ROLES.includes(user.role) ? user : null;
}

/**
 * Enforces OWNER role for sensitive administrative operations.
 */
export async function requireOwner(): Promise<SessionUser | null> {
  const user = await getSessionUser();
  return user?.role === "OWNER" ? user : null;
}

