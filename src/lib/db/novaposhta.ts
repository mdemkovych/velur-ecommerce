import "server-only";
import { prisma } from "../prisma";

/**
 * Local Nova Poshta directory query layer.
 *
 * NOTE: (§5.3) Queries local PostgreSQL replicas for settlements and warehouses with prefix-prioritized matching.
 */

export interface NpCityRow {
  ref: string;
  name: string;
  area: string;
}

export interface NpWarehouseRow {
  ref: string;
  description: string;
}

/**
 * Checks whether local directory replica contains synchronized records.
 *
 * NOTE: (§5.3) Consults np_sync metadata table to verify directory availability before attempting local queries.
 */
export async function isDirectoryReady(entity: "cities" | "warehouses"): Promise<boolean> {
  const row = await prisma.npSync.findUnique({
    where: { entity },
    select: { rowCount: true },
  });
  return (row?.rowCount ?? 0) > 0;
}

/**
 * Searches settlements locally, prioritizing prefix matches over substring matches.
 *
 * @param query Search query string.
 * @param limit Maximum results limit.
 */
export async function searchCitiesLocal(query: string, limit: number): Promise<NpCityRow[]> {
  const select = { ref: true, name: true, area: true } as const;

  const prefix = await prisma.npCity.findMany({
    where: { name: { startsWith: query, mode: "insensitive" } },
    orderBy: { name: "asc" },
    select,
    take: limit,
  });
  if (prefix.length >= limit) return prefix;

  const seen = new Set(prefix.map((row) => row.ref));
  const rest = await prisma.npCity.findMany({
    where: {
      name: { contains: query, mode: "insensitive" },
      ref: { notIn: [...seen] },
    },
    orderBy: { name: "asc" },
    select,
    take: limit - prefix.length,
  });

  return [...prefix, ...rest];
}

/**
 * Searches warehouses for a city using indexed cityRef lookups.
 *
 * @param cityRef Settlement UUID.
 * @param query Optional warehouse number/address substring.
 * @param limit Maximum results limit.
 */
export async function searchWarehousesLocal(
  cityRef: string,
  query: string,
  limit: number,
): Promise<NpWarehouseRow[]> {
  return prisma.npWarehouse.findMany({
    where: {
      cityRef,
      ...(query ? { description: { contains: query, mode: "insensitive" } } : {}),
    },
    orderBy: { description: "asc" },
    select: { ref: true, description: true },
    take: limit,
  });
}

export async function findWarehouseCityRef(ref: string): Promise<string | null> {
  const row = await prisma.npWarehouse.findUnique({
    where: { ref },
    select: { cityRef: true },
  });
  return row?.cityRef ?? null;
}

export async function cityExists(ref: string): Promise<boolean> {
  const row = await prisma.npCity.findUnique({
    where: { ref },
    select: { ref: true },
  });
  return row !== null;
}
