/**
 * Fill `search_task_runs.failure_kind` for runs that predate the column.
 *
 * The auth-block policy reads a task's recent run history, so without this
 * an install ships the feature and then sits blind for three more scheduled
 * failures before it can act — on exactly the tasks that have been failing for
 * a week already. Backfilling turns it on with the history it needs.
 *
 * Recovery is by string-matching the stored `error_message`
 * (`classifyLegacyErrorMessage`), which is the thing the column exists to stop
 * anyone doing at runtime. It is sound here and only here: these strings are
 * already written, so they cannot drift.
 *
 * Safe to re-run — only touches rows where `failure_kind IS NULL`, and only
 * failed runs. Dry-run by default.
 *
 *   # from cloud/oss, against whichever DB SJS_DATABASE_URL points at
 *   npx dotenvx run -f ../.env -- npx tsx scripts/backfill-failure-kinds.ts
 *   npx dotenvx run -f ../.env -- npx tsx scripts/backfill-failure-kinds.ts --apply
 */

import { dbDirect as db } from '$lib/server/db';
import { and, eq, inArray, isNull } from 'drizzle-orm';
import { search_task_runs } from '$lib/server/db/schema';
import { classifyLegacyErrorMessage } from '$lib/import-tasks/failure-kinds';

const APPLY = process.argv.includes('--apply');

async function main() {
	const rows = await db
		.select({
			id: search_task_runs.id,
			error_message: search_task_runs.error_message
		})
		.from(search_task_runs)
		.where(and(eq(search_task_runs.status, 'error'), isNull(search_task_runs.failure_kind)));

	console.log(`Scanning ${rows.length} failed runs with no failure_kind…\n`);
	if (rows.length === 0) return;

	const byKind = new Map<string, number[]>();
	const unmatched: string[] = [];
	for (const row of rows) {
		const kind = classifyLegacyErrorMessage(row.error_message);
		if (!kind) {
			unmatched.push(row.error_message ?? '(null)');
			continue;
		}
		const bucket = byKind.get(kind) ?? [];
		bucket.push(row.id);
		byKind.set(kind, bucket);
	}

	for (const [kind, ids] of [...byKind.entries()].sort((a, b) => b[1].length - a[1].length)) {
		console.log(`  ${String(ids.length).padStart(5)}  ${kind}`);
	}
	if (unmatched.length > 0) {
		// Left null on purpose — see classifyLegacyErrorMessage. Printed as a
		// sample because an unmatched message is usually a message the live
		// classifier has no branch for either, which is worth knowing.
		const sample = [...new Set(unmatched)].slice(0, 10);
		console.log(`\n  ${unmatched.length} left unclassified. Distinct messages (up to 10):`);
		for (const m of sample) console.log(`    · ${m.slice(0, 100)}`);
	}

	if (!APPLY) {
		console.log('\nDry run. Re-run with --apply to write.');
		return;
	}

	let written = 0;
	for (const [kind, ids] of byKind) {
		// Chunked so a large history doesn't build one enormous IN list.
		for (let i = 0; i < ids.length; i += 500) {
			const chunk = ids.slice(i, i + 500);
			await db
				.update(search_task_runs)
				.set({ failure_kind: kind })
				.where(inArray(search_task_runs.id, chunk));
			written += chunk.length;
		}
	}
	console.log(`\n✅ Wrote failure_kind on ${written} runs.`);
}

main()
	.then(() => process.exit(0))
	.catch((err) => {
		console.error(err);
		process.exit(1);
	});
