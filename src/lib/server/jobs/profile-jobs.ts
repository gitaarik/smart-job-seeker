/**
 * Which jobs a profile may name through an agent, and which of those it may
 * change.
 *
 * ## Why this module exists at all
 *
 * `jobs` is the one table in the write registry with no owner column. A row is
 * shared: the same posting matched to four applicants is one row, and
 * `/jobs/[id]` renders any of them to any signed-in user. That is fine for a
 * browser — a person clicks a link from their own list — and it is not fine for
 * a credential handed to an agent, where "read the job with this id" in a loop
 * walks the whole table, including the hand-typed ones that carry a recruiter's
 * name and a phone number.
 *
 * So the MCP surface does not address `jobs` by id. It addresses *this
 * profile's* jobs, and an id outside that set reads exactly like an id that
 * does not exist. The set is the union of two facts already recorded:
 *
 *  - `job_importers` — this profile put the job in, by hand or by a scrape.
 *  - `applications` — this profile applied to it, whoever imported it.
 *
 * The second is not redundant. An application's job is one the applicant
 * demonstrably has in front of them, and an agent helping with that application
 * has to be able to read it; the importer row is the *usual* reason it is in
 * scope, not the only one.
 *
 * ## Reading is wider than writing, deliberately
 *
 * `editable` mirrors `canEditJobContent` exactly — hand-created, and created by
 * this profile — so a job can be readable here and still refuse every write.
 * That is the same shape the UI has, where the job page renders for everyone
 * and its edit form appears for one. Nothing infers a write right from a read:
 * every write goes through the capability's own `authorize`, which asks
 * `canEditJob` again against a fresh read.
 */

import { db, queryRaw } from '$lib/server/db';
import { and, eq, sql } from 'drizzle-orm';
import { applications, job_importers, jobs } from '$lib/server/db/schema';

/** How many jobs one call may return. A profile's scope runs to thousands. */
export const JOB_PAGE_DEFAULT = 20;
export const JOB_PAGE_MAX = 50;

export interface ProfileJobSummary {
	id: number;
	title: string | null;
	company: string | null;
	date_posted: string | null;
	source_url: string | null;
	/** Whether this profile put the job here, as opposed to only applying to it. */
	imported: boolean;
	applied: boolean;
	/** Hand-created by this profile: the only jobs any write can reach. */
	editable: boolean;
}

/**
 * Deliberately the same shape as a list row.
 *
 * This module answers "may this profile see this job, and may it change it".
 * What the job currently HOLDS is a different question with an existing answer:
 * each job capability's `current()`, which is what the prompt, the proposal
 * card and the coercion already read. Listing those columns again here would be
 * a second copy of a declaration that exists precisely so there is one.
 */
export type ProfileJobDetail = ProfileJobSummary;

/**
 * The profile's own jobs, newest first.
 *
 * Raw SQL for the same reason `list-jobs.ts` is: the membership test and the
 * two flags are all the same `EXISTS` pair, and expressing them as three
 * separate round trips per row would be slower and no clearer.
 */
export async function listProfileJobs(
	profileId: number,
	opts: { limit?: number; editableOnly?: boolean } = {}
): Promise<ProfileJobSummary[]> {
	const limit = Math.min(Math.max(opts.limit ?? JOB_PAGE_DEFAULT, 1), JOB_PAGE_MAX);
	const imported = sql`EXISTS (SELECT 1 FROM job_importers ji WHERE ji.job_id = j.id AND ji.profile_id = ${profileId})`;
	const applied = sql`EXISTS (SELECT 1 FROM applications a WHERE a.job_id = j.id AND a.profile_id = ${profileId})`;
	// The editable set is a subset of the imported one, so it needs no separate
	// membership clause — only the two conditions canEditJobContent asks for.
	const scope = opts.editableOnly
		? sql`j.created_manually AND ${imported}`
		: sql`(${imported} OR ${applied})`;

	const rows = await queryRaw<{
		id: number;
		title: string | null;
		company: string | null;
		date_posted: string | null;
		source_url: string | null;
		created_manually: boolean;
		imported: boolean;
		applied: boolean;
	}>(sql`
		SELECT j.id, j.title, j.company, j.date_posted, j.source_url, j.created_manually,
		       ${imported} AS imported,
		       ${applied} AS applied
		FROM jobs j
		WHERE ${scope}
		ORDER BY j.date_created DESC NULLS LAST, j.id DESC
		LIMIT ${limit}
	`);

	return rows.map((row) => ({
		id: row.id,
		title: row.title,
		company: row.company,
		date_posted: row.date_posted,
		source_url: row.source_url,
		imported: row.imported,
		applied: row.applied,
		editable: row.created_manually && row.imported
	}));
}

/**
 * One job, or null when it is not this profile's to see.
 *
 * Null and not a refusal: a job outside the scope and a job that was deleted
 * are the same answer on purpose, because telling them apart is how an agent
 * enumerates the table it cannot read.
 */
export async function readProfileJob(
	jobId: number,
	profileId: number
): Promise<ProfileJobDetail | null> {
	const job = await db.query.jobs.findFirst({
		where: eq(jobs.id, jobId),
		columns: {
			id: true,
			title: true,
			company: true,
			date_posted: true,
			source_url: true,
			created_manually: true
		}
	});
	if (!job) return null;

	const importer = await db.query.job_importers.findFirst({
		where: and(eq(job_importers.job_id, jobId), eq(job_importers.profile_id, profileId)),
		columns: { job_id: true }
	});
	const application = await db.query.applications.findFirst({
		where: and(eq(applications.job_id, jobId), eq(applications.profile_id, profileId)),
		columns: { id: true }
	});
	if (!importer && !application) return null;

	return {
		id: job.id,
		title: job.title,
		company: job.company,
		date_posted: job.date_posted,
		source_url: job.source_url,
		imported: !!importer,
		applied: !!application,
		editable: job.created_manually && !!importer
	};
}
