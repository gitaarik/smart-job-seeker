/**
 * One-time migration: encrypt existing plaintext device API keys.
 *
 * Usage (from cloud/oss/):
 *   npx dotenvx run -f ../.env -- npx tsx scripts/migrate-encrypt-api-keys.ts
 *
 * On a deployed box the raw `.ts` cannot run — the image has no `src/` — so use
 * the bundle instead:
 *   docker exec sjs-preview-app-1 node dist-scripts/migrate-encrypt-api-keys.mjs
 *
 * Safe to run repeatedly — already-encrypted rows are detected and skipped.
 * Requires SJS_CREDENTIALS_KEY to be set in the environment.
 *
 * The sibling of migrate-encrypt-credentials.ts, for the column that used to be
 * `api_keys.key_plain`. That column stored the device key beside its own sha256,
 * which made the hash decorative: anyone who could read the table had working
 * credentials. It is `key_encrypted` now.
 *
 * `listApiKeys` also upgrades a legacy row the first time it is read, so a key
 * reaches ciphertext either when this runs or when its owner next opens the
 * devices page. This script is the deterministic half of that pair — it does not
 * wait for someone to visit a page, and it says how many rows it changed.
 */

import { drizzle } from 'drizzle-orm/node-postgres';
import { eq } from 'drizzle-orm';
import pg from 'pg';
import { api_keys } from '../src/lib/server/db/schema.js';
import { decryptCredential, encryptCredential } from '../src/lib/server/auth/crypto.js';

const DATABASE_URL =
	process.env.SJS_POSTGRES_URL_HOST ||
	process.env.SJS_DATABASE_URL ||
	'postgres://postgres:postgres@localhost:5432/smartjobseeker';
console.log(`Connecting to: ${DATABASE_URL.replace(/\/\/.*@/, '//<redacted>@')}`);

const pool = new pg.Pool({ connectionString: DATABASE_URL });
const db = drizzle(pool);

async function migrate() {
	const rows = await db
		.select({
			id: api_keys.id,
			name: api_keys.name,
			key_encrypted: api_keys.key_encrypted
		})
		.from(api_keys);

	console.log(`Found ${rows.length} api_keys rows`);

	let updated = 0;
	let skipped = 0;
	let unreadable = 0;

	for (const row of rows) {
		const stored = row.key_encrypted;
		if (stored == null) {
			skipped++;
			continue;
		}

		// decryptCredential passes non-ciphertext through unchanged, so a value
		// that survives the round trip was never encrypted. The prefix check is
		// what separates that from a value this key cannot decrypt — both come
		// back as the input, and only one of them is a key worth rewriting.
		const decrypted = decryptCredential(stored);
		if (decrypted !== stored) {
			skipped++;
			continue;
		}
		if (!decrypted.startsWith('sjs_')) {
			console.log(`  ! #${row.id} (${row.name}): not readable as a key — left alone`);
			unreadable++;
			continue;
		}

		await db
			.update(api_keys)
			.set({ key_encrypted: encryptCredential(decrypted) })
			.where(eq(api_keys.id, row.id));
		updated++;
		console.log(`  Encrypted key for api_key #${row.id} (${row.name})`);
	}

	console.log(
		`\nDone: ${updated} encrypted, ${skipped} already encrypted/empty` +
			(unreadable > 0 ? `, ${unreadable} unreadable` : '')
	);
	await pool.end();
}

migrate().catch((err) => {
	console.error('Migration failed:', err);
	process.exit(1);
});
