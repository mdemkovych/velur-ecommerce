import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { listTeam } from "@/lib/db";
import { requireAdmin, requireOwner } from "@/lib/auth";
import { getSupabaseAdminClient } from "@/lib/supabase";
import { clientIp, logAudit } from "@/lib/auditLogger";
import { userSchema } from "@/lib/validation";

/**
 * Staff team accounts collection endpoint.
 *
 * NOTE: (§3.4, §8.1) Provides team listing for staff (GET) and atomic staff account provisioning for the OWNER (POST)
 * across Supabase Auth and PostgreSQL app_users table with automatic credential rollback on profile failure.
 */

export async function GET() {
  if (!(await requireAdmin())) {
    return NextResponse.json({ error: "Access denied" }, { status: 403 });
  }

  return NextResponse.json(await listTeam());
}

/** NOTE: (§8.1) Owner-restricted endpoint provisioning new staff accounts. */
export async function POST(request: Request) {
  const owner = await requireOwner();
  if (!owner) {
    return NextResponse.json(
      { error: "Only the owner may add users" },
      { status: 403 },
    );
  }

  const parsed = userSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Malformed user data" },
      { status: 400 },
    );
  }

  const { name, email, password, role } = parsed.data;
  const normalisedEmail = email.trim().toLowerCase();

  if (await prisma.appUser.findUnique({ where: { email: normalisedEmail } })) {
    return NextResponse.json({ error: "A user with that email already exists" }, { status: 409 });
  }

  const admin = getSupabaseAdminClient();
  const { data, error } = await admin.auth.admin.createUser({
    email: normalisedEmail,
    password,
    // NOTE: (§3.4) Created confirmed: an owner adding a colleague is the confirmation.
    email_confirm: true,
  });

  if (error || !data.user) {
    console.error("Supabase user creation failed:", error);
    return NextResponse.json(
      { error: "The account could not be created. Try again or check the email address." },
      { status: 502 },
    );
  }

  let user;
  try {
    user = await prisma.appUser.create({
      data: { id: data.user.id, email: normalisedEmail, name, role },
    });
  } catch (err) {
    // NOTE: (§3.4) Rolls the Auth credential back, so no address can sign in and reach no profile.
    await admin.auth.admin.deleteUser(data.user.id).catch(() => {});
    console.error("Profile creation failed, credential rolled back:", err);
    return NextResponse.json({ error: "The account could not be created" }, { status: 500 });
  }

  await logAudit({
    actor: owner.id,
    action: "USER_CREATED",
    target: user.id,
    ip: clientIp(request),
    details: { email: user.email, role: user.role },
  });

  return NextResponse.json(user, { status: 201 });
}

