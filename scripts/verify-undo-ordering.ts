/**
 * The undo ordering guard, against a real database, end to end and
 * self-cleaning.
 *
 * There is one before-image per change per field and no version history, so an
 * undo is the inverse of its own write only while nothing has been written on
 * top of it:
 *
 *   v0 --A--> v1 --B--> v2      A recorded v0, B recorded v1
 *
 * B then A lands on v0, which is right. A then B writes v0 over v2 — discarding
 * B while B still reads as applied — and then writes v1, a value nobody chose.
 * `revertEdit` must refuse A while B stands, and name B.
 *
 * The unit tests cover `supersedingChange` on constructed entries. What they
 * cannot cover is that the refusal and the `undo_blocked_by` an agent reads over
 * MCP are the same answer: one is computed in SQL against the table at undo
 * time, the other in memory over a page of the log, in different functions. A
 * mock cannot disagree with itself.
 *
 * It creates its own language row, edits it twice, undoes both and deletes
 * everything it made — so it is re-runnable, and it never touches a row that was
 * there before it started.
 *
 *   npx dotenvx run -f /app/.env -- npx tsx scripts/verify-undo-ordering.ts <profileId>
 */
import { and, eq, inArray } from 'drizzle-orm';
import { db } from '$lib/server/db';
import { capability_edits, languages, profiles } from '$lib/server/db/schema';
import { readEditLog, revertEdit } from '$lib/server/ai-chat/edit-log';
import { executeCapability, type CapabilityTarget } from '$lib/server/ai-chat/capabilities';

const profileId = Number(process.argv[2]);
if (!Number.isInteger(profileId)) {
	console.error('usage: verify-undo-ordering.ts <profileId>');
	process.exit(1);
}
const actor = { profileId, isStaff: false };

let failures = 0;
function check(what: string, ok: boolean, detail: unknown = '') {
	console.log(`${ok ? '  ok  ' : ' FAIL '} ${what}${detail === '' ? '' : `  → ${detail}`}`);
	if (!ok) failures++;
}

/** The scratch row's proficiency, read from the table rather than from an outcome. */
async function proficiencyOf(id: number): Promise<string | null> {
	const [row] = await db
		.select({ value: languages.proficiency })
		.from(languages)
		.where(eq(languages.id, id))
		.limit(1);
	return row?.value ?? null;
}

/** Write one field through the capability, and hand back the edit it logged. */
async function edit(target: CapabilityTarget, proficiency: string): Promise<number> {
	const outcome = await executeCapability(
		'edit_language',
		target,
		actor,
		{ 'language.proficiency': proficiency },
		'mcp'
	);
	if (!outcome.ok) throw new Error(`edit to "${proficiency}" failed: ${outcome.error}`);
	if (outcome.editId === null) throw new Error(`edit to "${proficiency}" logged nothing`);
	return outcome.editId;
}

async function main() {
	const [profile] = await db
		.select({ id: profiles.id })
		.from(profiles)
		.where(eq(profiles.id, profileId))
		.limit(1);
	if (!profile) throw new Error(`no profile ${profileId}`);

	const [scratch] = await db
		.insert(languages)
		.values({
			profile_id: profileId,
			name: 'Zzz Scratch (verify-undo-ordering)',
			language_code: 'zz',
			proficiency: null,
			status: 'draft',
			date_created: new Date()
		})
		.returning({ id: languages.id });

	const target: CapabilityTarget = { id: scratch.id, label: 'Zzz Scratch (verify-undo-ordering)' };
	const made: number[] = [];

	try {
		/* --- v0 --A--> v1 --B--> v2 -------------------------------------- */

		const a = await edit(target, 'basic');
		made.push(a);
		const b = await edit(target, 'fluent');
		made.push(b);

		check('the second write landed', (await proficiencyOf(scratch.id)) === 'fluent');

		/* --- the read an agent gets over MCP ------------------------------ */

		const log = await readEditLog(profileId, 50);
		const loggedA = log.find((e) => e.id === a);
		const loggedB = log.find((e) => e.id === b);

		check('both changes are in the log', Boolean(loggedA && loggedB));
		check(
			'the older change reports the newer one as blocking it',
			loggedA?.supersededBy === b,
			`undo_blocked_by=${loggedA?.supersededBy} expected=${b}`
		);
		check('the newer change reports nothing blocking it', loggedB?.supersededBy === null);

		/* --- the guard itself --------------------------------------------- */

		const refused = await revertEdit(a, actor);
		check(
			'undoing the older change out of order is refused',
			!refused.ok && refused.reason === 'superseded',
			refused.ok ? 'it was allowed' : refused.reason
		);
		check(
			'the refusal names the change to take back first',
			!refused.ok && /undo/i.test(refused.error),
			refused.ok ? '' : refused.error
		);
		// The refusal has to be inert. A guard that refused *after* writing would
		// pass every assertion above and still have destroyed the value.
		check('the refused undo changed nothing', (await proficiencyOf(scratch.id)) === 'fluent');

		/* --- and in the right order it works ------------------------------ */

		const undoB = await revertEdit(b, actor);
		check('undoing the newer change is allowed', undoB.ok, undoB.ok ? '' : undoB.error);
		check(
			'it put back what the newer change replaced',
			(await proficiencyOf(scratch.id)) === 'basic'
		);

		const undoA = await revertEdit(a, actor);
		check('the older change can then be undone', undoA.ok, undoA.ok ? '' : undoA.error);
		check('the row is back where it started', (await proficiencyOf(scratch.id)) === null);

		const twice = await revertEdit(a, actor);
		check(
			'undoing the same change twice is refused',
			!twice.ok && twice.reason === 'already_reverted',
			twice.ok ? 'it was allowed' : twice.reason
		);
	} finally {
		if (made.length > 0) {
			await db
				.delete(capability_edits)
				.where(and(eq(capability_edits.profile_id, profileId), inArray(capability_edits.id, made)));
		}
		await db.delete(languages).where(eq(languages.id, scratch.id));

		const leftover = await db
			.select({ id: languages.id })
			.from(languages)
			.where(eq(languages.id, scratch.id))
			.limit(1);
		check('the scratch rows are gone', leftover.length === 0);
	}

	console.log(failures === 0 ? '\nall checks passed' : `\n${failures} FAILED`);
	process.exit(failures === 0 ? 0 : 1);
}

main().catch((e) => {
	console.error(e);
	process.exit(1);
});
