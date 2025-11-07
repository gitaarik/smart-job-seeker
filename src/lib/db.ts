import { PrismaClient } from "@prisma/client";
import { getEnv } from "$lib/tools/get-env";

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

const isProduction = getEnv("NODE_ENV") === "production";

export const prisma = globalForPrisma.prisma ?? new PrismaClient();

if (!isProduction) {
  globalForPrisma.prisma = prisma;
}
