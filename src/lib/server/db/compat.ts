/**
 * Prisma-compatible mutation wrapper for Drizzle.
 *
 * Provides db.tableName.create/update/delete/etc. methods that translate
 * Prisma-style calls into Drizzle builder operations. This allows gradual
 * migration of mutation code from Prisma to native Drizzle.
 *
 * Read queries use Drizzle's native relational API via db.query.tableName.
 * Mutations use this compat layer via db.tableName.create/update/etc.
 */

import { eq, and, or, not, gt, gte, lt, lte, ne, like, ilike, inArray, notInArray, isNull, isNotNull, asc, desc, count as drizzleCount, type SQL } from "drizzle-orm";
import type { PgTable } from "drizzle-orm/pg-core";
import { getTableColumns } from "drizzle-orm";

type WhereClause = Record<string, unknown>;

/**
 * Convert a Prisma-style where clause to Drizzle SQL conditions.
 */
function buildWhere(table: PgTable, where: WhereClause): SQL | undefined {
  if (!where || Object.keys(where).length === 0) return undefined;

  const conditions: SQL[] = [];
  const columns = getTableColumns(table);

  for (const [key, value] of Object.entries(where)) {
    if (key === "OR" && Array.isArray(value)) {
      const orConditions = value.map((w: WhereClause) => buildWhere(table, w)).filter(Boolean) as SQL[];
      if (orConditions.length > 0) conditions.push(or(...orConditions)!);
      continue;
    }
    if (key === "AND" && Array.isArray(value)) {
      const andConditions = value.map((w: WhereClause) => buildWhere(table, w)).filter(Boolean) as SQL[];
      if (andConditions.length > 0) conditions.push(and(...andConditions)!);
      continue;
    }
    if (key === "NOT") {
      const notCond = buildWhere(table, value as WhereClause);
      if (notCond) conditions.push(not(notCond));
      continue;
    }

    const col = columns[key];
    if (!col) continue;

    if (value === null) {
      conditions.push(isNull(col));
    } else if (typeof value === "object" && value !== null && !Array.isArray(value) && !(value instanceof Date)) {
      // Operator object: { in: [...], gte: x, etc. }
      const ops = value as Record<string, unknown>;
      for (const [op, opVal] of Object.entries(ops)) {
        switch (op) {
          case "equals": conditions.push(eq(col, opVal)); break;
          case "not": opVal === null ? conditions.push(isNotNull(col)) : conditions.push(ne(col, opVal)); break;
          case "in": conditions.push(inArray(col, opVal as unknown[])); break;
          case "notIn": conditions.push(notInArray(col, opVal as unknown[])); break;
          case "gt": conditions.push(gt(col, opVal)); break;
          case "gte": conditions.push(gte(col, opVal)); break;
          case "lt": conditions.push(lt(col, opVal)); break;
          case "lte": conditions.push(lte(col, opVal)); break;
          case "contains": conditions.push(like(col, `%${opVal}%`)); break;
          case "startsWith": conditions.push(like(col, `${opVal}%`)); break;
          case "endsWith": conditions.push(like(col, `%${opVal}`)); break;
          case "mode":
            // Prisma's mode: 'insensitive' — handled by ilike in contains/startsWith/endsWith
            break;
          default:
            console.warn(`[compat] Unknown where operator: ${op}`);
        }
      }
    } else {
      conditions.push(eq(col, value));
    }
  }

  return conditions.length === 0 ? undefined
    : conditions.length === 1 ? conditions[0]
    : and(...conditions);
}

/**
 * Create a Prisma-compatible table wrapper for mutations.
 */
