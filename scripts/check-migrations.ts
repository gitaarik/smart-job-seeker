/**
 * Prove that `drizzle/*.sql` can build the database `schema.ts` describes.
 *
 * ## Why this exists
 *
 * Dev keeps its schema with `drizzle-kit push`; deploy applies migration files.
 * Two mechanisms, one assumed to agree with the other, and nothing checking.
 * Measured on 2026-08-04: dev had applied exactly ONE migration (0000, in
 * April) out of 77 — so 76 files had never run anywhere except preview, one at
 * a time as each release landed. That is a single successful run on the one box
 * you would least like to be wrong about, and it says nothing about whether the
 * set can build a database from nothing. Standing up a new environment — a
 * second preview, a real production, a restored backup — is the first time it
 * ever would be asked.
 *
 * It also catches the documented footgun the other way round: editing
 * `schema.ts`, pushing to dev and forgetting to `generate`. Today that surfaces
 * as a deploy failing with "column does not exist"; here it is a red check.
 *
 * ## How
 *
 * Two throwaway databases on the same server:
 *
 *   A  built by running every migration from empty, through drizzle-orm's
 *      migrator — the same call `migrate-deploy.ts` makes on deploy.
 *   B  built by `drizzle-kit push` from `schema.ts` onto empty.
 *
 * Then compare their catalogs. Not `pg_dump` output: that diffs noisily over
 * statement order and formatting, and the binary is not in the app image
 * anyway. Comparing `information_schema` directly also means a mismatch reports
 * as "applications.context_details is missing from the migrations" rather than
 * as a hunk of SQL.
 *
 * Column ORDER is deliberately not compared. A migration that appends a column
 * `schema.ts` declares in the middle produces a different ordinal position and
 * an identical database.
 *
 *   npx tsx scripts/check-migrations.ts            # against $SJS_DATABASE_URL's server
 *   npx tsx scripts/check-migrations.ts --keep     # leave the scratch DBs to poke at
 */

import { execFileSync } from 'node:child_process';
import { drizzle } from 'drizzle-orm/node-postgres';
import { migrate } from 'drizzle-orm/node-postgres/migrator';
import pg from 'pg';

const KEEP = process.argv.includes('--keep');

/**
 * Fixed names, and the only two databases this script is ever allowed to drop.
 * Everything destructive below is guarded on membership of this pair — a typo
 * in an env var should not be able to point the DROP at a real database.
 */
const SCRATCH = {
	migrations: 'sjs_migcheck_migrations',
	schema: 'sjs_migcheck_schema'
} as const;

const baseUrl = process.env.SJS_DATABASE_URL ?? process.env.DATABASE_URL;
if (!baseUrl) {
	console.error('SJS_DATABASE_URL (or DATABASE_URL) is required');
	process.exit(2);
}

const urlFor = (database: string) => {
	const u = new URL(baseUrl);
	u.pathname = `/${database}`;
	return u.toString();
};

/** Connect to the maintenance database so the scratch ones can be recreated. */
async function adminClient(): Promise<pg.Client> {
	const client = new pg.Client({ connectionString: urlFor('postgres') });
	await client.connect();
	return client;
}

async function recreate(admin: pg.Client, name: string) {
	if (!Object.values(SCRATCH).includes(name as never)) {
		throw new Error(`refusing to drop a database outside the scratch set: ${name}`);
	}
	// Terminate leftovers from an interrupted run; DROP fails on open sessions.
	await admin.query(
		`SELECT pg_terminate_backend(pid) FROM pg_stat_activity
     WHERE datname = $1 AND pid <> pg_backend_pid()`,
		[name]
	);
	await admin.query(`DROP DATABASE IF EXISTS "${name}"`);
	await admin.query(`CREATE DATABASE "${name}"`);
}

// ---------------------------------------------------------------------------
// The two builds
// ---------------------------------------------------------------------------

/**
 * Returns null on success, or a description of where the set gave out.
 *
 * Caught rather than thrown because "the migrations cannot build a database
 * from empty" is a FINDING, not a crash — it is the single most likely thing
 * this script exists to discover, and a stack trace is a poor way to say it.
 */
async function buildFromMigrations(name: string): Promise<string | null> {
	const client = new pg.Client({ connectionString: urlFor(name) });
	await client.connect();
	try {
		await migrate(drizzle(client), { migrationsFolder: './drizzle' });
		return null;
	} catch (e) {
		const err = e as { query?: string; cause?: { message?: string } };
		return [
			err.cause?.message ?? (e as Error).message,
			err.query ? `  while running: ${err.query.trim()}` : null
		]
			.filter(Boolean)
			.join('\n');
	} finally {
		await client.end();
	}
}

function buildFromSchema(name: string) {
	// drizzle-kit reads the URL from the config's env lookup, so this is how the
	// target is chosen. `--force` skips the interactive confirmation; there is
	// nothing in an empty database to lose.
	execFileSync('npx', ['drizzle-kit', 'push', '--force'], {
		env: { ...process.env, DATABASE_URL: urlFor(name), SJS_DATABASE_URL: urlFor(name) },
		stdio: ['ignore', 'pipe', 'pipe']
	});
}

// ---------------------------------------------------------------------------
// What "the same database" means
// ---------------------------------------------------------------------------

/** One comparable fact about the schema: a stable key and its definition. */
type Fact = { kind: string; key: string; value: string };

