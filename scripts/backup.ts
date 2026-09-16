import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";

/**
 * A copy of everything the shop cannot be rebuilt without.
 *
 *   npm run backup
 *
 * Read-only: it writes nothing to the database and nothing to storage, and the
 * only thing it changes is a folder on this machine.
 *
 * It exists because the Supabase project is on the free plan, which offers
 * neither scheduled backups nor a download, leaving no restore path at all.
 * Check that in the dashboard before trusting it; plan terms move.
 *
 * It copies the photographs as well, which is the half a database dump misses:
 * product media lives in Supabase Storage and the columns hold only URLs. The
 * catalogue's copy was typed by hand and the photographs exist nowhere else.
 *
 * Not a substitute for scheduled backups. It is a snapshot, taken whenever
 * somebody remembers, and the folder name says when.
 */

const prisma = new PrismaClient({
  adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL }),
});

/** `backup/2026-08-22T22-15-03/`: sortable, and never overwrites a previous run. */
function stamp(): string {
  return new Date().toISOString().replace(/:/g, "-").replace(/\..+$/, "");
}

async function dumpTables(dir: string): Promise<Record<string, number>> {
  const data = path.join(dir, "data");
  await mkdir(data, { recursive: true });

  /*
   * Every table the shop owns. `orders` and `audit_log` are the point: they
   * hold what happened, and nothing regenerates them.
   *
   * `np_cities` and `np_warehouses` are deliberately skipped. They are Nova
   * Poshta's directory, not ours, `npm run sync-novaposhta` rebuilds them on
   * demand, and they are large enough that copying them would dominate the
   * size of the backup.
   */
  const tables = {
    products: () => prisma.product.findMany(),
    categories: () => prisma.category.findMany(),
    product_components: () => prisma.productComponent.findMany(),
    banners: () => prisma.banner.findMany(),
    orders: () => prisma.order.findMany({ include: { items: true } }),
    app_users: () => prisma.appUser.findMany(),
    audit_log: () => prisma.auditLog.findMany(),
  };

  const counts: Record<string, number> = {};
  for (const [name, read] of Object.entries(tables)) {
    const rows = await read();
    await writeFile(path.join(data, `${name}.json`), JSON.stringify(rows, null, 2), "utf8");
    counts[name] = rows.length;
  }
  return counts;
}

/**
 * Every media file the catalogue and the banners point at, fetched from the
 * bucket exactly as a shopper's browser would.
 *
 * The bucket is public, so this needs no key and deliberately uses none: a
 * backup script is not a reason to hand anything the service-role key.
 */
async function downloadMedia(dir: string): Promise<{ saved: number; failed: string[] }> {
  const media = path.join(dir, "media");
  await mkdir(media, { recursive: true });

  const [products, banners] = await Promise.all([
    prisma.product.findMany({ select: { media: true } }),
    prisma.banner.findMany({ select: { images: true } }),
  ]);

  // A set: one photograph can be used by several products, or by a product and
  // a banner both.
  const urls = new Set<string>();
  for (const p of products) for (const u of p.media) if (u.startsWith("http")) urls.add(u);
  for (const b of banners) for (const u of b.images) if (u.startsWith("http")) urls.add(u);

  let saved = 0;
  const failed: string[] = [];

  for (const url of urls) {
    const name = decodeURIComponent(new URL(url).pathname.split("/").pop() || "");
    if (!name) {
      failed.push(url);
      continue;
    }
    try {
      const res = await fetch(url, { signal: AbortSignal.timeout(30_000) });
      if (!res.ok) {
        failed.push(`${name} — HTTP ${res.status}`);
        continue;
      }
      await writeFile(path.join(media, name), Buffer.from(await res.arrayBuffer()));
      saved += 1;
    } catch (err) {
      failed.push(`${name} — ${(err as Error).message}`);
    }
  }

  return { saved, failed };
}

async function main() {
  const dir = path.join("backup", stamp());
  await mkdir(dir, { recursive: true });

  console.log(`Backup in ${dir}\n`);

  const counts = await dumpTables(dir);
  console.log("TABLES");
  for (const [name, n] of Object.entries(counts)) {
    console.log(`  ${name.padEnd(20)} ${n}`);
  }
  console.log("  np_cities / np_warehouses  skipped — rebuilt by sync-novaposhta");

  console.log("\nMEDIA");
  const { saved, failed } = await downloadMedia(dir);
  console.log(`  files saved          ${saved}`);
  if (failed.length > 0) {
    console.log(`  FAILED               ${failed.length}`);
    for (const f of failed) console.log(`    ${f}`);
  }

  console.log(
    `\nDone. ${dir} holds everything the shop cannot be rebuilt without.\n` +
      "It is in .gitignore: it carries customers' personal data from the orders.\n" +
      "Put it somewhere that outlives this disk.",
  );
}

main()
  .catch((err) => {
    console.error("The backup was NOT made:", err);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
