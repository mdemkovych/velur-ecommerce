import type { PrismaClient } from "@prisma/client";

/**
 * Batch directory synchronization engine for Nova Poshta settlements and warehouses.
 *
 * NOTE: (§5.3) Ingests directory data into PostgreSQL using chunked unnest bulk queries with
 * transactional checkpoints and stale row pruning upon run completion.
 */

const NP_ENDPOINT = "https://api.novaposhta.ua/v2.0/json/";

const PAGE_SIZE = 500;

// NOTE: (§5.3) Respects request pacing (1.5s gap) to prevent consuming API rate limits allocated for live lookups.
const REQUEST_GAP_MS = 1500;

const RUN_STALE_AFTER_MS = 12 * 60 * 60 * 1000;

const PAGE_TIMEOUT_MS = 20_000;

export type NpEntity = "cities" | "warehouses";

export interface SyncProgress {
  entity: NpEntity;
  /** True when this invocation reached the last page and pruned. */
  done: boolean;
  /** Pages fetched by this invocation, not by the run as a whole. */
  pages: number;
  /** Rows written by this invocation. */
  rows: number;
  /** Rows in the table once a completed run pruned; null while a run continues. */
  total: number | null;
}

export interface SyncOptions {
  apiKey: string;
  /** Deadline timestamp in ms; invocation exits gracefully upon reaching deadline. */
  deadline?: number;
  onProgress?: (message: string) => void;
}

interface NpEnvelope<T> {
  success: boolean;
  data: T[];
  errors?: string[];
}

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

async function callNovaPoshta<T>(
  apiKey: string,
  calledMethod: string,
  page: number,
): Promise<T[]> {
  const res = await fetch(NP_ENDPOINT, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    signal: AbortSignal.timeout(PAGE_TIMEOUT_MS),
    body: JSON.stringify({
      apiKey,
      modelName: "Address",
      calledMethod,
      methodProperties: { Page: String(page), Limit: String(PAGE_SIZE) },
    }),
  });
  if (!res.ok) throw new Error(`Nova Poshta ${calledMethod}: HTTP ${res.status}`);

  const body = (await res.json()) as NpEnvelope<T>;
  if (!body.success) {
    throw new Error(
      `Nova Poshta ${calledMethod} refused: ${body.errors?.join("; ") ?? "unknown"}`,
    );
  }
  return body.data ?? [];
}

interface CityPayload {
  Ref: string;
  Description: string;
  AreaDescription: string;
}

interface WarehousePayload {
  Ref: string;
  Description: string;
  CityRef: string;
}

/**
 * Converts JS Date to UTC timestamp string compatible with raw Postgres SQL queries.
 */
function stampFor(stamp: Date): string {
  return stamp.toISOString().replace("Z", "");
}

/**
 * Writes city records batch into np_cities table via raw unnest query.
 *
 * NOTE: (§5.3) Uses single round-trip unnest with ON CONFLICT DO UPDATE for idempotency.
 */
async function writeCities(
  prisma: PrismaClient,
  rows: CityPayload[],
  stamp: Date,
): Promise<void> {
  const at = stampFor(stamp);
  await prisma.$executeRaw`
    INSERT INTO "np_cities" ("ref", "name", "area", "syncedAt")
    SELECT * FROM unnest(
      ${rows.map((r) => r.Ref)}::text[],
      ${rows.map((r) => r.Description)}::text[],
      ${rows.map((r) => r.AreaDescription ?? "")}::text[],
      ${rows.map(() => at)}::timestamp[]
    )
    ON CONFLICT ("ref") DO UPDATE SET
      "name"     = EXCLUDED."name",
      "area"     = EXCLUDED."area",
      "syncedAt" = EXCLUDED."syncedAt"
  `;
}

/**
 * Writes warehouse records batch into np_warehouses table via raw unnest query.
 */
async function writeWarehouses(
  prisma: PrismaClient,
  rows: WarehousePayload[],
  stamp: Date,
): Promise<void> {
  const at = stampFor(stamp);
  await prisma.$executeRaw`
    INSERT INTO "np_warehouses" ("ref", "cityRef", "description", "syncedAt")
    SELECT * FROM unnest(
      ${rows.map((r) => r.Ref)}::text[],
      ${rows.map((r) => r.CityRef)}::text[],
      ${rows.map((r) => r.Description)}::text[],
      ${rows.map(() => at)}::timestamp[]
    )
    ON CONFLICT ("ref") DO UPDATE SET
      "cityRef"     = EXCLUDED."cityRef",
      "description" = EXCLUDED."description",
      "syncedAt"    = EXCLUDED."syncedAt"
  `;
}

