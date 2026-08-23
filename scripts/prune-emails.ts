#!/usr/bin/env npx tsx
/**
 * Delete stored email past the retention window.
 *
 * `inbound_emails` keeps the body, subject and sender of every message relayed
 * to a verification address — third-party content we have no relationship
 * with — and `sent_emails` keeps the fully rendered HTML of everything the
 * product sends, which for verification, reset and demo-invite mail contains
 * the live-at-the-time link. Neither was ever pruned; the only deletion path
 * was an admin clicking a row in /admin/inbox.
 *
 * Unlike the ai_chats prune this deletes outright. Nothing in the schema
 * references either table and the only readers are the two admin triage
 * views, which look at mail that has just arrived or just failed — see
 * $lib/server/email/retention.ts for the full reasoning.
 *
 * Deletion is NOT reversible. Dry-run is the default.
 *
 * Runs inside the app container (the DB host only resolves there). From cloud/:
 *
 *   npm run db:prune-emails                       # dry run, 30-day window
 *   npm run db:prune-emails -- --days 7           # dry run, shorter window
 *   npm run db:prune-emails -- --apply
 *   npm run db:prune-emails -- --apply --vacuum
 *
 * A plain DELETE only marks the old tuples dead; the file on disk does not
 * shrink until the table is rewritten. Pass --vacuum for a VACUUM FULL, which
 * takes an ACCESS EXCLUSIVE lock (nothing can read the table meanwhile) and
 * needs free disk roughly equal to the current table size. Skip it on a busy
 * server and let autovacuum reuse the space instead.
 */
import { sql } from 'drizzle-orm';
import { dbDirect as db, queryRawDirect } from '$lib/server/db';
import { pruneInboundEmails, pruneSentEmails } from '$lib/server/email/retention';

const args = process.argv.slice(2);
const apply = args.includes('--apply');
const doVacuum = args.includes('--vacuum');
const daysArg = args.indexOf('--days');
const days = daysArg >= 0 ? parseInt(args[daysArg + 1], 10) : 30;

if (!Number.isFinite(days) || days < 1) {
	console.error(`Invalid --days value: ${args[daysArg + 1]}`);
	process.exit(1);
}

const cutoff = new Date(Date.now() - days * 24 * 60 * 60 * 1000);

async function main() {
	console.log(`Pruning stored email older than ${days} days`);
	console.log(`  cutoff:  ${cutoff.toISOString()}`);
	console.log(`  mode:    ${apply ? 'APPLY' : 'dry run (pass --apply to write)'}`);
	console.log('');

	const [before] = await queryRawDirect<{
		inbound_total: string;
		inbound_prunable: string;
		inbound_bytes: string;
		sent_total: string;
		sent_prunable: string;
		sent_bytes: string;
	}>(sql`
    SELECT
      (SELECT count(*) FROM inbound_emails)::text AS inbound_total,
      (SELECT count(*) FROM inbound_emails WHERE received_at < ${cutoff})::text
        AS inbound_prunable,
      pg_size_pretty(pg_total_relation_size('inbound_emails')) AS inbound_bytes,
      (SELECT count(*) FROM sent_emails)::text AS sent_total,
      (SELECT count(*) FROM sent_emails WHERE sent_at < ${cutoff})::text
        AS sent_prunable,
      pg_size_pretty(pg_total_relation_size('sent_emails')) AS sent_bytes
  `);

	console.log('inbound_emails');
	console.log(`  rows total:     ${before.inbound_total}`);
	console.log(`  rows prunable:  ${before.inbound_prunable}`);
	console.log(`  table size:     ${before.inbound_bytes}`);
	console.log('');
	console.log('sent_emails');
	console.log(`  rows total:     ${before.sent_total}`);
	console.log(`  rows prunable:  ${before.sent_prunable}`);
	console.log(`  table size:     ${before.sent_bytes}`);

	if (!apply) {
		console.log('\nDry run — no changes written.');
		return;
	}

	// Same code path the worker runs on a schedule, looped until drained — the
	// manual run is expected to clear the whole backlog in one go.
	console.log('\nDeleting inbound rows…');
	let inbound = 0;
	for (;;) {
		const r = await pruneInboundEmails({ days });
		inbound += r.rowsDeleted;
		if (!r.moreRemaining) break;
		console.log(`  …${inbound} rows so far`);
	}
	console.log(`  deleted ${inbound} row(s)`);

	console.log('\nDeleting sent rows…');
	let sent = 0;
	for (;;) {
		const r = await pruneSentEmails({ days });
		sent += r.rowsDeleted;
		if (!r.moreRemaining) break;
		console.log(`  …${sent} rows so far`);
	}
	console.log(`  deleted ${sent} row(s)`);

	if (doVacuum) {
		// VACUUM FULL cannot run inside a transaction block.
		console.log('\nVACUUM FULL inbound_emails, sent_emails — this locks them…');
		await db.execute(sql`VACUUM FULL inbound_emails`);
		await db.execute(sql`VACUUM FULL sent_emails`);
		console.log('  done');
	} else {
		console.log(
			'\nSkipped VACUUM FULL — table space is marked reusable but the files ' +
				'have not shrunk. Re-run with --vacuum to reclaim it.'
		);
	}

	const [after] = await queryRawDirect<{ inbound_bytes: string; sent_bytes: string }>(sql`
    SELECT
      pg_size_pretty(pg_total_relation_size('inbound_emails')) AS inbound_bytes,
      pg_size_pretty(pg_total_relation_size('sent_emails')) AS sent_bytes
  `);
	console.log(`\n  inbound_emails size now: ${after.inbound_bytes}`);
	console.log(`  sent_emails size now:    ${after.sent_bytes}`);
}

main()
	.then(() => process.exit(0))
	.catch((err) => {
		console.error(err);
		process.exit(1);
	});
