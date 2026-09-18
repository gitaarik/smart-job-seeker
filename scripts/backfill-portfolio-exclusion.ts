/**
 * Add `!portfolio` to every item that was marked off the documents before the
 * public site existed.
 *
 * `!resume` + `!cv` used to be the whole of "hidden": there were two base
 * templates and excluding both excluded everything. The site is a third, and
 * `!resume` + `!cv` now means "off the documents, on the site" — a state
 * someone picks with the switches in the skills editor.
 *
 * Nobody picked it for the items that already carry the pair. They were tagged
 * when the sentence had no third clause, so they mean "off everything", and
 * without this pass the change would publish them to the web. That is the whole
 * reason this runs in the same change rather than after it.
 *
 * Only items already hidden from BOTH documents are touched, and only when the
 * site is not already decided either way, so it is idempotent and says nothing
 * about anything else. The tag maths comes from $lib/profile-visibility rather
 * than from SQL, so it agrees with the app about casing, whitespace and the
 * shape it writes.
 *
 *   # from cloud/oss, against whichever DB SJS_DATABASE_URL points at
 *   npx dotenvx run -f ../.env -- npx tsx scripts/backfill-portfolio-exclusion.ts
 *   npx dotenvx run -f ../.env -- npx tsx scripts/backfill-portfolio-exclusion.ts --apply
 *
 *   # on a deployed box, where the image has no src/ (see build-ops-scripts.mjs)
 *   docker compose exec app node dist-scripts/backfill-portfolio-exclusion.mjs --apply
 */

import { dbDirect as db, queryRawDirect } from '$lib/server/db';
import { sql } from 'drizzle-orm';
import {
	BASE_TEMPLATE_TAGS,
	isHiddenFromDocuments,
	setShownOn,
	shownOnTemplate
} from '$lib/profile-visibility';

const APPLY = process.argv.includes('--apply');

interface TaggedRow {
	id: number;
	tags: unknown;
}

/**
 * The tables holding version tags, read from the database rather than listed.
 *
 * A tag array is a `json` column called `tags`; `files.tags` is a text field
 * about an upload and has nothing to do with templates. Asking the catalog
 * means a table added later is covered without anybody remembering this script
 * — the same reason the orphan reaper builds its own catalog.
 */
async function taggedTables(): Promise<string[]> {
	const rows = await queryRawDirect<{ table_name: string }>(sql`
		SELECT table_name
		  FROM information_schema.columns
		 WHERE table_schema = 'public'
		   AND column_name = 'tags'
		   AND data_type = 'json'
		 ORDER BY table_name
	`);
	return rows.map((r) => r.table_name);
}

/**
 * Versions whose slug a base template now shadows.
 *
 * A tag naming one of the base templates says which template an item appears
 * on, so a VERSION slugged `portfolio` can no longer be addressed by tag: every
 * such tag reads as the template instead, and the version's whitelist matches
 * nothing. New slugs are refused (isReservedVersionSlug), but a box may already
 * hold one, and this pass would then canonicalise those tags away.
 *
 * Refusing to run is the right answer: renaming the version is a decision about
 * someone's data, and the rename has to carry its tags with it (retagVersionSlug
 * in server/profile/tailor-version.ts).
 */
async function collidingVersions(): Promise<Array<{ id: number; slug: string }>> {
	// Each tag as its own parameter: a JS array handed to `= ANY(...)` has no
	// type Postgres can infer, and fails at parse time rather than matching
	// nothing.
	const names = sql.join(
		BASE_TEMPLATE_TAGS.map((t) => sql`${t}`),
		sql`, `
	);
	return queryRawDirect<{ id: number; slug: string }>(sql`
		SELECT id, slug FROM profile_versions WHERE lower(trim(slug)) IN (${names})
	`);
}

async function main() {
	const colliding = await collidingVersions();
	if (colliding.length) {
		console.error('Refusing to run: these versions are slugged after a base template.\n');
		for (const v of colliding) console.error(`  version ${v.id}: "${v.slug}"`);
		console.error(
			'\nRename them first — their tags name the slug, so the rename has to retag the\n' +
				'items too, which is what the rename action in the resume page already does.'
		);
		process.exitCode = 1;
		return;
	}

	const tables = await taggedTables();
	console.log(`Tag-carrying tables: ${tables.join(', ')}\n`);

	let found = 0;
	let written = 0;

	for (const table of tables) {
		const rows = await queryRawDirect<TaggedRow>(
			sql`SELECT id, tags FROM ${sql.identifier(table)} WHERE tags IS NOT NULL`
		);

		const needing = rows.filter((row) => {
			const tags = Array.isArray(row.tags) ? (row.tags as string[]) : null;
			if (!tags) return false;
			// Off both documents, and the site not yet decided either way.
			return isHiddenFromDocuments(tags) && shownOnTemplate(tags, 'portfolio');
		});

		if (!needing.length) continue;
		found += needing.length;
		console.log(`${table}: ${needing.length} item(s) hidden from documents but not from the site`);

		if (!APPLY) continue;

		for (const row of needing) {
			const next = setShownOn(row.tags as string[], 'portfolio', false);
			await db.execute(
				sql`UPDATE ${sql.identifier(table)} SET tags = ${JSON.stringify(next)}::json WHERE id = ${row.id}`
			);
			written++;
		}
	}

	if (!found) {
		console.log('Nothing to do: no item is hidden from the documents but not from the site.');
		return;
	}

	console.log(
		APPLY ? `\nAdded !portfolio to ${written} item(s).` : '\nDry run. Re-run with --apply.'
	);
}

main()
	// Respecting exitCode rather than exiting 0 flat: the collision check refuses
	// by setting it, and a deploy step that cannot tell "refused" from "done" is
	// the failure this whole script exists to prevent.
	.then(() => process.exit(process.exitCode ?? 0))
	.catch((err) => {
		console.error(err);
		process.exit(1);
	});
