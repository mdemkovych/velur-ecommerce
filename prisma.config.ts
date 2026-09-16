import path from "node:path";
import { defineConfig, env } from "prisma/config";

/**
 * Prisma 7 keeps connection strings here rather than in `schema.prisma`.
 *
 * Migrations must not run through Supabase's transaction pooler: pgbouncer
 * cannot hold the advisory locks and prepared statements the migration engine
 * relies on. `DIRECT_URL` is the session pooler on 5432 and is what this file
 * hands Prisma; the application itself runs on the transaction pooler on 6543
 * through `DATABASE_URL`. The two are not interchangeable.
 */
export default defineConfig({
  schema: path.join("prisma", "schema.prisma"),
  datasource: {
    url: env("DIRECT_URL"),
  },
});