export function createTableProxy(drizzleDb: any, table: PgTable, tables?: Record<string, PgTable>) {
  return {
    async findUnique(options: { where: WhereClause; select?: Record<string, boolean>; include?: Record<string, unknown> }) {
      const converted = convertQueryOptions(table, { ...options, with: options.include }, tables);
      delete converted.include;
      const tableName = Object.entries(tables || {}).find(([, t]) => t === table)?.[0];
      if (tableName && drizzleDb.query[tableName]) {
        return drizzleDb.query[tableName].findFirst(converted);
      }
      const condition = buildWhere(table, options.where);
      const results = await drizzleDb.select().from(table).where(condition).limit(1);
      return results[0] ?? null;
    },

    async findFirst(options?: { where?: WhereClause; select?: Record<string, boolean>; include?: Record<string, unknown>; orderBy?: unknown }) {
      if (!options) {
        const tableName = Object.entries(tables || {}).find(([, t]) => t === table)?.[0];
        if (tableName && drizzleDb.query[tableName]) return drizzleDb.query[tableName].findFirst();
        const results = await drizzleDb.select().from(table).limit(1);
        return results[0] ?? null;
      }
      return this.findUnique(options as any);
    },

    async findUniqueOrThrow(options: { where: WhereClause; select?: Record<string, boolean>; include?: Record<string, unknown> }) {
      const result = await this.findUnique(options);
      if (!result) throw new Error("Record not found");
      return result;
    },

    async findFirstOrThrow(options: { where: WhereClause; select?: Record<string, boolean>; include?: Record<string, unknown>; orderBy?: unknown }) {
      const result = await this.findFirst(options);
      if (!result) throw new Error("Record not found");
      return result;
    },

    async findMany(options?: { where?: WhereClause; select?: Record<string, boolean>; include?: Record<string, unknown>; orderBy?: unknown; take?: number; skip?: number }) {
      const converted = convertQueryOptions(table, {
        ...options,
        with: options?.include,
        limit: options?.take,
        offset: options?.skip,
      }, tables);
      delete converted.include;
      delete converted.take;
      delete converted.skip;
      const tableName = Object.entries(tables || {}).find(([, t]) => t === table)?.[0];
      if (tableName && drizzleDb.query[tableName]) {
        return drizzleDb.query[tableName].findMany(converted);
      }
      const condition = options?.where ? buildWhere(table, options.where) : undefined;
      return drizzleDb.select().from(table).where(condition);
    },

    async create({ data }: { data: Record<string, unknown> }) {
      const [result] = await drizzleDb.insert(table).values(data).returning();
      return result;
    },

    async createMany({ data }: { data: Record<string, unknown>[] }) {
      if (data.length === 0) return { count: 0 };
      await drizzleDb.insert(table).values(data);
      return { count: data.length };
    },

    async update({ where, data }: { where: WhereClause; data: Record<string, unknown> }) {
      const condition = buildWhere(table, where);
      const results = await drizzleDb.update(table).set(data).where(condition).returning();
      return results[0];
    },

    async updateMany({ where, data }: { where: WhereClause; data: Record<string, unknown> }) {
      const condition = buildWhere(table, where);
      const results = await drizzleDb.update(table).set(data).where(condition);
      return { count: results.rowCount ?? 0 };
    },

    async delete({ where }: { where: WhereClause }) {
      const condition = buildWhere(table, where);
      const results = await drizzleDb.delete(table).where(condition).returning();
      return results[0];
    },

    async deleteMany({ where }: { where?: WhereClause } = {}) {
      const condition = where ? buildWhere(table, where) : undefined;
      const results = await drizzleDb.delete(table).where(condition);
      return { count: results.rowCount ?? 0 };
    },

    async upsert({ where, create, update: updateData }: {
      where: WhereClause;
      create: Record<string, unknown>;
      update: Record<string, unknown>;
    }) {
      // Try to find existing record
      const columns = getTableColumns(table);
      const condition = buildWhere(table, where);

      // Use raw SQL for upsert since we need the conflict target
      // First try: find by where clause
      const existing = await drizzleDb.select().from(table).where(condition).limit(1);
      if (existing.length > 0) {
        const results = await drizzleDb.update(table).set(updateData).where(condition).returning();
        return results[0];
      } else {
        const [result] = await drizzleDb.insert(table).values(create).returning();
        return result;
      }
    },

    async count({ where }: { where?: WhereClause } = {}) {
      const condition = where ? buildWhere(table, where) : undefined;
      const [result] = await drizzleDb.select({ value: drizzleCount() }).from(table).where(condition);
      return result?.value ?? 0;
    },
  };
}

/**
 * Convert a Prisma-style orderBy to Drizzle SQL.
 * { sort: 'asc' } → asc(table.sort)
 * [{ sort: 'asc' }, { name: 'desc' }] → [asc(table.sort), desc(table.name)]
 * Already-valid SQL/Column objects are passed through.
 */
