-- The catalogue's order becomes something a manager sets.
--
-- It was `createdAt desc` in the query and nowhere else, so the only way to
-- move a product up the page was to create it again. `position` makes the order
-- content, like `banners.position` and `categories.position` already are.
--
-- Written by hand rather than generated, for the same reason as
-- `20260820040000_index_foreign_keys`: `prisma migrate dev` connects through
-- DIRECT_URL, which on this checkout points at the production project, and it
-- offers to reset the database when a diff surprises it. This applies through
-- `prisma migrate deploy`, which never resets, and which the Vercel build
-- command runs on every deployment.
--
-- Additive and safe against a running deployment: the client already out there
-- selects its columns by name and simply never asks for this one.

ALTER TABLE "products" ADD COLUMN "position" INTEGER NOT NULL DEFAULT 0;

-- Backfill in the order the catalogue is showing right now, so nothing moves on
-- the page at the moment this lands. `ROW_NUMBER() - 1` starts the list at zero,
-- and every row gets its own number: leaving them all at the default 0 would
-- hand the tie-break back to `createdAt` for ever and make the first drag look
-- like it did nothing.
WITH ordered AS (
  SELECT "id", ROW_NUMBER() OVER (ORDER BY "createdAt" DESC) - 1 AS pos
  FROM "products"
)
UPDATE "products" p
SET "position" = ordered.pos
FROM ordered
WHERE p."id" = ordered."id";
