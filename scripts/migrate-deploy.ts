/**
 * Apply pending Drizzle migrations and surface real errors.
 *
 * Used by cloud/scripts/deploy.sh, and by the start scripts to build an
 * empty database. The drizzle-kit `migrate` CLI wraps
 * the same migrator in a spinner UI that silently swallows errors and
 * exits 1 with empty stderr, which can mask a real production migration
 * conflict and let the deploy continue against a half-migrated DB.
 *
 * Calling drizzle-orm's migrator directly (which is the production
 * pattern in Drizzle's own docs) makes Postgres errors propagate
 * normally with a useful stack trace.
 *
 * Run via: npx tsx scripts/migrate-deploy.ts
 */

import { drizzle } from 'drizzle-orm/node-postgres';
import { migrate } from 'drizzle-orm/node-postgres/migrator';
import pg from 'pg';

const url = process.env.SJS_DATABASE_URL;
if (!url) {
	console.error('SJS_DATABASE_URL is required');
	process.exit(2);
}

const client = new pg.Client({ connectionString: url });
await client.connect();
try {
	// One run at a time. On a first deploy the start script builds the empty
	// database while deploy.sh, a second later, runs this as well: both read
	// the journal before either commits, so both apply 0000, and the second
	// dies on its first statement (CREATE TYPE "Role": duplicate key). A
	// session lock, so closing the connection releases it.
	await client.query("SELECT pg_advisory_lock(hashtext('migrate-deploy'))");
	await migrate(drizzle(client), { migrationsFolder: './drizzle' });
	console.log('migrate: OK');
} finally {
	await client.end();
}