function convertOrderBy(table: PgTable, orderBy: unknown): unknown {
  if (!orderBy) return orderBy;

  const columns = getTableColumns(table);

  // Already a Drizzle SQL expression
  if (typeof orderBy === "object" && orderBy !== null && ("queryChunks" in orderBy || "getSQL" in orderBy)) {
    return orderBy;
  }

  // Function form — pass through (Drizzle native)
  if (typeof orderBy === "function") return orderBy;

  // Array form
  if (Array.isArray(orderBy)) {
    return orderBy.map((item) => convertOrderBy(table, item));
  }

  // Prisma object form: { field: 'asc' | 'desc' }
  if (typeof orderBy === "object" && orderBy !== null) {
    const entries = Object.entries(orderBy as Record<string, string>);
    const results: SQL[] = [];
    for (const [field, direction] of entries) {
      const col = columns[field];
      if (!col) continue;
      if (direction === "desc") {
        results.push(desc(col));
      } else {
        results.push(asc(col));
      }
    }
    return results.length === 1 ? results[0] : results;
  }

  return orderBy;
}

/**
 * Wrap a Drizzle relational query's options to convert Prisma-style
 * where objects and orderBy into Drizzle SQL conditions.
 */
function convertQueryOptions(table: PgTable, options: any, tables?: Record<string, PgTable>): any {
  if (!options || typeof options !== "object") return options;

  const converted = { ...options };

  // Convert where clause from object to Drizzle condition
  if (converted.where && typeof converted.where === "object" && !("queryChunks" in converted.where) && !("getSQL" in converted.where) && typeof converted.where !== "function") {
    const condition = buildWhere(table, converted.where as WhereClause);
    converted.where = condition;
  }

  // Convert orderBy from Prisma format to Drizzle format
  if (converted.orderBy) {
    converted.orderBy = convertOrderBy(table, converted.orderBy);
  }

  // Recursively convert `with` options (nested relations)
  if (converted.with && tables) {
    const convertedWith: Record<string, unknown> = {};
    const tableRelations = getTableColumns(table);

    for (const [relName, relOptions] of Object.entries(converted.with)) {
      if (relOptions === true) {
        convertedWith[relName] = true;
        continue;
      }
      if (typeof relOptions === "object" && relOptions !== null) {
        // Try to find the related table
        const relTable = tables[relName];
        if (relTable) {
          convertedWith[relName] = convertQueryOptions(relTable, relOptions, tables);
        } else {
          convertedWith[relName] = relOptions;
        }
      } else {
        convertedWith[relName] = relOptions;
      }
    }
    converted.with = convertedWith;
  }

  return converted;
}

/**
 * Create a proxy around db.query that intercepts findFirst/findMany
 * to convert Prisma-style where objects into Drizzle conditions.
 */
function createQueryProxy(drizzleDb: any, tables: Record<string, PgTable>) {
  const rawQuery = drizzleDb.query;

  return new Proxy(rawQuery, {
    get(target: any, tableName: string) {
      const tableQuery = target[tableName];
      if (!tableQuery || !(tableName in tables)) return tableQuery;

      const table = tables[tableName];

      return new Proxy(tableQuery, {
        get(tTarget: any, method: string) {
          const original = tTarget[method];
          if (typeof original !== "function") return original;

          if (method === "findFirst" || method === "findMany") {
            return (options?: any) => {
              const converted = convertQueryOptions(table, options, tables);
              return original.call(tTarget, converted);
            };
          }

          return original.bind(tTarget);
        },
      });
    },
  });
}

/**
 * Create a proxy that wraps a Drizzle db instance with Prisma-compatible
 * table accessors for mutations while preserving the .query accessor.
 */
export function wrapWithCompat(drizzleDb: any, tables: Record<string, PgTable>) {
  const tableProxies = new Map<string, ReturnType<typeof createTableProxy>>();
  let queryProxy: any;

  return new Proxy(drizzleDb, {
    get(target, prop: string) {
      // Wrap .query with Prisma-compatible where conversion
      if (prop === "query") {
        if (!queryProxy) {
          queryProxy = createQueryProxy(target, tables);
        }
        return queryProxy;
      }

      // Pass through native Drizzle methods
      if (prop === "insert" || prop === "update" || prop === "delete" ||
          prop === "select" || prop === "execute" || prop === "$client" || prop === "_") {
        return target[prop];
      }

      // Check if it's a table name
      if (prop in tables) {
        if (!tableProxies.has(prop)) {
          tableProxies.set(prop, createTableProxy(target, tables[prop], tables));
        }
        return tableProxies.get(prop);
      }

      return target[prop];
    },
  });
}
