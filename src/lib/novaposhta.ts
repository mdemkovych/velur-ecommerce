import "server-only";
import {
  cityExists,
  findWarehouseCityRef,
  isDirectoryReady,
  searchCitiesLocal,
  searchWarehousesLocal,
} from "./db/novaposhta";
import { toDirectoryQuery } from "./translit";

/**
 * Nova Poshta client with local database directory tier and remote API fallback.
 *
 * NOTE: (§1.2, §5.1, §5.3) Exposes narrow lookup and delivery target validation methods.
 * Local PostgreSQL replica serves queries first; remote API acts as resilient fallback.
 */

const NP_ENDPOINT = "https://api.novaposhta.ua/v2.0/json/";

const REQUEST_TIMEOUT_MS = 5000;

export interface NpCity {
  ref: string;
  name: string;
  area: string;
}

export interface NpWarehouse {
  ref: string;
  description: string;
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** NOTE: (§1.4) False drops the address form to manual entry rather than breaking it. */
export function isNovaPoshtaConfigured(): boolean {
  return Boolean(process.env.NOVA_POSHTA_API_KEY?.trim());
}

interface NpResponse<T> {
  success: boolean;
  data: T[];
  errors?: string[];
}

/**
 * Lookup query result wrapper.
 *
 * NOTE: (§5.2) Distinguishes network/API unavailability from genuine zero-match search results.
 */
export interface NpResult<T> {
  /** False when the directory could not be reached or refused the key. */
  available: boolean;
  items: T[];
}

async function callNovaPoshta<T>(
  modelName: string,
  calledMethod: string,
  methodProperties: Record<string, string>,
): Promise<NpResult<T>> {
  const apiKey = process.env.NOVA_POSHTA_API_KEY?.trim();
  if (!apiKey) return { available: false, items: [] };

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

  try {
    const res = await fetch(NP_ENDPOINT, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      signal: controller.signal,
      body: JSON.stringify({
        apiKey,
        modelName,
        calledMethod,
        methodProperties,
      }),
    });

    if (!res.ok) {
      console.error(
        `Nova Poshta ${modelName}.${calledMethod} failed: HTTP ${res.status}`,
      );
      return { available: false, items: [] };
    }

    const body = (await res.json()) as NpResponse<T>;
    if (!body.success) {
      console.error(
        `Nova Poshta ${modelName}.${calledMethod} rejected:`,
        body.errors,
      );
      return { available: false, items: [] };
    }
    return { available: true, items: body.data ?? [] };
  } catch (err) {
    console.error(`Nova Poshta ${modelName}.${calledMethod} error:`, err);
    return { available: false, items: [] };
  } finally {
    clearTimeout(timeout);
  }
}

// ─── In-Memory Directory Cache ────────────────────────────────────────────────

const CITY_TTL_MS = 24 * 60 * 60 * 1000;
const WAREHOUSE_TTL_MS = 6 * 60 * 60 * 1000;

const CITY_RESULT_LIMIT = 25;
const WAREHOUSE_RESULT_LIMIT = 100;

const READY_TTL_MS = 5 * 60 * 1000;
const readiness = new Map<string, { ready: boolean; expiresAt: number }>();

async function directoryReady(
  entity: "cities" | "warehouses",
): Promise<boolean> {
  const hit = readiness.get(entity);
  if (hit && Date.now() < hit.expiresAt) return hit.ready;

  try {
    const ready = await isDirectoryReady(entity);
    readiness.set(entity, { ready, expiresAt: Date.now() + READY_TTL_MS });
    return ready;
  } catch (err) {
    console.error("Could not read the Nova Poshta directory state:", err);
    return false;
  }
}

const MAX_CACHE_ENTRIES = 500;

interface CacheEntry {
  value: unknown;
  expiresAt: number;
}

const cache = new Map<string, CacheEntry>();

async function cached<T>(
  key: string,
  ttlMs: number,
  load: () => Promise<NpResult<T>>,
): Promise<NpResult<T>> {
  const hit = cache.get(key);
  if (hit && hit.expiresAt > Date.now())
    return { available: true, items: hit.value as T[] };

  const result = await load();

  if (!result.available || result.items.length === 0) return result;
  const value = result.items;

  if (cache.size >= MAX_CACHE_ENTRIES) {
    const oldest = cache.keys().next().value;
    if (oldest !== undefined) cache.delete(oldest);
  }

  cache.delete(key);
  cache.set(key, { value, expiresAt: Date.now() + ttlMs });
  return result;
}

// ─── Lookups ──────────────────────────────────────────────────────────────────

/**
 * Searches settlements matching search query with local DB first, API fallback.
 *
 * @param query Search string (minimum 2 characters).
 * @returns Cities matching prefix or empty result.
 */