const QUERIES: Array<{ kind: string; sql: string }> = [
	{
		kind: 'column',
		sql: `
      SELECT table_name || '.' || column_name AS key,
             data_type
               || coalesce(' (' || character_maximum_length || ')', '')
               || coalesce(' (' || numeric_precision || ',' || numeric_scale || ')', '')
               || ' null=' || is_nullable
               || ' default=' || coalesce(column_default, '-')
               AS value
      FROM information_schema.columns
      WHERE table_schema = 'public'`
	},
	{
		kind: 'constraint',
		sql: `
      SELECT rel.relname || '.' || con.conname AS key,
             pg_get_constraintdef(con.oid) AS value
      FROM pg_constraint con
      JOIN pg_class rel ON rel.oid = con.conrelid
      JOIN pg_namespace ns ON ns.oid = rel.relnamespace
      WHERE ns.nspname = 'public'`
	},
	{
		kind: 'index',
		sql: `
      SELECT tablename || '.' || indexname AS key, indexdef AS value
      FROM pg_indexes WHERE schemaname = 'public'`
	},
	{
		kind: 'enum',
		sql: `
      SELECT t.typname AS key, string_agg(e.enumlabel, ',' ORDER BY e.enumsortorder) AS value
      FROM pg_type t
      JOIN pg_enum e ON e.enumtypid = t.oid
      JOIN pg_namespace ns ON ns.oid = t.typnamespace
      WHERE ns.nspname = 'public'
      GROUP BY t.typname`
	},
	{
		kind: 'sequence',
		sql: `
      SELECT sequence_name AS key, data_type AS value
      FROM information_schema.sequences WHERE sequence_schema = 'public'`
	}
];

async function readFacts(name: string): Promise<Map<string, Fact>> {
	const client = new pg.Client({ connectionString: urlFor(name) });
	await client.connect();
	try {
		const facts = new Map<string, Fact>();
		for (const { kind, sql } of QUERIES) {
			const { rows } = await client.query<{ key: string; value: string }>(sql);
			for (const r of rows) {
				facts.set(`${kind}:${r.key}`, { kind, key: r.key, value: r.value });
			}
		}
		return facts;
	} finally {
		await client.end();
	}
}

type Difference = {
	kind: string;
	key: string;
	detail: string;
};

function compare(fromMigrations: Map<string, Fact>, fromSchema: Map<string, Fact>): Difference[] {
	const differences: Difference[] = [];

	for (const [id, want] of fromSchema) {
		const got = fromMigrations.get(id);
		if (!got) {
			differences.push({
				kind: want.kind,
				key: want.key,
				detail: `missing from the migrations — schema.ts has ${want.value}`
			});
		} else if (got.value !== want.value) {
			differences.push({
				kind: want.kind,
				key: want.key,
				detail: `migrations: ${got.value}\n      schema.ts: ${want.value}`
			});
		}
	}

	for (const [id, got] of fromMigrations) {
		if (!fromSchema.has(id)) {
			differences.push({
				kind: got.kind,
				key: got.key,
				detail: `left behind by the migrations — not in schema.ts (${got.value})`
			});
		}
	}

	return differences.sort((a, z) => a.kind.localeCompare(z.kind) || a.key.localeCompare(z.key));
}

// ---------------------------------------------------------------------------

async function main() {
	const admin = await adminClient();
	try {
		console.log('Building a database from the migration files…');
		await recreate(admin, SCRATCH.migrations);
		const failure = await buildFromMigrations(SCRATCH.migrations);

		if (failure) {
			console.log(
				[
					'',
					'The migration files cannot build a database from empty.',
					'',
					failure,
					'',
					'This is what happens when the set was baselined against a database',
					'that already existed: the migrations carry every change SINCE that',
					'point and nothing that creates what came before. Existing',
					'environments are unaffected — they descend from that database — but',
					'a genuinely new one cannot be built from these files alone, and a',
					'restore has to start from a dump rather than from migrations.',
					'',
					'Fix: generate an initial migration that creates the base schema and',
					'put it at the front of the journal, then re-run this.'
				].join('\n')
			);
			return 1;
		}

		console.log('Building a database from schema.ts…');
		await recreate(admin, SCRATCH.schema);
		buildFromSchema(SCRATCH.schema);

		const [fromMigrations, fromSchema] = await Promise.all([
			readFacts(SCRATCH.migrations),
			readFacts(SCRATCH.schema)
		]);

		const differences = compare(fromMigrations, fromSchema);

		console.log(
			`\nCompared ${fromSchema.size} schema facts against ${fromMigrations.size} ` +
				`built by migrations.`
		);

		if (differences.length === 0) {
			console.log('The migrations build exactly what schema.ts describes.');
			return 0;
		}

		console.log(`\n${differences.length} difference(s):\n`);
		for (const d of differences) {
			console.log(`  ${d.kind} ${d.key}\n      ${d.detail}`);
		}
		console.log(
			'\nEither a migration is wrong, or schema.ts changed without ' +
				'`drizzle-kit generate` — the second is what makes a deploy fail with ' +
				'"column does not exist".'
		);
		return 1;
	} finally {
		if (!KEEP) {
			// Best effort: a failed comparison is the interesting output, and losing
			// it to a cleanup error would be a poor trade.
			for (const name of Object.values(SCRATCH)) {
				await recreate(admin, name).catch(() => {});
				await admin.query(`DROP DATABASE IF EXISTS "${name}"`).catch(() => {});
			}
		} else {
			console.log(`\nKept: ${Object.values(SCRATCH).join(', ')} (--keep)`);
		}
		await admin.end();
	}
}

process.exit(await main());
