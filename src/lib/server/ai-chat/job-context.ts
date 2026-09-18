/**
 * The job a generation is about, rendered as prompt context.
 *
 * This lived as a private `formatJobDetails` copy-pasted into
 * application-letter-followup.ts and application-question-followup.ts, which is
 * how the *initial* application-question path ended up interpolating a bare
 * `job_description` while its own follow-up turn got title, company and company
 * description too. One copy, one shape, every caller.
 *
 * Split load / format / compose — see the seam described on `SourceDef` in
 * generation-context.ts.
 */

import { db } from '$lib/server/db';
import { eq } from 'drizzle-orm';
import { applications, jobs } from '$lib/server/db/schema';
import {
	COMPACT_COLUMNS,
	promptJobDescription,
	type CompactableJob
} from '$lib/server/jobs/compact-description';

export interface JobDetailsRow {
	/**
	 * Carried even though no prompt block prints it: a caller that asked by
	 * `applicationId` has no other way to learn *which* job it got back, and the
	 * whole point of the data half is being usable without the prose.
	 */
	id: number;
	title: string | null;
	job_description: string | null;
	company_description: string | null;
	job_poster: string | null;
	/** Fallback when the scraper didn't capture a poster. */
	company?: string | null;
	/** The shortened description and its cache keys — see compact-description.ts. */
	description_compact?: string | null;
	description_compact_hash?: string | null;
	description_compact_status?: string | null;
}

/**
 * Format job data as readable text for prompts.
 *
 * `description` overrides `job.job_description` — that is how the shortened
 * posting gets in without this function growing a side effect. When it IS the
 * shortened one, the block says so: a model asked what the posting requires is
 * entitled to know it is not holding all of it, and the alternative is exactly
 * the silent substitution this codebase keeps being bitten by.
 */
export function formatJobDetails(
	job: JobDetailsRow,
	description?: { text: string | null; compacted: boolean }
): string {
	const lines: string[] = [`**Position:** ${job.title || 'Not specified'}`];

	// Both, when the posting names both, and in that order — they are different
	// facts and picking one loses the other. This used to render the poster
	// alone, so a job at Alliander advertised by a staffing firm reached the
	// model as "Company/Organization: Citrus-IT (this is who the applicant is
	// applying to)", naming the intermediary as the employer. The pipeline block
	// preferred the opposite field, so the same job had two names depending on
	// which block you read.
	if (job.company && job.job_poster && job.company !== job.job_poster) {
		lines.push(
			`**Company/Organization:** ${job.company} (this is who the applicant would work for)`
		);
		lines.push(`**Posted by:** ${job.job_poster} (agency or recruiter presenting the role)`);
	} else {
		const employer = job.company || job.job_poster;
		if (employer) {
			lines.push(
				`**Company/Organization:** ${employer} (this is who the applicant is applying to)`
			);
		}
	}
	if (job.company_description) {
		lines.push(`**About the company:** ${job.company_description}`);
	}
	const body = description ? description.text : job.job_description;
	const heading = description?.compacted
		? '**Job Description:** (shortened to fit alongside the rest of this context: ' +
			"boilerplate removed, requirements and the employer's own wording kept. " +
			'The full posting is on the job page.)'
		: '**Job Description:**';
	lines.push('', heading, body || 'Not specified');

	return lines.join('\n');
}

const JOB_COLUMNS = {
	...COMPACT_COLUMNS,
	title: true,
	company_description: true,
	job_poster: true,
	company: true
} as const;

/**
 * Load the job behind an application (or a job directly). Null when there is no
 * job attached — a hand-created application has none.
 *
 * THROWS on a real failure, deliberately. Swallowing is a prompt-assembly
 * policy, and it lives one level up in `jobDetailsText`; a caller reading this
 * as data needs "the query failed" and "there is no job" to be different
 * answers.
 */
export async function loadJobDetails(
	ref: { applicationId: number } | { jobId: number }
): Promise<JobDetailsRow | null> {
	if ('jobId' in ref) {
		const job = await db.query.jobs.findFirst({
			where: eq(jobs.id, ref.jobId),
			columns: JOB_COLUMNS
		});
		return job ?? null;
	}

	const application = await db.query.applications.findFirst({
		where: eq(applications.id, ref.applicationId),
		columns: { id: true },
		with: { job: { columns: JOB_COLUMNS } }
	});
	return application?.job ?? null;
}

/**
 * Load and render. Returns "" when there is no job attached — callers
 * interpolate it blindly.
 *
 * `profileId` opts this call into shortening a long posting (see
 * compact-description.ts), and is the profile the generation it pays for belongs
 * to. Omit it and the full description is rendered, which is what a caller
 * reading the job as data wants.
 */
export async function jobDetailsText(
	ref: { applicationId: number } | { jobId: number },
	opts?: { profileId?: number }
): Promise<string> {
	try {
		const job = await loadJobDetails(ref);
		if (!job) return '';
		const description = opts?.profileId
			? await promptJobDescription(job as CompactableJob, opts.profileId)
			: undefined;
		return formatJobDetails(job, description);
	} catch {
		// Context is a bonus, never a reason to fail the generation.
		return '';
	}
}
