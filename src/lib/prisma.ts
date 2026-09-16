import "server-only";
import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";

/**
 * Prisma Client singleton with connection pooling adapter.
 *
 * NOTE: (§9.1) Uses PrismaPg driver adapter against Supabase transaction pooler (DATABASE_URL)
 * with bounded connection pool settings (max 5 connections per serverless instance).
 */
const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

function createClient(): PrismaClient {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    throw new Error("DATABASE_URL is not set — cannot connect to the database");
  }

  return new PrismaClient({
    adapter: new PrismaPg({
      connectionString,
      // NOTE: (§9.1) Pool limits: max 5 active connections, 10s idle timeout, 10s connection acquisition timeout.
      max: 5,
      idleTimeoutMillis: 10_000,
      connectionTimeoutMillis: 10_000,
    }),
    log: process.env.NODE_ENV === "development" ? ["warn", "error"] : ["error"],
  });
}

export const prisma = globalForPrisma.prisma ?? createClient();

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = prisma;
