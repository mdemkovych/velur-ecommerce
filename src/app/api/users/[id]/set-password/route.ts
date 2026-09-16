import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireOwner } from "@/lib/auth";
import { getSupabaseAdminClient } from "@/lib/supabase";
import { clientIp, logAudit } from "@/lib/auditLogger";

/**
 * Owner-assisted password reset endpoint for staff members.
 *
 * NOTE: (§8.1) Allows OWNER to set a new password directly on staff accounts via Supabase Admin API.
 * Disallows setting own owner password to prevent lockout vulnerabilities.
 */

const bodySchema = z.object({
  password: z.string().min(8, "A password must be at least 8 characters").max(72),
});

export async function POST(request: Request, props: { params: Promise<{ id: string }> }) {
  const owner = await requireOwner();
  if (!owner) {
    return NextResponse.json({ error: "Only the owner may change passwords" }, { status: 403 });
  }

  const { id } = await props.params;
  if (id === owner.id) {
    return NextResponse.json(
      { error: "Your own password is changed in the Supabase dashboard, not here." },
      { status: 400 },
    );
  }

  const parsed = bodySchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Malformed password" },
      { status: 400 },
    );
  }

  const target = await prisma.appUser.findUnique({ where: { id } });
  if (!target) {
    return NextResponse.json({ error: "User not found" }, { status: 404 });
  }

  const { error } = await getSupabaseAdminClient().auth.admin.updateUserById(id, {
    password: parsed.data.password,
  });
  if (error) {
    console.error("Password set failed:", error);
    return NextResponse.json({ error: `The password could not be changed: ${error.message}` }, {
      status: 502,
    });
  }

  // NOTE: (§2.7) Audit entry records action and target email; password content is strictly excluded.
  await logAudit({
    actor: owner.id,
    action: "USER_PASSWORD_SET",
    target: target.email,
    ip: clientIp(request),
  });

  return NextResponse.json({ ok: true });
}