export async function searchCities(query: string): Promise<NpResult<NpCity>> {
  const trimmed = toDirectoryQuery(query);
  if (trimmed.length < 2) return { available: true, items: [] };

  return cached(`cities:${trimmed.toLowerCase()}`, CITY_TTL_MS, async () => {
    if (await directoryReady("cities")) {
      return {
        available: true,
        items: await searchCitiesLocal(trimmed, CITY_RESULT_LIMIT),
      };
    }

    const { available, items } = await callNovaPoshta<{
      Ref: string;
      Description: string;
      AreaDescription: string;
    }>("Address", "getCities", {
      FindByString: trimmed,
      Limit: String(CITY_RESULT_LIMIT),
    });

    return {
      available,
      items: items.map((row) => ({
        ref: row.Ref,
        name: row.Description,
        area: row.AreaDescription,
      })),
    };
  });
}

/**
 * Searches delivery branches and post machines for the given city.
 *
 * @param cityRef UUID of the target city.
 * @param query Optional warehouse number or street filter.
 * @returns Matching warehouses list.
 */
export async function searchWarehouses(
  cityRef: string,
  query: string,
): Promise<NpResult<NpWarehouse>> {
  const city = cityRef.trim();
  if (!city) return { available: true, items: [] };

  const trimmed = toDirectoryQuery(query);

  return cached(
    `warehouses:${city}:${trimmed.toLowerCase()}`,
    WAREHOUSE_TTL_MS,
    async () => {
      if (await directoryReady("warehouses")) {
        return {
          available: true,
          items: await searchWarehousesLocal(
            city,
            trimmed,
            WAREHOUSE_RESULT_LIMIT,
          ),
        };
      }

      const { available, items } = await callNovaPoshta<{
        Ref: string;
        Description: string;
      }>("Address", "getWarehouses", {
        CityRef: city,
        FindByString: trimmed,
        Limit: String(WAREHOUSE_RESULT_LIMIT),
      });

      return {
        available,
        items: items.map((row) => ({
          ref: row.Ref,
          description: row.Description,
        })),
      };
    },
  );
}

/** NOTE: (§5.2) Tri-state delivery validation: verified valid ("ok"), refuted invalid ("invalid"), or directory offline ("unavailable"). */
export type RefCheck = "ok" | "invalid" | "unavailable";

/**
 * Validates CityRef and WarehouseRef integrity before order placement.
 *
 * NOTE: (§5.2, §5.3) Verifies UUID format, cross-checks branch-to-city relationship against local DB / API,
 * and allows graceful fallback on external outage.
 *
 * @param cityRef Settlement UUID.
 * @param branchRef Warehouse UUID.
 * @returns Validation outcome ("ok", "invalid", "unavailable").
 */
export async function verifyDeliveryTarget(
  cityRef: string,
  branchRef?: string,
): Promise<RefCheck> {
  const city = cityRef.trim();
  const branch = branchRef?.trim();

  if (!city) return "ok";

  if (!UUID.test(city) || (branch && !UUID.test(branch))) return "invalid";

  if (branch) {
    if (await directoryReady("warehouses")) {
      const owner = await findWarehouseCityRef(branch);
      return owner === city ? "ok" : "invalid";
    }

    const { available, items } = await cached(
      `warehouse-ref:${branch}`,
      WAREHOUSE_TTL_MS,
      () =>
        // MUST NOT: add CityRef beside Ref; the API then returns nothing even for a
        // real branch, and every genuine order is refused.
        callNovaPoshta<{ Ref: string; CityRef: string }>(
          "Address",
          "getWarehouses",
          { Ref: branch },
        ),
    );
    if (!available) return "unavailable";
    return items[0]?.CityRef === city ? "ok" : "invalid";
  }

  if (await directoryReady("cities")) {
    return (await cityExists(city)) ? "ok" : "invalid";
  }

  const { available, items } = await cached(
    `city-ref:${city}`,
    CITY_TTL_MS,
    () =>
      callNovaPoshta<{ Ref: string }>("Address", "getCities", { Ref: city }),
  );
  if (!available) return "unavailable";
  return items.length > 0 ? "ok" : "invalid";
}

/**
 * Live health check probing external Nova Poshta endpoint bypassing local cache.
 *
 * @returns True if remote API responded successfully.
 */
export async function probeNovaPoshta(): Promise<boolean> {
  if (!isNovaPoshtaConfigured()) return false;
  const { available, items } = await callNovaPoshta<{ Ref: string }>(
    "Address",
    "getCities",
    {
      FindByString: "Київ",
      Limit: "1",
    },
  );
  return available && items.length > 0;
}

