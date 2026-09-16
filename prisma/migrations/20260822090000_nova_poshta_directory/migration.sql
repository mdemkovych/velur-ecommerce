-- A local mirror of Nova Poshta's address book.
--
-- Nova Poshta rate-limits per API key, and the shop holds one key for every
-- shopper at once: roughly fifteen people typing an address together exhaust
-- it, the lookup starts answering `[]`, and the checkout falls back to a
-- hand-typed address with no `cityRef`. That ceiling is reached by concurrency
-- rather than by monthly volume, so it arrives at the busiest moment. With the
-- directory here, only the nightly sync spends that budget.

CREATE TABLE "public"."np_cities" (
    "ref"      TEXT         NOT NULL,
    "name"     TEXT         NOT NULL,
    "area"     TEXT         NOT NULL,
    "syncedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "np_cities_pkey" PRIMARY KEY ("ref")
);

CREATE TABLE "public"."np_warehouses" (
    "ref"         TEXT         NOT NULL,
    "cityRef"     TEXT         NOT NULL,
    "description" TEXT         NOT NULL,
    "syncedAt"    TIMESTAMP(3) NOT NULL,

    CONSTRAINT "np_warehouses_pkey" PRIMARY KEY ("ref")
);

CREATE TABLE "public"."np_sync" (
    "entity"   TEXT         NOT NULL,
    "syncedAt" TIMESTAMP(3) NOT NULL,
    "rowCount" INTEGER      NOT NULL,

    CONSTRAINT "np_sync_pkey" PRIMARY KEY ("entity")
);

-- Every warehouse lookup filters by city first, which is what keeps the search
-- over a few hundred rows instead of tens of thousands.
CREATE INDEX "np_warehouses_cityRef_idx" ON "public"."np_warehouses"("cityRef");

-- The sync deletes whatever it did not touch; both indexes serve that sweep.
CREATE INDEX "np_cities_syncedAt_idx"    ON "public"."np_cities"("syncedAt");
CREATE INDEX "np_warehouses_syncedAt_idx" ON "public"."np_warehouses"("syncedAt");

-- No foreign key from `np_warehouses.cityRef` to `np_cities.ref`, deliberately:
-- Nova Poshta's warehouse list is not guaranteed to be a subset of its city
-- list, and a constraint would turn one unfamiliar row into a failed sync for
-- the entire directory.

-- RLS in the same migration that creates the table — the project rule. Prisma
-- connects as the owner and is unaffected; the `anon` key Supabase issues for
-- Auth reaches PostgREST, and a table without RLS is readable over HTTP by
-- anyone holding it. Deny-all (enabled, no policies) is the default, and this
-- directory needs no exception: the shop reads it through Prisma like
-- everything else.
ALTER TABLE "public"."np_cities"     ENABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."np_warehouses" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."np_sync"       ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON "public"."np_cities"     FROM anon, authenticated;
REVOKE ALL ON "public"."np_warehouses" FROM anon, authenticated;
REVOKE ALL ON "public"."np_sync"       FROM anon, authenticated;
