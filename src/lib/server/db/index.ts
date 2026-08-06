import { drizzle } from "drizzle-orm/node-postgres";
import pg from "pg";
import { getEnv } from "$lib/tools/get-env";
import { isRunningInDocker } from "$lib/server/utils/docker";
import * as schema from "./schema";
import * as relations from "./relations";
import type { SQL } from "drizzle-orm";

const allSchema = { ...schema, ...relations };

const pool = new pg.Pool({
  connectionString: getEnv("SJS_DATABASE_URL"),
});
export const db = drizzle(pool, { schema: allSchema });

// Direct PostgreSQL connection for CLI scripts.
//
// Both are required — no default. They used to fall back to
// `…@database:5432/…`, the Docker service name, on BOTH branches. In Docker
// that default was unreachable anyway (compose always sets
// SJS_POSTGRES_URL_DOCKER), and on a host it was simply wrong: `database` does
// not resolve there, so an unset SJS_POSTGRES_URL_HOST surfaced as
// `EAI_AGAIN database` rather than as the missing configuration it was — while
// the comment above it promised localhost.
//
// A localhost default would be worse, not better: on a box running more than
// one Postgres it would silently connect to the wrong database. Failing with
// "Environment variable … is not set" names the actual problem.
const postgresUrl = isRunningInDocker()
  ? getEnv("SJS_POSTGRES_URL_DOCKER")
  : getEnv("SJS_POSTGRES_URL_HOST");

const directPool = new pg.Pool({
  connectionString: postgresUrl,
});
export const dbDirect = drizzle(directPool, { schema: allSchema });

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
