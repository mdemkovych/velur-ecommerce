import { listTeam } from "@/lib/db";
import { getSessionUser } from "@/lib/auth";
import { TeamView } from "./TeamView";

/**
 * Server page preloading team member accounts and caller session context.
 *
 * NOTE: (§3.4, §8.1) Authenticates staff session and renders team management interface.
 */
export default async function AdminTeamPage() {
  const [members, user] = await Promise.all([listTeam(), getSessionUser()]);

  return (
    <TeamView
      initialMembers={members}
      currentUser={user ? { id: user.id, role: user.role } : null}
    />
  );
}

