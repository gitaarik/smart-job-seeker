/**
 * Undoing a logged timeline entry, against a real database, end to end and
 * self-cleaning.
 *
 * The unit tests pin what `add_activity_record`'s revert decides. This asks
 * what a mock cannot: that the edit log names the entry the add made, that the
 * undo takes that row and nothing else, that the summary is rebuilt without it,
 * that an entry a person has since edited or given a file is left alone, and
 * that MCP tells an agent the undo exists (planning/LOG-AS-YOU-GO.md, Phase 1).
 *
 * It creates its own job, application, key, file row and entries, and deletes
 * them again, so it is re-runnable and never touches a row that was there
 * before. The summariser runs for real: a few small calls on a scratch
 * application.
 *
 *   npx dotenvx run -f /app/.env -- npx tsx scripts/verify-log-undo.ts <profileId>
 */
import { randomUUID } from 'node:crypto';
import { and, eq, gte, inArray } from 'drizzle-orm';
import { db } from '$lib/server/db';
import {
	application_records,
	applications,
	capability_edits,
	capability_requests,
	files,
	job_importers,
	jobs,
	mcp_keys,
	notifications,
	profiles
} from '$lib/server/db/schema';
import { readEditLog, revertEdit } from '$lib/server/ai-chat/edit-log';
import { callTool } from '$lib/server/mcp/call';
import { createMcpKey, type VerifiedMcpKey } from '$lib/server/mcp/keys';

const profileId = Number(process.argv[2]);
if (!Number.isInteger(profileId)) {
	console.error('usage: verify-log-undo.ts <profileId>');
	process.exit(1);
}
const actor = { profileId, isStaff: false };
const startedAt = new Date();

let failures = 0;
function check(what: string, ok: boolean, detail: unknown = '') {
	console.log(`${ok ? '  ok  ' : ' FAIL '} ${what}${detail === '' ? '' : `  → ${detail}`}`);
	if (!ok) failures++;
}

function text(result: { content: { text: string }[] }): string {
	return result.content.map((part) => part.text).join('\n');
}

async function entryExists(id: number): Promise<boolean> {
	const rows = await db
		.select({ id: application_records.id })
		.from(application_records)
		.where(eq(application_records.id, id))
		.limit(1);
	return rows.length > 0;
}

async function summaryOf(applicationId: number) {
	const [row] = await db
		.select({
			at: applications.context_summary_at,
			details: applications.context_details
		})
		.from(applications)
		.where(eq(applications.id, applicationId))
		.limit(1);
	return row;
}

function cites(details: unknown, entryId: number): boolean {
	return (
		Array.isArray(details) &&
		details.some((d) => (d as { record_id?: unknown }).record_id === entryId)
	);
}

