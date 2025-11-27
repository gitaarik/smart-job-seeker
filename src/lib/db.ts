import { PrismaClient } from "../../generated/prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { getEnv } from "$lib/tools/get-env";

const databaseUrl = getEnv("DATABASE_URL");

if (!databaseUrl) {
  throw new Error("DATABASE_URL environment variable not set");
}

const adapter = new PrismaPg({
  connectionString: databaseUrl,
});
export const db = new PrismaClient({ adapter });

// Direct PostgreSQL connection for CLI scripts (uses POSTGRES_URL)
const postgresUrl = getEnv("POSTGRES_URL");

if (!postgresUrl) {
  throw new Error("POSTGRES_URL environment variable not set");
}

const adapterDirect = new PrismaPg({
  connectionString: postgresUrl,
});
export const dbDirect = new PrismaClient({ adapterDirect });
