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
import { isHiddenFromDocuments, setShownOn, shownOnTemplate } from '$lib/profile-visibility';

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

async function main() {
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
	.then(() => process.exit(0))
	.catch((err) => {
		console.error(err);
		process.exit(1);
	});