async function main() {
	const [profile] = await db
		.select({ id: profiles.id, userId: profiles.user_id })
		.from(profiles)
		.where(eq(profiles.id, profileId))
		.limit(1);
	if (!profile?.userId) throw new Error(`profile ${profileId} has no user`);

	/* --- scratch rows ----------------------------------------------------- */

	const [job] = await db
		.insert(jobs)
		.values({
			title: 'ZZ Verify Log Undo Job',
			company: 'Verify Co',
			status: 'draft',
			created_manually: true,
			date_created: new Date(),
			date_updated: new Date()
		})
		.returning({ id: jobs.id });
	await db.insert(job_importers).values({ job_id: job.id, profile_id: profileId });

	const [application] = await db
		.insert(applications)
		.values({
			profile_id: profileId,
			job_id: job.id,
			status: 'draft',
			date_created: new Date(),
			date_updated: new Date()
		})
		.returning({ id: applications.id });

	const minted = await createMcpKey({
		userId: profile.userId,
		profileId,
		name: 'ZZ Verify Log Undo Key',
		scope: 'write',
		readScope: 'record'
	});
	if (!minted) throw new Error('could not mint a key for this profile');
	const KEY: VerifiedMcpKey = {
		keyId: minted.id,
		userId: profile.userId,
		profileId,
		scope: 'write',
		readScope: 'record',
		name: 'ZZ Verify Log Undo Key'
	};

	const fileId = randomUUID();

	/** Log one entry the way an agent does: through the tool, on a write key. */
	async function log(content: string, title: string) {
		const result = await callTool(
			'add_activity_record',
			{
				profile_id: profileId,
				application_id: application.id,
				entry_content: content,
				entry_title: title,
				rationale: 'verify-log-undo'
			},
			KEY
		);
		const changeId =
			typeof result.structuredContent?.change_id === 'number'
				? result.structuredContent.change_id
				: null;
		const [edit] = changeId
			? await db
					.select({ target: capability_edits.target })
					.from(capability_edits)
					.where(eq(capability_edits.id, changeId))
					.limit(1)
			: [];
		return { result, changeId, entryId: edit?.target.id ?? null };
	}

	try {
		/* --- logging says it can be undone ---------------------------------- */

		// Two that stay, so the application still has the summariser's minimum
		// after the undo: then it rebuilds the summary, where with one left it
		// would only clear it, and "no longer cites the entry" would pass for free.
		const kept = await log('Screening call booked for Monday at 10:00.', 'Screening call booked');
		await log(
			'The hiring manager is Sam Park; the process is three rounds.',
			'Process and contact'
		);
		const logged = await log(
			'Recruiter said the salary range is 90,000 to 100,000 and the team works two office days a week.',
			'Recruiter call: salary range and office days'
		);

		check(
			'the tool reports the entry as applied',
			logged.result.structuredContent?.applied === true
		);
		check('and as undoable', logged.result.structuredContent?.undoable === true);
		check(
			'and points at the changes feed, not the Activity tab',
			text(logged.result).includes('/data/ai-changes'),
			text(logged.result).split('\n').slice(-1)[0]
		);
		if (!logged.changeId || !logged.entryId || !kept.changeId || !kept.entryId) {
			throw new Error('the log did not produce a change and an entry to undo');
		}

		const feed = await readEditLog(profileId, 20);
		check(
			'the feed offers an undo for it',
			feed.find((entry) => entry.id === logged.changeId)?.revertible === true
		);

		const before = await summaryOf(application.id);
		const citedBefore = cites(before?.details, logged.entryId);
		console.log(
			`  --   the summary ${citedBefore ? 'cites' : 'does not cite'} the entry before the undo`
		);

		/* --- the undo ------------------------------------------------------- */

		const undone = await revertEdit(logged.changeId, actor);
		check('the undo succeeds', undone.ok, undone.ok ? '' : undone.error);
		check('and the entry is gone', !(await entryExists(logged.entryId)));
		check('and nothing else on the timeline went with it', await entryExists(kept.entryId));

		const after = await summaryOf(application.id);
		check(
			'the summary was rebuilt',
			!!after?.at && (!before?.at || after.at.getTime() > before.at.getTime())
		);
		check('and no longer cites the entry', !cites(after?.details, logged.entryId));

		const [marked] = await db
			.select({ reverted: capability_edits.reverted_at })
			.from(capability_edits)
			.where(eq(capability_edits.id, logged.changeId));
		check('the change is marked undone in the log', marked?.reverted !== null);

		const again = await revertEdit(logged.changeId, actor);
		check(
			'a second undo is refused as already done',
			!again.ok && again.reason === 'already_reverted'
		);

		/* --- what it leaves alone ------------------------------------------- */

		const edited = await log('Take-home task arrived, due Friday.', 'Take-home task');
		if (!edited.changeId || !edited.entryId) throw new Error('no second entry to edit');
		await db
			.update(application_records)
			.set({ date_updated: new Date() })
			.where(eq(application_records.id, edited.entryId));
		const refusedEdit = await revertEdit(edited.changeId, actor);
		check(
			'an entry a person edited since is not undone',
			!refusedEdit.ok && /edited/.test(refusedEdit.error),
			refusedEdit.ok ? 'undone' : refusedEdit.error
		);
		check('and it is still there', await entryExists(edited.entryId));

		const filed = await log('Sent the signed NDA back.', 'NDA signed');
		if (!filed.changeId || !filed.entryId) throw new Error('no third entry to attach to');
		await db.insert(files).values({
			id: fileId,
			storage: 'local',
			filename_download: 'zz-verify-log-undo.txt'
		});
		await db
			.update(application_records)
			.set({ file_id: fileId })
			.where(eq(application_records.id, filed.entryId));
		const refusedFile = await revertEdit(filed.changeId, actor);
		check(
			'an entry that has a file attached since is not undone',
			!refusedFile.ok && /file attached/.test(refusedFile.error),
			refusedFile.ok ? 'undone' : refusedFile.error
		);
		check('and it is still there', await entryExists(filed.entryId));

		const stranger = await revertEdit(kept.changeId, { profileId: -profileId, isStaff: false });
		check(
			"another profile cannot undo this profile's entry",
			!stranger.ok && stranger.reason === 'not_found'
		);
		check('and it is still there', await entryExists(kept.entryId));
	} finally {
		/* --- cleanup -------------------------------------------------------- */

		const requests = await db
			.select({ id: capability_requests.id })
			.from(capability_requests)
			.where(
				and(
					eq(capability_requests.profile_id, profileId),
					gte(capability_requests.date_created, startedAt)
				)
			);
		if (requests.length > 0) {
			await db.delete(capability_requests).where(
				inArray(
					capability_requests.id,
					requests.map((r) => r.id)
				)
			);
		}
		await db
			.delete(capability_edits)
			.where(
				and(
					eq(capability_edits.profile_id, profileId),
					gte(capability_edits.date_created, startedAt)
				)
			);
		await db
			.delete(notifications)
			.where(
				and(eq(notifications.user_id, profile.userId), gte(notifications.created_at, startedAt))
			);
		await db
			.delete(application_records)
			.where(eq(application_records.application_id, application.id));
		await db.delete(files).where(eq(files.id, fileId));
		await db.delete(applications).where(eq(applications.id, application.id));
		// job_importers cascades from the job.
		await db.delete(jobs).where(eq(jobs.id, job.id));
		await db.delete(mcp_keys).where(eq(mcp_keys.id, minted.id));

		const leftover = await db
			.select({ id: applications.id })
			.from(applications)
			.where(eq(applications.id, application.id))
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
