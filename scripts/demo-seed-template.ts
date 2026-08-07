#!/usr/bin/env node
/**
 * Seed the demo-template account (DEV ONLY — needs the source tree, so it runs
 * under vite-node in the dev container; the prod image is a compiled build).
 * On prod, use the admin UI: /admin/demo-links → "Demo template".
 *
 * Modes:
 *   # Clone an existing profile on this DB into the template (no fixture, no PII
 *   # in any repo). Preferred.
 *   npx vite-node scripts/demo-seed-template.ts -- --from-profile <profileId>
 *
 *   # Or import a committed fixture (portable / synthetic template).
 *   npx vite-node scripts/demo-seed-template.ts
 */

import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { readFileSync } from 'node:fs';
import { eq } from 'drizzle-orm';
import { dbDirect as db } from '$lib/server/db';
import { profiles, users } from '$lib/server/db/schema';
import { importExportData, importSettings } from '$lib/server/export';
import type { ExportData, SettingsExportData } from '$lib/server/export';
import { getOrCreateTemplateUser, seedDemoTemplateFromProfile } from '$lib/server/demo/template';

const __dirname = dirname(fileURLToPath(import.meta.url));
const FIXTURE_PATH = join(__dirname, 'fixtures', 'demo-template.json');

interface TemplateFixture {
	version: number;
	profile: ExportData;
	settings: SettingsExportData;
}

/** Parse `--from-profile <id>` / `--from-profile=<id>` from argv. */
function parseFromProfile(): number | null {
	const argv = process.argv.slice(2);
	const i = argv.findIndex((a) => a === '--from-profile' || a.startsWith('--from-profile='));
	if (i < 0) return null;
	const raw = argv[i].includes('=') ? argv[i].split('=')[1] : argv[i + 1];
	const id = raw ? parseInt(raw, 10) : NaN;
	if (!Number.isFinite(id)) {
		console.error('--from-profile needs a numeric profile id');
		process.exit(1);
	}
	return id;
}

async function main() {
	const fromProfile = parseFromProfile();
	console.log('Seeding demo-template account...');

	if (fromProfile !== null) {
		const { userId, profileId } = await seedDemoTemplateFromProfile(fromProfile);
		console.log(`Demo-template ready: profile ${profileId} for user ${userId}.`);
		return;
	}

	// Fixture import (portable / synthetic template).
	const fixture = JSON.parse(readFileSync(FIXTURE_PATH, 'utf-8')) as TemplateFixture;
	const userId = await getOrCreateTemplateUser();
	await db
		.update(users)
		.set({ is_demo_template: true, emailVerified: true })
		.where(eq(users.id, userId));

	const existingProfile = await db.query.profiles.findFirst({
		where: eq(profiles.user_id, userId),
		columns: { id: true },
		orderBy: (p, { asc }) => asc(p.id)
	});
	const { profileId } = await importExportData(fixture.profile, userId, {
		overwriteProfileId: existingProfile?.id
	});
	await importSettings(profileId, userId, fixture.settings, {
		replaceExistingTasks: true,
		applyMatchConfig: true,
		applyEmailDigest: false,
		applySalary: true
	});
	console.log(`Demo-template ready: profile ${profileId} for user ${userId}.`);
}

main()
	.then(() => process.exit(0))
	.catch((err) => {
		console.error('Seed failed:', err);
		process.exit(1);
	});
