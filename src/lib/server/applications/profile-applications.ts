/**
 * A profile's applications, read for an agent.
 *
 * The counterpart to `jobs/profile-jobs.ts`, and much the shorter one: an
 * application carries `profile_id`, so ownership is a column rather than a
 * question. `where profile_id = ?` is the whole of the scope, and the only
 * reason this module exists is that the MCP layer should not be assembling
 * queries of its own.
 *
 * What it returns is what NAMES an application — the job behind it and where it
 * stands. What it holds is a different question, answered by the capabilities'
 * own `current()`. Everything else about an application — its letters, its
 * documents, its match score — is reachable in the app and is not part of what
 * an external agent was given a key for.
 */

import { db } from '$lib/server/db';
import { and, desc, eq } from 'drizzle-orm';
import { applications } from '$lib/server/db/schema';

export const APPLICATION_PAGE_DEFAULT = 20;
export const APPLICATION_PAGE_MAX = 50;

export interface ProfileApplicationSummary {
	id: number;
	job_id: number | null;
	/** The job behind it, for whoever is naming this application to a person. */
	job_title: string | null;
	job_company: string | null;
	status: string;
	status_step: string | null;
	application_sent_date: string | null;
}

/**
 * The same shape as a list row, and for the same reason `ProfileJobDetail` is.
 *
 * The fields an agent can WRITE, and the chronology it must not repeat, are
 * both already declared — by `edit_application_details.current` and
 * `add_activity_record.current`. Reading them from there is what keeps the read
 * tool and the write tool describing one application rather than two.
 */
export type ProfileApplicationDetail = ProfileApplicationSummary;

export async function listProfileApplications(
	profileId: number,
	opts: { limit?: number; status?: string } = {}
): Promise<ProfileApplicationSummary[]> {
	const limit = Math.min(Math.max(opts.limit ?? APPLICATION_PAGE_DEFAULT, 1), APPLICATION_PAGE_MAX);

	const rows = await db.query.applications.findMany({
		where: opts.status
			? and(eq(applications.profile_id, profileId), eq(applications.status, opts.status))
			: eq(applications.profile_id, profileId),
		columns: {
			id: true,
			job_id: true,
			status: true,
			status_step: true,
			application_sent_date: true
		},
		with: { job: { columns: { title: true, company: true } } },
		orderBy: [desc(applications.date_created), desc(applications.id)],
		limit
	});

	return rows.map((row) => ({
		id: row.id,
		job_id: row.job_id,
		job_title: row.job?.title ?? null,
		job_company: row.job?.company ?? null,
		status: row.status,
		status_step: row.status_step,
		application_sent_date: row.application_sent_date
	}));
}

/** One application, or null when it is not this profile's. */
export async function readProfileApplication(
	applicationId: number,
	profileId: number
): Promise<ProfileApplicationDetail | null> {
	const row = await db.query.applications.findFirst({
		where: and(eq(applications.id, applicationId), eq(applications.profile_id, profileId)),
		columns: {
			id: true,
			job_id: true,
			status: true,
			status_step: true,
			application_sent_date: true
		},
		with: { job: { columns: { title: true, company: true } } }
	});
	if (!row) return null;

	return {
		id: row.id,
		job_id: row.job_id,
		job_title: row.job?.title ?? null,
		job_company: row.job?.company ?? null,
		status: row.status,
		status_step: row.status_step,
		application_sent_date: row.application_sent_date
	};
}
