import { execSync } from 'child_process';
import * as dotenvx from '@dotenvx/dotenvx';
import path from 'path';

/**
 * Pushes specified tables from dev database to production database.
 * Usage: DOTENV_PRIVATE_KEY_PRODUCTION=<key> npx tsx scripts/db-push-production.ts
 *
 * The script:
 * 1. Loads dev DB credentials from .env using dotenvx
 * 2. Loads encrypted env vars from .env.production using DOTENV_PRIVATE_KEY_PRODUCTION
 * 3. Uses docker compose exec to dump tables from dev DB (running in database container)
 * 4. Restores them to production DB (overwriting if they exist)
 *
 * Tables synced:
 * - application_questions
 * - highlights
 * - languages
 * - profiles
 * - tech_skill_categories
 * - tech_skill_types
 * - tech_skills
 * - work_experience_achievements
 * - work_experience_technologies
 * - work_experiences
 *
 * Requirements:
 * - Docker compose services must be running
 * - DOTENV_PRIVATE_KEY_PRODUCTION env var must be set
 */

const TABLES_TO_SYNC = [
	'application_questions',
	'highlights',
	'languages',
	'profiles',
	'tech_skill_categories',
	'tech_skill_types',
	'tech_skills',
	'work_experience_achievements',
	'work_experience_technologies',
	'work_experiences'
];

console.log('📋 Tables to sync:', TABLES_TO_SYNC.join(', '));

// Load dev DB connection details from .env (using dotenvx)
//
// The `await`s look redundant against dotenvx 1.x, where `get` is synchronous,
// and they are — awaiting a string is a no-op. They are here because dotenvx
// 2.0 made `lib/main#get` **async only** (a documented breaking change), and
// without them the bump does not fail loudly: the three constants become
// Promises, the guard below sees three truthy objects and passes, and the
// script builds a `pg_dump` command line containing `[object Promise]`.
// Writing it this way lets the major land as a lockfile change alone, and
// costs nothing on the version currently installed.
const DEV_DB_USER = await dotenvx.get('SJS_DB_USER');
const DEV_DB_PASSWORD = await dotenvx.get('SJS_DB_PASSWORD');
const DEV_DB_NAME = await dotenvx.get('SJS_DB_DATABASE');
const DEV_DB_CONTAINER = 'database';

if (!DEV_DB_USER || !DEV_DB_PASSWORD || !DEV_DB_NAME) {
	console.error('❌ Error: Missing dev DB credentials in .env');
	console.error('Required: SJS_DB_USER, SJS_DB_PASSWORD, SJS_DB_DATABASE');
	process.exit(1);
}

// Load production database URL from .env.production with decryption
// The DOTENV_PRIVATE_KEY_PRODUCTION env var must be set for decryption
const prodEnvFile = path.resolve(process.cwd(), '.env.production');
const prodConfig = dotenvx.config({ path: prodEnvFile });

if (prodConfig.error) {
	console.error('❌ Error loading .env.production:', prodConfig.error);
	process.exit(1);
}

const prodDbUrl = prodConfig.parsed?.SJS_POSTGRES_URL;
if (!prodDbUrl) {
	console.error('❌ Error: SJS_POSTGRES_URL not found in .env.production');
	console.error('Make sure DOTENV_PRIVATE_KEY_PRODUCTION is set to decrypt the values');
	process.exit(1);
}

console.log('✅ Dev DB credentials loaded from .env');
console.log('✅ Production DB loaded and decrypted');

// Create temporary dump file
const tmpDumpFile = `/tmp/db-sync-${Date.now()}.sql`;

try {
	// Step 1: Dump tables from dev database via docker compose exec
	console.log('\n📤 Dumping tables from dev database (via docker)...');

	const dumpCmd = [
		'docker',
		'compose',
		'exec',
		'-T', // Disable pseudo-TTY allocation
		DEV_DB_CONTAINER,
		'pg_dump',
		'-F',
		'p', // Plain text format
		'--no-privileges', // Exclude privilege commands
		'--no-owner', // Exclude owner commands
		'--clean', // Include DROP statements for clean restore
		'-U',
		DEV_DB_USER,
		...TABLES_TO_SYNC.map((table) => `--table=${table}`), // Specify which tables to dump
		DEV_DB_NAME
	];

	const dumpCmdLine = dumpCmd.join(' ');

	console.log('executing docker dump...');

	execSync(`${dumpCmdLine} > "${tmpDumpFile}"`, {
		stdio: ['pipe', 'pipe', 'inherit'],
		env: { ...process.env, PGPASSWORD: DEV_DB_PASSWORD }
	});

	console.log(`✅ Tables dumped to ${tmpDumpFile}`);

	// Step 2: Restore tables to production database
	console.log('\n📥 Restoring tables to production database...');
	console.log('⚠️  This will override existing data in these tables!');

	// Restore the dump (--clean flag in dump handles dropping old tables)
	execSync(`psql "${prodDbUrl}" < "${tmpDumpFile}"`, {
		stdio: 'inherit',
		env: { ...process.env }
	});

	console.log('\n✅ Tables restored to production database');

	// Cleanup
	execSync(`rm -f "${tmpDumpFile}"`);
	console.log('✅ Temporary files cleaned up');

	console.log('\n🎉 Sync complete!');
} catch (error) {
	console.error('\n❌ Error during sync:', error instanceof Error ? error.message : String(error));

	// Cleanup on error
	try {
		execSync(`rm -f "${tmpDumpFile}"`);
	} catch {
		// Ignore cleanup errors
	}

	process.exit(1);
}
