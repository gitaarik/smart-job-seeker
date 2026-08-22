/**
 * Mark pre-existing accounts as email-verified.
 *
 * `requireEmailVerification` was turned on in `auth/better-auth.ts`. Every
 * account created before that predates the requirement: the verification mail
 * was sent but nothing ever depended on the click, so almost nobody clicked.
 * Turning the flag on without this script locks those users out of their own
 * data — measured 2026-08-22, it would have locked out **13 of 13** real
 * accounts on preview and 5 of 7 on dev.
 *
 * Verifying them by fiat is defensible precisely because of how they got in:
 * registration has been invite-only, and an admin approved each one by hand.
 * That is a stronger check on the address than the click this substitutes for.
 * It is *not* defensible for anything created after registration opens, which
 * is why this takes a cutoff and defaults it to now.
 *
 * Safe to re-run — only touches rows where `emailVerified` is not already true.
 * Dry-run by default.
 *
 *   # from cloud/oss, against whichever DB SJS_DATABASE_URL points at
 *   npx dotenvx run -f ../.env -- npx tsx scripts/backfill-email-verified.ts
 *   npx dotenvx run -f ../.env -- npx tsx scripts/backfill-email-verified.ts --apply
 *   ... --before 2026-08-22            # only accounts older than this
 */

import { dbDirect as db } from '$lib/server/db';
import { and, eq, lt, ne, or, isNull } from 'drizzle-orm';
import { users } from '$lib/server/db/schema';

const APPLY = process.argv.includes('--apply');

function parseBefore(): Date {
	const i = process.argv.indexOf('--before');
	if (i === -1) return new Date();
	const raw = process.argv[i + 1];
	const d = new Date(raw);
	if (isNaN(d.getTime())) {
		console.error(`Invalid --before date: ${raw}`);
		process.exit(1);
	}
	return d;
}

async function main() {
	const before = parseBefore();

	// `emailVerified` is nullable as well as false-able; both mean unverified.
	const unverified = or(isNull(users.emailVerified), eq(users.emailVerified, false));

	const rows = await db.query.users.findMany({
		where: and(unverified, lt(users.createdAt, before)),
		columns: { id: true, email: true, is_demo: true, createdAt: true, is_approved: true }
	});

	// Demo accounts sign in through a minted session rather than a password and
	// carry a synthetic, non-routable address — verifying those would be
	// meaningless, and they are reaped rather than kept.
	const real = rows.filter((r) => !r.is_demo);
	const demo = rows.length - real.length;

	console.log(`Accounts created before ${before.toISOString()} with an unverified address:`);
	console.log(`  ${real.length} real (${real.filter((r) => r.is_approved).length} approved)`);
	console.log(`  ${demo} demo — skipped`);
	for (const r of real) {
		console.log(`    ${r.email}  created=${r.createdAt?.toISOString() ?? 'unknown'}`);
	}

	if (real.length === 0) {
		console.log('\nNothing to do.');
		return;
	}

	if (!APPLY) {
		console.log('\nDry run. Re-run with --apply to write.');
		return;
	}

	let updated = 0;
	for (const r of real) {
		const res = await db
			.update(users)
			.set({ emailVerified: true, updatedAt: new Date() })
			.where(and(eq(users.id, r.id), ne(users.is_demo, true)));
		updated += res.rowCount ?? 0;
	}
	console.log(`\nVerified ${updated} account(s).`);
}

main()
	.then(() => process.exit(0))
	.catch((err) => {
		console.error(err);
		process.exit(1);
	});
