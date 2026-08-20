/**
 * The job and application tools against a real database, end to end and
 * self-cleaning.
 *
 * The unit tests mock every read these capabilities do, which is the right
 * trade for the logic and the wrong one for the question this file asks: the
 * job scope is SQL, `editable` is a claim about what `canEditJob` will say, and
 * the two are written in different modules. A mock cannot disagree with itself.
 *
 * It creates its own job, importer row and application, does everything to
 * them, and deletes them again — so it is re-runnable, and it never touches a
 * row that was there before it started.
 *
 *   npx dotenvx run -f /app/.env -- npx tsx scripts/verify-mcp-entities.ts <profileId>
 */
import { and, eq, gte, inArray, sql } from 'drizzle-orm';
import { db, queryRaw } from '$lib/server/db';
import {
	application_records,
	applications,
	capability_edits,
	capability_requests,
	job_importers,
	jobs,
	mcp_keys,
	notifications,
	profiles
} from '$lib/server/db/schema';
import { canEditJob } from '$lib/server/jobs/edit-job';
import { listProfileJobs, readProfileJob } from '$lib/server/jobs/profile-jobs';
import { readEditLog, revertEdit } from '$lib/server/ai-chat/edit-log';
import { CAPABILITIES, executeCapability } from '$lib/server/ai-chat/capabilities';
import { callTool } from '$lib/server/mcp/call';
import { createMcpKey } from '$lib/server/mcp/keys';
import { toolsFor } from '$lib/server/mcp/tools';
import type { VerifiedMcpKey } from '$lib/server/mcp/keys';

