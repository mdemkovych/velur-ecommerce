import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { syncEntity, type NpEntity } from "../src/lib/novaposhtaSync";

/**
 * Refills the local Nova Poshta directory, by hand.
 *
 *   npm run sync-novaposhta
 *
 * `/api/cron/sync-novaposhta` does this on a schedule and shares every line of
 * the work; this stays for a first fill and a forced refresh (§5.3).
 *
 * The one difference is the deadline. The route stops at the edge of its
 * function limit and lets the next invocation continue; here there is nothing to
 * stop at, so a run started is a run finished, which for the branch list means
 * minutes rather than seconds.
 *
 * Runs against `DIRECT_URL`, the session pooler, for the same reason the route
 * does: bulk loading has no business on the pool the shop serves requests from.
 */

function requireEnv(name: string): string {
  const value = process.env[name]?.trim();
  if (!value) {
    console.error(`${name} is not set — cannot sync the Nova Poshta directory`);
    process.exit(1);
  }
  return value;
}

const apiKey = requireEnv("NOVA_POSHTA_API_KEY");
const prisma = new PrismaClient({
  adapter: new PrismaPg({ connectionString: requireEnv("DIRECT_URL") }),
});

const ENTITIES: NpEntity[] = ["cities", "warehouses"];

async function main() {
  console.log("Refreshing the Nova Poshta directory\n");

  for (const entity of ENTITIES) {
    const label = entity === "cities" ? "cities" : "branches";
    const result = await syncEntity(prisma, entity, {
      apiKey,
      onProgress: (message) => process.stdout.write(`\r  ${message}`),
    });
    process.stdout.write(`\r  ${label}: ${result.total} rows\n`);
  }

  console.log("\nDone.");
}

main()
  .catch((err) => {
    console.error("\nThe sync failed:", err);
    process.exit(1);
  })
  .finally(() => void prisma.$disconnect());
