import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@prisma/client";
import { Pool } from "pg";

const globalForPrisma = globalThis as {
  pool?: Pool;
  prisma?: PrismaClient;
};

const connectionString = process.env.DATABASE_URL;

function createUnavailablePrismaClient() {
  return new Proxy(
    {},
    {
      get(_target, property) {
        if (property === "$disconnect") {
          return async () => undefined;
        }

        throw new Error("DATABASE_URL is not configured for this deployment.");
      },
    },
  ) as PrismaClient;
}

const pool =
  connectionString && !globalForPrisma.pool
    ? new Pool({
        connectionString,
        max: 5,
      })
    : globalForPrisma.pool;

const adapter = pool ? new PrismaPg(pool) : null;

export const prisma =
  globalForPrisma.prisma ??
  (adapter
    ? new PrismaClient({
        adapter,
        log: process.env.NODE_ENV === "development" ? ["error", "warn"] : ["error"],
        transactionOptions: {
          maxWait: 10000,
          timeout: 20000,
        },
      })
    : createUnavailablePrismaClient());

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.pool = pool ?? undefined;
  globalForPrisma.prisma = prisma;
}
