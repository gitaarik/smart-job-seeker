/**
 * One-time migration: encrypt existing plaintext platform credentials.
 *
 * Usage (from cloud/oss/):
 *   npx dotenvx run -f ../.env -- npx tsx scripts/migrate-encrypt-credentials.ts
 *
 * Safe to run multiple times — already-encrypted values are detected and skipped.
 * Requires SJS_CREDENTIALS_KEY to be set in the environment.
 */

import { drizzle } from 'drizzle-orm/node-postgres';
import { eq } from 'drizzle-orm';
import pg from 'pg';
import { platform_profiles } from '../src/lib/server/db/schema.js';
import { encryptCredential, decryptCredential } from '../src/lib/server/auth/crypto.js';

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
			id: platform_profiles.id,
			password: platform_profiles.password,
			api_token: platform_profiles.api_token,
			security_answer: platform_profiles.security_answer
		})
		.from(platform_profiles);

	console.log(`Found ${rows.length} platform_profiles rows`);

	let updated = 0;
	let skipped = 0;

	for (const row of rows) {
		const updates: Record<string, string | null> = {};

		// For each sensitive field, check if it needs encryption.
		// decryptCredential returns the original string for plaintext values,
		// so if encrypt(decrypt(value)) !== value, the value is still plaintext.
		for (const field of ['password', 'api_token', 'security_answer'] as const) {
			const value = row[field];
			if (value == null) continue;

			const decrypted = decryptCredential(value);
			const reEncrypted = encryptCredential(decrypted);

			// If the value is already encrypted, decrypting and re-encrypting
			// should give us a different base64 string (due to random nonce),
			// but decrypting the original should work. The real test: is the
			// stored value valid ciphertext? Try decrypting — if it succeeds
			// AND produces a different string than the input, it was encrypted.
			if (decrypted !== value) {
				// Already encrypted (decrypt produced a different plaintext)
				continue;
			}

			// Value is plaintext — encrypt it
			updates[field] = encryptCredential(value);
		}

		if (Object.keys(updates).length > 0) {
			await db.update(platform_profiles).set(updates).where(eq(platform_profiles.id, row.id));
			updated++;
			console.log(`  Encrypted credentials for platform_profile #${row.id}`);
		} else {
			skipped++;
		}
	}

	console.log(`\nDone: ${updated} updated, ${skipped} already encrypted/empty`);
	await pool.end();
}

migrate().catch((err) => {
	console.error('Migration failed:', err);
	process.exit(1);
});
