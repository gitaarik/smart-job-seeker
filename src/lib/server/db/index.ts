import { drizzle } from "drizzle-orm/node-postgres";
import pg from "pg";
import { getEnv } from "$lib/tools/get-env";
import { isRunningInDocker } from "$lib/server/utils/docker";
import * as schema from "./schema";
import * as relations from "./relations";
import type { SQL } from "drizzle-orm";

// Exclude legacy/unused tables (directus_*, _prisma_migrations, sequences)
const excludeFromSchema = new Set(
  Object.keys(schema).filter((k) =>
    k.startsWith("directus_") || k === "_prisma_migrations" ||
    !(schema[k as keyof typeof schema] && typeof schema[k as keyof typeof schema] === "object" &&
      "getSQL" in (schema[k as keyof typeof schema] as object))
  ),
);

const filteredSchema: Record<string, unknown> = {};
for (const [key, value] of Object.entries(schema)) {
  if (!excludeFromSchema.has(key)) filteredSchema[key] = value;
}
for (const [key, value] of Object.entries(relations)) {
  filteredSchema[key] = value;
}

const pool = new pg.Pool({
  connectionString: getEnv("SJS_DATABASE_URL"),
});
export const db = drizzle(pool, { schema: filteredSchema });

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

const directPool = new pg.Pool({
  connectionString: postgresUrl,
});
export const dbDirect = drizzle(directPool, { schema: filteredSchema });

/**
 * Execute a raw SQL query and return typed rows.
 */
export async function queryRaw<T>(query: SQL): Promise<T[]> {
  const result = await db.execute(query);
  return result.rows as T[];
}

/**
 * Execute a raw SQL query using the direct connection.
 */
export async function queryRawDirect<T>(query: SQL): Promise<T[]> {
  const result = await dbDirect.execute(query);
  return result.rows as T[];
}

/**
 * Join an array of values into a comma-separated SQL fragment.
 */
export { sql, eq, and, or, ne, gt, gte, lt, lte, like, ilike, inArray, notInArray, isNull, isNotNull, asc, desc, count } from "drizzle-orm";
import { sql } from "drizzle-orm";
export function sqlJoin(values: unknown[]): SQL {
  const fragments = values.map((v) => sql`${v}`);
  return sql.join(fragments, sql.raw(","));
}
