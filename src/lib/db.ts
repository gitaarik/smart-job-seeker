import { PrismaClient } from "@prisma/client";
import { getEnv } from "$lib/tools/get-env";

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

const isProduction = getEnv("NODE_ENV") === "production";

// App database connection (uses Prisma Accelerate via DATABASE_URL)
export const db = globalForPrisma.prisma ?? new PrismaClient();

if (!isProduction) {
  globalForPrisma.prisma = db;
}

// Direct PostgreSQL connection for CLI scripts (uses POSTGRES_URL)
const globalForPrismaScript = globalThis as unknown as {
  prismaScript: PrismaClient | undefined;
};

const postgresUrl = getEnv("POSTGRES_URL");

export const dbDirect = globalForPrismaScript.prismaScript ??
  new PrismaClient({
    datasources: {
      db: {
        url: postgresUrl,
      },
    },
  });

if (!isProduction) {
  globalForPrismaScript.prismaScript = dbDirect;
}
