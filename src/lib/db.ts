import { PrismaClient } from "../../generated/prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { getEnv } from "$lib/tools/get-env";
import { isRunningInDocker } from "$lib/server/utils/docker";

const databaseUrl = getEnv("SJS_DATABASE_URL");

if (!databaseUrl) {
  throw new Error("SJS_DATABASE_URL environment variable not set");
}

const adapter = new PrismaPg({
  connectionString: databaseUrl,
});
export const db = new PrismaClient({ adapter });

// Direct PostgreSQL connection for CLI scripts
// When running in Docker: use 'database' as hostname (Docker service name)
// When running on host: use 'localhost' to connect to the exposed port
const postgresUrl = isRunningInDocker()
  ? getEnv("SJS_POSTGRES_URL_DOCKER")
  : getEnv("SJS_POSTGRES_URL_HOST");

if (!postgresUrl) {
  const envVar = isRunningInDocker()
    ? "SJS_POSTGRES_URL_DOCKER"
    : "SJS_POSTGRES_URL_HOST";
  throw new Error(`${envVar} environment variable not set`);
}

const adapterDirect = new PrismaPg({
  connectionString: postgresUrl,
});
export const dbDirect = new PrismaClient({ adapter: adapterDirect });