const profileId = Number(process.argv[2]);
if (!Number.isInteger(profileId)) {
	console.error('usage: verify-mcp-entities.ts <profileId>');
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

/**
 * What the job currently holds, read the way `read_job` reads it — through the
 * capabilities that write those columns rather than a query of this script's
 * own. A helper that went looking in the table itself would pass while the tool
 * it is standing in for showed something else.
 */
async function currentJob(jobId: number): Promise<Record<string, unknown>> {
	const target = { id: jobId, label: 'job' };
	const states = await Promise.all(
		(['edit_job_details', 'edit_job_description', 'edit_job_skills'] as const).map((capability) =>
			CAPABILITIES[capability].current(target, actor)
		)
	);
	return Object.assign({}, ...states);
}

async function main() {
	const [profile] = await db
		.select({ id: profiles.id, userId: profiles.user_id })
		.from(profiles)
		.where(eq(profiles.id, profileId))
		.limit(1);
	if (!profile?.userId) throw new Error(`profile ${profileId} has no user`);

	/* --- the scope, against what is already there ------------------------- */

	const inScope = await listProfileJobs(profileId, { limit: 50 });
	const editableOnly = await listProfileJobs(profileId, { limit: 50, editableOnly: true });
	console.log(
		`profile ${profileId}: ${inScope.length} jobs in scope (page of 50), ` +
			`${editableOnly.length} of them editable\n`
	);

	// The invariant the whole feature rests on: what a read calls editable is
	// exactly what the write gate will allow. Two modules, one answer.
	const disagreements: number[] = [];
	for (const job of inScope.slice(0, 15)) {
		if ((await canEditJob(job.id, profileId, false)) !== job.editable) disagreements.push(job.id);
	}
	check(
		'editable agrees with canEditJob on every job read',
		disagreements.length === 0,
		disagreements.join(', ')
	);
	check(
		'editable_only returns a subset',
		editableOnly.every((job) => job.editable)
	);

	const [outsider] = await queryRaw<{ id: number }>(sql`
		SELECT j.id FROM jobs j
		WHERE NOT EXISTS (SELECT 1 FROM job_importers ji WHERE ji.job_id = j.id AND ji.profile_id = ${profileId})
		  AND NOT EXISTS (SELECT 1 FROM applications a WHERE a.job_id = j.id AND a.profile_id = ${profileId})
		LIMIT 1
	`);
	if (outsider) {
		check(
			'a job outside the profile reads as absent',
			(await readProfileJob(outsider.id, profileId)) === null,
			`job ${outsider.id}`
		);
	} else {
		console.log('  --   no job outside this profile exists to test the scope against');
	}

	/* --- scratch rows ----------------------------------------------------- */

	const [job] = await db
		.insert(jobs)
		.values({
			title: 'ZZ Verify Scratch Job',
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
		name: 'ZZ Verify Scratch Key',
		scope: 'write',
		readScope: 'documents'
	});
	if (!minted) throw new Error('could not mint a key for this profile');

	const KEY: VerifiedMcpKey = {
		keyId: minted.id,
		userId: profile.userId,
		profileId,
		scope: 'write',
		// The wide end of the read dimension: this script exercises the write path,
		// and a `record` key would refuse the document tools it does not test.
		readScope: 'documents',
		name: 'ZZ Verify Scratch Key'
	};
	const readKey: VerifiedMcpKey = { ...KEY, scope: 'read' };

	try {
		/* --- the tool surface --------------------------------------------- */

		const tools = toolsFor('write');
		const names = new Set(tools.map((tool) => tool.name));
		check(
			'the five entity write tools are listed',
			[
				'edit_job_details',
				'edit_job_description',
				'edit_job_skills',
				'edit_application_details',
				'add_activity_record'
			].every((name) => names.has(name))
		);
		check(
			'the four entity read tools are listed',
			['list_jobs', 'read_job', 'list_applications', 'read_application'].every((n) => names.has(n)),
			`${tools.length} tools in total`
		);

		/* --- reads ---------------------------------------------------------- */

		const listed = await callTool('list_jobs', { profile_id: profileId, editable_only: true }, KEY);
		check('the scratch job is listed as editable', text(listed).includes(`[${job.id}]`));

		const readBack = await callTool('read_job', { profile_id: profileId, job_id: job.id }, KEY);
		check('read_job returns it', text(readBack).includes('ZZ Verify Scratch Job'));

		const listedApps = await callTool('list_applications', { profile_id: profileId }, KEY);
		check('the scratch application is listed', text(listedApps).includes(`[${application.id}]`));

		/* --- tier 1: filling an empty field --------------------------------- */

		const filled = await callTool(
			'edit_job_details',
			{
				profile_id: profileId,
				job_id: job.id,
				salary_min: 75000,
				salary_currency: 'EUR',
				rationale: 'Verification script.'
			},
			KEY
		);
		const editId = filled.structuredContent?.change_id as number | undefined;
		check('an empty job field is filled directly', filled.structuredContent?.applied === true);
		check(
			'the change is undoable, and says so',
			filled.structuredContent?.undoable === true,
			editId
		);

		check('the value landed', (await currentJob(job.id)).salary_min === 75000);

		/* --- undo ----------------------------------------------------------- */

		const undone = editId ? await revertEdit(editId, actor) : { ok: false as const };
		check('the change undoes', undone.ok === true, 'ok' in undone ? '' : undone);
		const afterUndo = await currentJob(job.id);
		check('the field is empty again', afterUndo.salary_min === null, afterUndo.salary_min);

		/* --- two changes to one field, undone in the wrong order ------------ */

		// Written through executeCapability rather than a tool call, because two
		// DIRECT writes to one field cannot happen over MCP: the second is an
		// overwrite and becomes a request. The chat's Apply button takes exactly
		// this path, and the log rows are identical either way — which is the
		// point, since undo is about the log and not about who wrote it.
		const target = { id: job.id, label: 'ZZ Verify Scratch Job at Verify Co' };
		const first = await executeCapability(
			'edit_job_details',
			target,
			actor,
			{ salary_min: 60000 },
			'chat'
		);
		const second = await executeCapability(
			'edit_job_details',
			target,
			actor,
			{ salary_min: 90000 },
			'chat'
		);
		const firstId = first.ok ? first.editId : null;
		const secondId = second.ok ? second.editId : null;
		check('two changes to one field are both logged', firstId !== null && secondId !== null);

		const feed = await readEditLog(profileId, 10);
		check(
			'the feed marks the older one as blocked by the newer',
			feed.find((e) => e.id === firstId)?.supersededBy === secondId,
			feed.find((e) => e.id === firstId)?.supersededBy
		);

		const outOfOrder = firstId ? await revertEdit(firstId, actor) : { ok: true as const };
		check(
			'undoing the older one first is refused',
			outOfOrder.ok === false && outOfOrder.reason === 'superseded',
			'ok' in outOfOrder && outOfOrder.ok ? '' : (outOfOrder as { error: string }).error
		);
		check(
			'and nothing was written by the refusal',
			(await currentJob(job.id)).salary_min === 90000
		);

		const undoNewest = secondId ? await revertEdit(secondId, actor) : { ok: false as const };
		check('undoing the newest works', undoNewest.ok === true);
		check(
			'which puts back what the older change wrote',
			(await currentJob(job.id)).salary_min === 60000
		);

		const undoOlder = firstId ? await revertEdit(firstId, actor) : { ok: false as const };
		check('and then the older one goes back too', undoOlder.ok === true);
		check('landing on the value before either', (await currentJob(job.id)).salary_min === null);

		/* --- tier 2: overwriting authored prose ----------------------------- */

		await db
			.update(jobs)
			.set({ job_description: 'The posting as the applicant typed it.' })
			.where(eq(jobs.id, job.id));

		const rewrite = await callTool(
			'edit_job_description',
			{
				profile_id: profileId,
				job_id: job.id,
				job_description: 'A rewrite nobody approved.',
				rationale: 'Verification script.'
			},
			KEY
		);
		check('a rewrite is not applied on a write key', rewrite.structuredContent?.applied === false);
		check(
			'it comes back as a request with a link',
			typeof rewrite.structuredContent?.review_at === 'string',
			rewrite.structuredContent?.review_at
		);
		check(
			'the posting is untouched',
			(await currentJob(job.id)).job_description === 'The posting as the applicant typed it.'
		);

		/* --- an entry filed under an application ---------------------------- */

		const logged = await callTool(
			'add_activity_record',
			{
				profile_id: profileId,
				application_id: application.id,
				entry_content: 'Verification script wrote this entry.',
				entry_title: 'ZZ Verify Scratch Entry',
				rationale: 'Verification script.'
			},
			KEY
		);
		check('an entry is filed directly', logged.structuredContent?.applied === true);
		check(
			'an add offers no undo, and names the page instead',
			logged.structuredContent?.undoable === false &&
				text(logged).includes(`/applications/${application.id}`)
		);

		// Read the way `read_application` reads it: through the capability that
		// writes entries, which is also what renders the chronology to a model.
		const chronology = await CAPABILITIES.add_activity_record.current(
			{ id: application.id, label: 'application' },
			actor
		);
		const loggedEntries = (chronology.recent_entries as string[]) ?? [];
		check('the entry is on the application', loggedEntries.length === 1, loggedEntries[0]);

		/* --- application details, and their undo ---------------------------- */

		const details = await callTool(
			'edit_application_details',
			{
				profile_id: profileId,
				application_id: application.id,
				cv_sent_through: 'Verification script',
				rationale: 'Verification script.'
			},
			KEY
		);
		const detailEditId = details.structuredContent?.change_id as number | undefined;
		check(
			'an empty application field is filled directly',
			details.structuredContent?.applied === true
		);
		const detailsBack =
			detailEditId !== undefined && (await revertEdit(detailEditId, actor)).ok === true;
		const applicationNow = await CAPABILITIES.edit_application_details.current(
			{ id: application.id, label: 'application' },
			actor
		);
		check('and it undoes back to empty', detailsBack && applicationNow.cv_sent_through === null);

		/* --- refusals ------------------------------------------------------- */

		const readOnly = await callTool(
			'edit_job_details',
			{ profile_id: profileId, job_id: job.id, salary_min: 1, rationale: 'x' },
			readKey
		);
		check('a read key cannot write', readOnly.isError === true);

		const wrongProfile = await callTool(
			'read_job',
			{ profile_id: profileId + 100000, job_id: job.id },
			KEY
		);
		check('a key reaches one profile', wrongProfile.isError === true);

		if (outsider) {
			const outOfScope = await callTool(
				'edit_job_details',
				{ profile_id: profileId, job_id: outsider.id, salary_min: 1, rationale: 'x' },
				KEY
			);
			check(
				'a job outside the profile cannot be named',
				outOfScope.isError === true,
				text(outOfScope).slice(0, 60)
			);
		}
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
		await db.delete(applications).where(eq(applications.id, application.id));
		// job_importers cascades from the job.
		await db.delete(jobs).where(eq(jobs.id, job.id));
		await db.delete(mcp_keys).where(eq(mcp_keys.id, minted.id));

		const leftover = await db
			.select({ id: jobs.id })
			.from(jobs)
			.where(eq(jobs.id, job.id))
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
