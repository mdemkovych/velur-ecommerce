import "server-only";
import { prisma } from "../prisma";
import type { UserRole } from "../types";

/**
 * Staff team management query layer.
 *
 * NOTE: (§3.4, §8.1) Reads staff roles and activation status from app_users table.
 */
export interface TeamMember {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  isActive: boolean;
}

/**
 * Lists staff team members in order of account creation.
 *
 * @returns Array of TeamMember records.
 */
export async function listTeam(): Promise<TeamMember[]> {
  const rows = await prisma.appUser.findMany({ orderBy: { createdAt: "asc" } });

  return rows.map((row) => ({
    id: row.id,
    name: row.name,
    email: row.email,
    role: row.role as UserRole,
    isActive: row.isActive,
  }));
}
