import { createClient } from "@supabase/supabase-js";
import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import crypto from "node:crypto";

/**
 * Creates the first OWNER, once.
 *
 *   npm run create-owner -- owner@example.com "Name"
 *
 * The panel has no registration form and must not gain one (§3.4), so
 * bootstrapping is an operator task run from a terminal with the service-role
 * key. Refuses to run while an active OWNER exists, which is what stops it being
 * a way to escalate later.
 */

const [email, name] = process.argv.slice(2);
if (!email || !name) {
  console.error('Usage: npm run create-owner -- <email> "<name>"');
  process.exit(1);
}

const prisma = new PrismaClient({
  adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL }),
});

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { persistSession: false, autoRefreshToken: false } },
);

/** Long, random, and printed once: nothing here stores it. */
function generatePassword(): string {
  return crypto.randomBytes(18).toString("base64url");
}

async function main() {
  const existing = await prisma.appUser.count({ where: { role: "OWNER", isActive: true } });
  if (existing > 0) {
    console.error(`An active OWNER already exists (${existing}). This script does nothing.`);
    process.exit(1);
  }

  const normalised = email.trim().toLowerCase();
  const password = generatePassword();

  const { data, error } = await supabase.auth.admin.createUser({
    email: normalised,
    password,
    email_confirm: true,
  });
  if (error || !data.user) throw error ?? new Error("Supabase did not return a user");

  await prisma.appUser.create({
    data: { id: data.user.id, email: normalised, name, role: "OWNER" },
  });

  console.log("\nOwner created.\n");
  console.log(`  Login:    ${normalised}`);
  console.log(`  Password: ${password}\n`);
  console.log("Save the password in a password manager — it is never shown again.");
}

main()
  .then(() => prisma.$disconnect())
  .catch(async (err) => {
    console.error(err);
    await prisma.$disconnect();
    process.exit(1);
  });
