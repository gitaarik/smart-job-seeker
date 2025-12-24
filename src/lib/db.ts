import { PrismaClient } from "../../generated/prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { getEnv } from "$lib/tools/get-env";

const databaseUrl = getEnv("SJS_DATABASE_URL");

if (!databaseUrl) {
  throw new Error("SJS_DATABASE_URL environment variable not set");
}

const adapter = new PrismaPg({
  connectionString: databaseUrl,
});
export const db = new PrismaClient({ adapter });

// Direct PostgreSQL connection for CLI scripts
const postgresUrl = getEnv("SJS_POSTGRES_URL");

if (!postgresUrl) {
  throw new Error("SJS_POSTGRES_URL environment variable not set");
}

const adapterDirect = new PrismaPg({
  connectionString: postgresUrl,
});
export const dbDirect = new PrismaClient({ adapter: adapterDirect });
