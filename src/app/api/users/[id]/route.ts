import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireOwner } from "@/lib/auth";
import { clientIp, logAudit } from "@/lib/auditLogger";

const patchSchema = z.object({ isActive: z.boolean() });

/**
 * Staff member activation and deactivation endpoint.
 *
 * NOTE: (§8.1) Owner-only PATCH endpoint implementing soft activation toggling (isActive) rather than hard deletion to preserve audit trail integrity.
 */
export async function PATCH(request: Request, props: { params: Promise<{ id: string }> }) {
  const owner = await requireOwner();
  if (!owner) {
    return NextResponse.json(
      { error: "Only the owner may change access" },
      { status: 403 },
    );
  }

  const { id } = await props.params;
  const parsed = patchSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "Malformed data" }, { status: 400 });
  }

  const target = await prisma.appUser.findUnique({ where: { id } });
  if (!target) {
    return NextResponse.json({ error: "User not found" }, { status: 404 });
  }
  if (target.id === owner.id) {
    return NextResponse.json(
      { error: "You cannot deactivate your own account" },
      { status: 400 },
    );
  }

  const { isActive } = parsed.data;
  const activeOwners = await prisma.appUser.count({ where: { role: "OWNER", isActive: true } });
  if (!isActive && target.role === "OWNER" && activeOwners <= 1) {
    return NextResponse.json(
      { error: "The last owner cannot be deactivated" },
      { status: 400 },
    );
  }

  // NOTE: (§8.1) Soft revoke preserving Supabase credential and historical audit references.
  const updated = await prisma.appUser.update({ where: { id }, data: { isActive } });

  await logAudit({
    actor: owner.id,
    action: isActive ? "USER_REACTIVATED" : "USER_DEACTIVATED",
    target: id,
    ip: clientIp(request),
  });

  return NextResponse.json({ id: updated.id, isActive: updated.isActive });
}

