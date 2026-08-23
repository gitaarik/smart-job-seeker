#!/usr/bin/env npx tsx
/**
 * Move historical runs from `platform_unreachable` to `device_unavailable`
 * where the run's own logs prove the platform was never contacted.
 *
 * The live classifier tested `includes("connection")` on the error message,
 * and `Tunnel connection timeout — device not connected` contains it. So every
 * run that failed because the user's machine was offline was recorded as the
 * job site being unreachable, and told the user so. Fixed forward on
 * 2026-08-23 by tagging the cause at the throw site; this is the backward half.
 *
 * **Why this can't be a `classifyLegacyErrorMessage` branch.** That function
 * reads `search_task_runs.error_message`, which for these rows is the
 * *rendered* sentence "Could not connect to platform" — identical to what a
 * genuine outage would have written. The evidence is one layer down, in the
 * `scraper_logs` line the run wrote for itself, so this joins to it.
 *
 * Consequently it can only fix what it can prove. `scraper_logs` is pruned at
 * 30 days, so older runs have no evidence either way and are left alone and
 * counted. A row whose logs prove something *else* is reported rather than
 * touched — if that count is not zero, the assumption behind this script is
 * wrong and it should not be run.
 *
 * Two things change, and the second is opt-in because it rewrites prose a
 * person may have read:
 *
 *   --apply           `failure_kind` → device_unavailable (what policy reads)
 *   --with-messages   also correct `error_message`, which currently tells the
 *                     user the job site was down
 *
 * Runs inside the app container. From cloud/:
 *
 *   npm run db:reclassify-device-failures
 *   npm run db:reclassify-device-failures -- --apply --with-messages
 */
import { sql } from 'drizzle-orm';
import { queryRawDirect } from '$lib/server/db';

const args = process.argv.slice(2);
const apply = args.includes('--apply');
const withMessages = args.includes('--with-messages');

/** What the run itself logged when the tunnel never produced a device. */
const TUNNEL_EVIDENCE = sql`(
  l.message ILIKE '%tunnel connection timeout%'
  OR l.message ILIKE '%device not connected%'
  OR l.message ILIKE '%tunnel device connection is not open%'
)`;
// Deliberately NOT matching the watchdog's "(likely a dead tunnel)". That
// message guesses, and run 1228 fired it with a live tunnel on job 35 of 100 —
// so treating it as evidence would launder speculation into a column the retry
// policy acts on.

/** Mirrors ERROR_MESSAGES.deviceUnavailable in the cloud tree. */
const DEVICE_MESSAGE = "Your device wasn't connected";

async function main() {
	console.log('Reclassifying platform_unreachable runs that were really device failures');
	console.log(`  mode:     ${apply ? 'APPLY' : 'dry run (pass --apply to write)'}`);
	console.log(`  messages: ${withMessages ? 'also corrected' : 'left alone (--with-messages)'}`);
	console.log('');

	const [counts] = await queryRawDirect<{
		total: string;
		proven: string;
		contradicted: string;
		no_evidence: string;
	}>(sql`
    WITH candidates AS (
      SELECT r.id,
             EXISTS (SELECT 1 FROM scraper_logs l
                      WHERE l.run_id = r.id AND l.level = 'error' AND ${TUNNEL_EVIDENCE})
               AS tunnel,
             EXISTS (SELECT 1 FROM scraper_logs l WHERE l.run_id = r.id AND l.level = 'error')
               AS has_logs
        FROM search_task_runs r
       WHERE r.failure_kind = 'platform_unreachable'
    )
    SELECT count(*)::text AS total,
           count(*) FILTER (WHERE tunnel)::text AS proven,
           count(*) FILTER (WHERE has_logs AND NOT tunnel)::text AS contradicted,
           count(*) FILTER (WHERE NOT has_logs)::text AS no_evidence
      FROM candidates
  `);

	console.log(`  platform_unreachable rows:  ${counts.total}`);
	console.log(`  proven device failures:     ${counts.proven}`);
	console.log(`  logs say otherwise:         ${counts.contradicted}`);
	console.log(`  no surviving logs:          ${counts.no_evidence}  (left alone)`);

	if (Number(counts.contradicted) > 0) {
		// Not fatal, but it means "all of them were tunnels" no longer holds and
		// somebody should look before trusting this script's premise again.
		console.log('');
		console.log('  ⚠️  Some runs have error logs that are NOT tunnel failures.');
		console.log('      Those are left untouched, but the premise is worth re-checking:');
		const rows = await queryRawDirect<{ id: number; message: string }>(sql`
      SELECT r.id, left(l.message, 90) AS message
        FROM search_task_runs r
        JOIN scraper_logs l ON l.run_id = r.id AND l.level = 'error'
       WHERE r.failure_kind = 'platform_unreachable'
         AND NOT EXISTS (SELECT 1 FROM scraper_logs l2
                          WHERE l2.run_id = r.id AND l2.level = 'error' AND ${TUNNEL_EVIDENCE})
       ORDER BY r.id DESC
       LIMIT 10
    `);
		for (const r of rows) console.log(`        run ${r.id}: ${r.message}`);
	}

	if (Number(counts.proven) === 0) {
		console.log('\nNothing to reclassify.');
		return;
	}

	if (!apply) {
		console.log('\nDry run — no changes written.');
		return;
	}

	const updated = await queryRawDirect<{ id: number }>(sql`
    UPDATE search_task_runs r
       SET failure_kind = 'device_unavailable'
           ${withMessages ? sql`, error_message = ${DEVICE_MESSAGE}` : sql``}
     WHERE r.failure_kind = 'platform_unreachable'
       AND EXISTS (SELECT 1 FROM scraper_logs l
                    WHERE l.run_id = r.id AND l.level = 'error' AND ${TUNNEL_EVIDENCE})
    RETURNING r.id
  `);
	console.log(`\n  reclassified ${updated.length} run(s)`);
	if (withMessages) console.log(`  error_message set to “${DEVICE_MESSAGE}”`);
}

main()
	.then(() => process.exit(0))
	.catch((err) => {
		console.error(err);
		process.exit(1);
	});
