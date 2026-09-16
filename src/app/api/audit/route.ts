import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { getSessionUser } from "@/lib/auth";
import { listAudit } from "@/lib/auditLogger";
import { isAdminRole, MANAGER_VISIBLE_AUDIT_ACTIONS } from "@/lib/types";

/**
 * Paginated audit trail query endpoint with role-based filtering.
 *
 * NOTE: (§2.7, §8.1) Returns full audit logs for OWNER and scoped order/financial actions (with redacted IPs) for MANAGER.
 */

const querySchema = z.object({
  action: z.string().trim().max(40).optional(),
  q: z.string().trim().max(100).optional(),
  cursor: z.string().trim().max(64).optional(),
});

export async function GET(request: NextRequest) {
  const user = await getSessionUser();
  if (!user || !isAdminRole(user.role)) {
    return NextResponse.json({ error: "Access denied" }, { status: 403 });
  }
  const visibleActions = user.role === "OWNER" ? undefined : MANAGER_VISIBLE_AUDIT_ACTIONS;

  const params = request.nextUrl.searchParams;
  const parsed = querySchema.safeParse({
    action: params.get("action") || undefined,
    q: params.get("q") || undefined,
    cursor: params.get("cursor") || undefined,
  });
  if (!parsed.success) {
    return NextResponse.json({ error: "Malformed request" }, { status: 400 });
  }

  return NextResponse.json(
    await listAudit({
      action: parsed.data.action,
      search: parsed.data.q,
      cursor: parsed.data.cursor,
      visibleActions,
    }),
  );
}

