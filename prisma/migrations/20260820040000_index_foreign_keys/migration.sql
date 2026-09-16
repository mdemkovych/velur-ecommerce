-- The two foreign keys that were never indexed.
--
-- Postgres indexes a primary key automatically; it does **not** index the
-- referencing side of a foreign key. Both of these are read from that side:
--
--   product_components.componentId — `deleteProductForever` asks "is this
--   product inside any set?" before it deletes, because the constraint is
--   ON DELETE RESTRICT and a raw violation cannot tell a manager which set to
--   look in. Small table, so this is cheap insurance rather than a fix.
--
--   audit_log.actorId — joined to `app_users` on every page of the audit
--   journal, and `audit_log` is the one table here that grows forever: nothing
--   deletes from it, by design. Today it is trivial; the cost of adding this
--   later is a lock on the largest table in the database.
--
-- Written by hand rather than generated: `prisma migrate dev` connects through
-- DIRECT_URL, which on this checkout points at the production project, and it
-- offers to reset the database when a diff surprises it. This applies through
-- `prisma migrate deploy` in the Vercel build command like every other one.
--
-- Plain CREATE INDEX, not CONCURRENTLY: Prisma runs each migration inside a
-- transaction and CONCURRENTLY cannot run in one. Both tables are small enough
-- that the brief lock costs nothing; revisit only if audit_log gets very large
-- before this ships.

CREATE INDEX "product_components_componentId_idx" ON "product_components"("componentId");
CREATE INDEX "audit_log_actorId_idx" ON "audit_log"("actorId");
