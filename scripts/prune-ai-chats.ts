#!/usr/bin/env npx tsx
/**
 * Reclaim space in `ai_chats` by dropping the bulky debug payload of old rows.
 *
 * `ai_chats` logs every LLM call and nothing ever deletes from it, so it grows
 * without bound — on the dev DB it reached 134k rows / 6.8 GB, 95% of the whole
 * database, which is what makes `full.sql` dumps enormous.
 *
 * Almost all of that is two columns: `full_prompt` (the fully-interpolated
 * prompt, including profile data and stripped page HTML) and `context` (json).
 * Together they are ~90% of an average 50 kB row. Everything you'd actually
 * query later — model, provider, request_type, token counts, response, and the
 * short system/user prompts — is small.
 *
 * So this tombstones rather than deletes: rows older than the window keep their
 * identity and their analytics fields (so /admin/costs and any usage reporting
 * stay intact, and the 8 FKs pointing at ai_chats keep resolving), and only the
 * two heavy debug columns are nulled. Deleting whole rows is also safe FK-wise
 * (every inbound FK is ON DELETE SET NULL) but throws away the cost history.
 *
 * Nulling is NOT reversible — the payload is gone. Dry-run is the default.
 *
 * Runs inside the app container (the DB host only resolves there). From cloud/:
 *
 *   npm run db:prune-ai-chats                          # dry run, 30-day window
 *   npm run db:prune-ai-chats -- --days 7              # dry run, shorter window
 *   npm run db:prune-ai-chats -- --apply
 *   npm run db:prune-ai-chats -- --apply --vacuum
 *
 * A plain UPDATE only marks the old tuples dead; the file on disk does not
 * shrink until the table is rewritten. Pass --vacuum for a VACUUM FULL, which
 * takes an ACCESS EXCLUSIVE lock (nothing can read the table meanwhile) and
 * needs free disk roughly equal to the current table size. Skip it on a busy
 * server and let autovacuum reuse the space instead.
 */
import { sql } from 'drizzle-orm';
import { dbDirect as db, queryRawDirect } from '$lib/server/db';
import { pruneAiChatPayloads } from '$lib/server/ai-chats/retention';

const args = process.argv.slice(2);
const apply = args.includes('--apply');
const doVacuum = args.includes('--vacuum');
const daysArg = args.indexOf('--days');
const days = daysArg >= 0 ? parseInt(args[daysArg + 1], 10) : 30;

if (!Number.isFinite(days) || days < 1) {
	console.error(`Invalid --days value: ${args[daysArg + 1]}`);
	process.exit(1);
}

/** Rows older than this keep only their small analytics columns. */
const cutoff = new Date(Date.now() - days * 24 * 60 * 60 * 1000);

async function main() {
	console.log(`Pruning ai_chats payloads older than ${days} days`);
	console.log(`  cutoff:  ${cutoff.toISOString()}`);
	console.log(`  mode:    ${apply ? 'APPLY' : 'dry run (pass --apply to write)'}`);
	console.log('');

	const [before] = await queryRawDirect<{
		total: string;
		prunable: string;
		bytes: string;
	}>(sql`
    SELECT
      (SELECT count(*) FROM ai_chats)::text AS total,
      (SELECT count(*) FROM ai_chats
        WHERE date_created < ${cutoff}
          AND (full_prompt IS NOT NULL OR context IS NOT NULL))::text AS prunable,
      pg_size_pretty(pg_total_relation_size('ai_chats')) AS bytes
  `);

	console.log(`  rows total:     ${before.total}`);
	console.log(`  rows prunable:  ${before.prunable}`);
	console.log(`  table size:     ${before.bytes}`);

	if (before.prunable === '0') {
		console.log('\nNothing to prune.');
		return;
	}

	// Estimate the reclaim from a sample rather than scanning every row — on a
	// multi-GB table the full pg_column_size() sum takes minutes.
	const [sample] = await queryRawDirect<{ avg_payload: string }>(sql`
    SELECT COALESCE(avg(
      pg_column_size(full_prompt) + pg_column_size(context)
    ), 0)::bigint::text AS avg_payload
    FROM (
      SELECT full_prompt, context FROM ai_chats
      WHERE date_created < ${cutoff}
        AND (full_prompt IS NOT NULL OR context IS NOT NULL)
      ORDER BY id DESC LIMIT 2000
    ) s
  `);
	const estimate = Number(sample.avg_payload) * Number(before.prunable);
	console.log(`  est. reclaim:   ~${(estimate / 1e9).toFixed(1)} GB`);

	if (!apply) {
		console.log('\nDry run — no changes written.');
		return;
	}

	// Same code path the worker runs on a schedule, looped until drained — the
	// manual run is expected to clear the whole backlog in one go.
	console.log('\nNulling full_prompt and context…');
	let pruned = 0;
	for (;;) {
		const r = await pruneAiChatPayloads({ days });
		pruned += r.rowsPruned;
		if (!r.moreRemaining) break;
		console.log(`  …${pruned} rows so far`);
	}
	console.log(`  updated ${pruned} rows`);

	if (doVacuum) {
		// VACUUM FULL cannot run inside a transaction block.
		console.log('\nVACUUM FULL ai_chats — this locks the table…');
		await db.execute(sql`VACUUM FULL ai_chats`);
		console.log('  done');
	} else {
		console.log(
			'\nSkipped VACUUM FULL — space is marked reusable but the table file ' +
				'has not shrunk. Re-run with --vacuum to reclaim disk.'
		);
	}

	const [after] = await queryRawDirect<{ bytes: string }>(sql`
    SELECT pg_size_pretty(pg_total_relation_size('ai_chats')) AS bytes
  `);
	console.log(`\n  table size now: ${after.bytes}`);
}

main()
	.then(() => process.exit(0))
	.catch((err) => {
		console.error(err);
		process.exit(1);
	});
