import { PrismaClient } from "../../../generated/prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { getEnv } from "$lib/tools/get-env";
import { isRunningInDocker } from "$lib/server/utils/docker";

const adapter = new PrismaPg({
  connectionString: getEnv("SJS_DATABASE_URL"),
});
export const db = new PrismaClient({ adapter });

// Direct PostgreSQL connection for CLI scripts
// When running in Docker: use 'database' as hostname (Docker service name)
// When running on host: use 'localhost' to connect to the exposed port
const postgresUrl = isRunningInDocker()
  ? getEnv(
    "SJS_POSTGRES_URL_DOCKER",
    "postgres://postgres:postgres@database:5432/smartjobseeker",
  )
  : getEnv(
    "SJS_POSTGRES_URL_HOST",
    "postgres://postgres:postgres@database:5432/smartjobseeker",
  );

const adapterDirect = new PrismaPg({
  connectionString: postgresUrl,
});
export const dbDirect = new PrismaClient({ adapter: adapterDirect });
