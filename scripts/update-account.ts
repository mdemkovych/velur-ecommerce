import { createClient } from "@supabase/supabase-js";
import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";

/**
 * Changes a staff account's sign-in address, display name, or both.
 *
 *   npm run update-account -- <current@address> --name "First Last"
 *   npm run update-account -- <current@address> --email new@address
 *
 * The address lives in two stores that must not drift, and the display name is
 * what the journal prints beside every action (§3.4). Both are written here, in
 * that order: Supabase Auth first, because a failure there must leave the shop's
 * own row untouched.
 */

const [target, ...rest] = process.argv.slice(2);

function flag(name: string): string | undefined {
  const i = rest.indexOf(`--${name}`);
  return i >= 0 ? rest[i + 1] : undefined;
}

const nextEmail = flag("email")?.trim().toLowerCase();
const nextName = flag("name")?.trim();

if (!target || (!nextEmail && !nextName)) {
  console.error(
    'Usage: npm run update-account -- <current@address> [--email new@address] [--name "Name"]',
  );
  process.exit(1);
}

function requireEnv(name: string): string {
  const value = process.env[name]?.trim();
  if (!value) {
    console.error(`${name} is not set`);
    process.exit(1);
  }
  return value;
}

const prisma = new PrismaClient({
  adapter: new PrismaPg({ connectionString: requireEnv("DATABASE_URL") }),
});

async function main() {
  const current = target.trim().toLowerCase();

  const account = await prisma.appUser.findUnique({ where: { email: current } });
  if (!account) {
    console.error(`No account with the address ${current}`);
    process.exit(1);
  }

  console.log(`${account.name} <${account.email}> — ${account.role}`);
  if (nextName) console.log(`  name:  ${account.name}  →  ${nextName}`);
  if (nextEmail) console.log(`  email: ${account.email}  →  ${nextEmail}`);
  console.log();

  if (nextEmail && nextEmail !== current) {
    if (await prisma.appUser.findUnique({ where: { email: nextEmail } })) {
      console.error(`The address ${nextEmail} already belongs to another account`);
      process.exit(1);
    }

    /*
     * `email_confirm: true` because an operator is setting an address they
     * already know is real. Without it Supabase keeps the old one live until
     * somebody clicks a link sent to the new: a sensible default for a person
     * changing their own address, and pointless ceremony for this.
     */
    const supabase = createClient(
      requireEnv("SUPABASE_URL"),
      requireEnv("SUPABASE_SERVICE_ROLE_KEY"),
      { auth: { persistSession: false, autoRefreshToken: false } },
    );
    const { error } = await supabase.auth.admin.updateUserById(account.id, {
      email: nextEmail,
      email_confirm: true,
    });
    if (error) {
      console.error("Supabase refused:", error.message);
      console.error("Nothing was changed.");
      process.exit(1);
    }
    console.log("Supabase Auth — address updated");
  }

  try {
    await prisma.appUser.update({
      where: { id: account.id },
      data: {
        ...(nextEmail ? { email: nextEmail } : {}),
        ...(nextName ? { name: nextName } : {}),
      },
    });
    console.log("app_users — updated\n");
  } catch (err) {
    console.error("\napp_users was NOT updated:", err);
    if (nextEmail) {
      console.error(
        `WARNING: sign-in is now ${nextEmail}, but the shop still knows ${current}. ` +
          "Fix the app_users row by hand, or put the address back in Supabase.",
      );
    }
    process.exit(1);
  }

  if (nextEmail) {
    console.log(`Sign-in is now ${nextEmail}; the password is unchanged.`);
    console.log("Two-factor sign-in is unchanged: the factor belongs to the account, not to the address.");
  }
  if (nextName) {
    console.log(`The journal now signs actions with the name «${nextName}».`);
    console.log("Entries written earlier too: the name comes from the account rather than being copied into the row.");
  }
}

main()
  .catch((err) => {
    console.error("It did not work:", err);
    process.exit(1);
  })
  .finally(() => void prisma.$disconnect());
