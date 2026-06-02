import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@prisma/client";
import { Pool } from "pg";

const globalForPrisma = globalThis as {
  pool?: Pool;
  prisma?: PrismaClient;
};

function getPrismaClient() {
  if (globalForPrisma.prisma) {
    return globalForPrisma.prisma;
  }

  const connectionString = process.env.DATABASE_URL;

  if (!connectionString) {
    throw new Error("DATABASE_URL is not configured for this deployment.");
  }

  const pool =
    globalForPrisma.pool ??
    new Pool({
      connectionString,
      max: 5,
    });

  const adapter = new PrismaPg(pool);
  const client = new PrismaClient({
    adapter,
    log: process.env.NODE_ENV === "development" ? ["error", "warn"] : ["error"],
    transactionOptions: {
      maxWait: 10000,
      timeout: 20000,
    },
  });

  if (process.env.NODE_ENV !== "production") {
    globalForPrisma.pool = pool;
    globalForPrisma.prisma = client;
  }

  return client;
}

export const prisma = new Proxy(
  {},
  {
    get(_target, property, receiver) {
      const client = getPrismaClient();
      const value = Reflect.get(client, property, receiver);

      return typeof value === "function" ? value.bind(client) : value;
    },
  },
) as PrismaClient;