/** Deduplicates array entries by key before executing raw SQL unnest queries. */
function dedupe<T>(rows: T[], refOf: (row: T) => string): T[] {
  return [...new Map(rows.map((row) => [refOf(row), row])).values()];
}

/**
 * Resumes active sync checkpoint or initiates a new synchronization run.
 *
 * NOTE: (§5.3) Recovers from interrupted invocations if previous run is under 12 hours old.
 */
async function openRun(
  prisma: PrismaClient,
  entity: NpEntity,
): Promise<{ stamp: Date; page: number }> {
  const row = await prisma.npSync.findUnique({ where: { entity } });

  const stalled =
    row?.runStartedAt != null &&
    Date.now() - row.runStartedAt.getTime() > RUN_STALE_AFTER_MS;

  if (row?.runStartedAt && row.nextPage && !stalled) {
    return { stamp: row.runStartedAt, page: row.nextPage };
  }

  const stamp = new Date();
  await prisma.npSync.upsert({
    where: { entity },
    create: { entity, syncedAt: stamp, rowCount: 0, runStartedAt: stamp, nextPage: 1 },
    update: { runStartedAt: stamp, nextPage: 1 },
  });
  return { stamp, page: 1 };
}

/**
 * Synchronizes entity directory from Nova Poshta API up to optional time deadline.
 *
 * NOTE: (§5.3) Progresses through pagination, persists checkpoint after each batch,
 * and prunes deleted records when the final page is completed.
 *
 * @param prisma Prisma database client.
 * @param entity Entity type ('cities' | 'warehouses').
 * @param options Synchronization parameters including API key and deadline.
 * @returns Sync progress metrics.
 */
export async function syncEntity(
  prisma: PrismaClient,
  entity: NpEntity,
  { apiKey, deadline, onProgress }: SyncOptions,
): Promise<SyncProgress> {
  const method = entity === "cities" ? "getCities" : "getWarehouses";
  const { stamp, page: firstPage } = await openRun(prisma, entity);

  let page = firstPage;
  let pages = 0;
  let rows = 0;

  for (;;) {
    if (deadline !== undefined && Date.now() >= deadline) {
      onProgress?.(`${entity}: paused at page ${page}`);
      return { entity, done: false, pages, rows, total: null };
    }

    const batch = await callNovaPoshta<CityPayload | WarehousePayload>(
      apiKey,
      method,
      page,
    );

    if (batch.length > 0) {
      if (entity === "cities") {
        await writeCities(prisma, dedupe(batch as CityPayload[], (r) => r.Ref), stamp);
      } else {
        await writeWarehouses(
          prisma,
          dedupe(batch as WarehousePayload[], (r) => r.Ref),
          stamp,
        );
      }
      rows += batch.length;
    }

    pages += 1;
    page += 1;
    await prisma.npSync.update({ where: { entity }, data: { nextPage: page } });
    onProgress?.(`${entity}: ${rows}…`);

    if (batch.length < PAGE_SIZE) break;
    await sleep(REQUEST_GAP_MS);
  }

  if (rows === 0 && firstPage === 1) {
    throw new Error(`Nova Poshta returned no ${entity} — directory left untouched`);
  }

  const at = stampFor(stamp);
  if (entity === "cities") {
    await prisma.$executeRaw`DELETE FROM "np_cities" WHERE "syncedAt" < ${at}::timestamp`;
  } else {
    await prisma.$executeRaw`DELETE FROM "np_warehouses" WHERE "syncedAt" < ${at}::timestamp`;
  }

  const total =
    entity === "cities" ? await prisma.npCity.count() : await prisma.npWarehouse.count();

  await prisma.npSync.update({
    where: { entity },
    data: { syncedAt: stamp, rowCount: total, runStartedAt: null, nextPage: null },
  });

  return { entity, done: true, pages, rows, total };
}

/**
 * Returns timestamp of the oldest completed synchronization between cities and warehouses.
 *
 * @param prisma Prisma database client.
 * @returns Date of completion or null if both entities are not yet synchronized.
 */
export async function lastCompletedSync(prisma: PrismaClient): Promise<Date | null> {
  const rows = await prisma.npSync.findMany({
    where: { rowCount: { gt: 0 } },
    select: { syncedAt: true },
  });
  if (rows.length < 2) return null;
  return rows.reduce((oldest, row) => (row.syncedAt < oldest ? row.syncedAt : oldest), rows[0].syncedAt);
}

/** Checks whether a synchronization run is actively in progress. */
export async function runInFlight(prisma: PrismaClient): Promise<boolean> {
  const row = await prisma.npSync.findFirst({ where: { runStartedAt: { not: null } } });
  return row !== null;
}

