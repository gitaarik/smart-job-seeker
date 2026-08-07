/**
 * The one write path for hand-edited job fields, and the permission gate in
 * front of it.
 *
 * Two callers reach this: the header-card form on /jobs/[id], and the
 * assistant's `edit_job_details` capability. They arrive with different shapes
 * (FormData vs a JSON proposal) but must land identical rows — the taxonomy
 * canonicalization, the "Remote typed into the location box" fold and the
 * project-duration invariant are not things a second implementation would
 * reproduce by accident.
 */

import { dbDirect as db } from '$lib/server/db';
import { and, eq } from 'drizzle-orm';
import { job_importers, job_matches, jobs as jobsTable } from '$lib/server/db/schema';
import { classifyRegion } from '$lib/data/job-taxonomy';
import {
	normalizeExperienceLevels,
	normalizeJobType,
	normalizeWorkLocation
} from '$lib/data/job-normalize';
import { normalizeSalaryPeriod } from '$lib/salary/conversion';
import { datePostedOrNull, detectPlatformId } from './job-fields';

/** Matches the `jobs.title` varchar width — a longer value errors at the DB. */
export const TITLE_MAX_LENGTH = 255;

/**
 * The hand-editable job fields, already coerced out of whatever the caller
 * received. Every field is present and authoritative: null means "clear this
 * column", which is the only reading under which removing a wrong salary works.
 */
export interface JobFieldValues {
	title: string;
	company: string | null;
	job_poster: string | null;
	office_location: string | null;
	source_url: string | null;
	date_posted: string | null;
	salary_min: number | null;
	salary_max: number | null;
	salary_currency: string | null;
	salary_period: string | null;
	work_location: string[] | null;
	job_types: string[] | null;
	experience_levels: string[] | null;
}

/**
 * Whether `profileId` may hand-edit this job's content.
 *
 * Jobs are shared across profiles, so editing is limited to manually-created
 * ones — a scraped job's content is a page capture that the next rescrape would
 * overwrite anyway. Within those, only the profile that created the job (its
 * importer) or staff can edit.
 *
 * Note this is deliberately stricter than the *read* path: `resolveEntity` in
 * chat-context.ts resolves any job to any signed-in user, because /jobs/[id]
 * renders any job to any signed-in user. Nothing may infer edit rights from an
 * entity having resolved.
 */
export async function canEditJobContent(
	jobId: number,
	profileId: number,
	createdManually: boolean,
	isStaff: boolean
): Promise<boolean> {
	if (!createdManually) return false;
	if (isStaff) return true;

	const importer = await db.query.job_importers.findFirst({
		where: and(eq(job_importers.job_id, jobId), eq(job_importers.profile_id, profileId)),
		columns: { job_id: true }
	});
	return !!importer;
}

/** Convenience wrapper that reads `created_manually` itself. Returns false for a missing job. */
export async function canEditJob(
	jobId: number,
	profileId: number,
	isStaff: boolean
): Promise<boolean> {
	const job = await db.query.jobs.findFirst({
		where: eq(jobsTable.id, jobId),
		columns: { created_manually: true }
	});
	if (!job) return false;
	return canEditJobContent(jobId, profileId, job.created_manually, isStaff);
}

/** Shared validation, so both callers reject the same inputs with the same words. */
export function validateJobFields(
	fields: JobFieldValues
): { ok: true } | { ok: false; error: string } {
	// The one required field: the job's identity, and what every listing and
	// application row renders. Everything else is legitimately unknown.
	if (!fields.title.trim()) {
		return { ok: false, error: 'Title cannot be empty' };
	}
	if (fields.title.length > TITLE_MAX_LENGTH) {
		return {
			ok: false,
			error: `Title cannot be longer than ${TITLE_MAX_LENGTH} characters`
		};
	}
	return { ok: true };
}

/**
 * Write the hand-editable fields, canonicalizing on the way in.
 *
 * Assumes the caller has already authorized and validated — this is the write,
 * not the gate.
 */
export async function applyJobFields(jobId: number, fields: JobFieldValues): Promise<void> {
	// Read back the one column the callers don't carry: a project duration is
	// parser output that neither the form nor a proposal exposes.
	const existing = await db.query.jobs.findFirst({
		where: eq(jobsTable.id, jobId),
		columns: { salary_duration_weeks: true }
	});

	// A bare "Remote"/"Hybrid" in the location box is a work arrangement, not a
	// city: fold it into work_location rather than lose it, and leave
	// office_location for real physical locations — mirroring upsertJob and the
	// create form.
	const rawLocation = fields.office_location;
	const effectiveLocation = normalizeWorkLocation(rawLocation) ? null : rawLocation;

	const salaryPeriod = fields.salary_period
		? normalizeSalaryPeriod(fields.salary_period) || fields.salary_period
		: null;

	await db
		.update(jobsTable)
		.set({
			title: fields.title.trim(),
			company: fields.company,
			job_poster: fields.job_poster,
			office_location: effectiveLocation,
			region: classifyRegion(effectiveLocation),
			source_url: fields.source_url,
			job_platform_id: await detectPlatformId(fields.source_url),
			date_posted: datePostedOrNull(fields.date_posted),
			salary_min: fields.salary_min,
			salary_max: fields.salary_max,
			salary_currency: fields.salary_currency,
			salary_period: salaryPeriod,
			// Only a fixed-price engagement has a duration. Neither caller exposes it
			// — it's parser output — but leaving a stale one behind would render
			// "$50/hour (6 weeks)", so it goes when the period stops being one.
			salary_duration_weeks:
				normalizeSalaryPeriod(salaryPeriod) === 'project'
					? (existing?.salary_duration_weeks ?? null)
					: null,
			// The form's checkboxes and the capability's schema both post canonical
			// values already, but a hand-rolled POST need not, so everything goes
			// through a normalizer regardless.
			work_location: normalizeWorkLocation(fields.work_location?.join(',') ?? rawLocation),
			job_types: normalizeJobType(fields.job_types?.join(',') ?? null),
			experience_levels: normalizeExperienceLevels(fields.experience_levels),
			date_updated: new Date()
		})
		.where(eq(jobsTable.id, jobId));
}

/**
 * Save the job's hand-edited long-form text: the posting itself, the "About the
 * company" blurb, or both.
 *
 * Only `job_description` is mirrored into `source_html_stripped`, which
 * re-parse reads in preference to `job_description` — without that mirror a
 * later re-parse would re-read the stale capture and silently ignore the edit.
 * `company_description` is parser *output*, not parse input, so mirroring it
 * would feed a company blurb back in as if it were the posting.
 *
 * An omitted field is left alone; passing null clears it.
 */
export async function applyJobTexts(
	jobId: number,
	texts: {
		job_description?: string | null;
		company_description?: string | null;
	}
): Promise<void> {
	const patch: Record<string, unknown> = { date_updated: new Date() };

	if (texts.job_description !== undefined) {
		const text = texts.job_description?.trim() || null;
		patch.job_description = text;
		patch.source_html_stripped = text;
	}
	if (texts.company_description !== undefined) {
		patch.company_description = texts.company_description?.trim() || null;
	}

	await db.update(jobsTable).set(patch).where(eq(jobsTable.id, jobId));
}

/**
 * Save a job's two extracted skill lists.
 *
 * Each list is written whole — there is no per-skill write, because there is no
 * per-skill anything: the columns are JSON arrays. An omitted list is left
 * alone, so changing the required skills never touches the preferred ones;
 * passing null clears one.
 *
 * Flagging the job's matches for re-scoring is part of the write rather than
 * something callers remember, because these two columns *are* the score's
 * inputs (see `matcher.ts` — they're the only job-side skill fields it reads).
 * A hand-edited skill list with a stale score attached is worse than either
 * alone: the number on the page is now evidence for a job description that no
 * longer says that.
 *
 * Flag rather than delete, and flag rather than re-score inline: the old score
 * stays visible until the new one lands, and the background matcher picks the
 * job up on its next cycle. Every other caller that invalidates a score does it
 * this way, and none of them have an acting profile to score inline for —
 * neither does this one, since jobs are shared across profiles.
 */
export async function applyJobSkills(
	jobId: number,
	skills: {
		skills_required?: string[] | null;
		skills_preferred?: string[] | null;
	}
): Promise<void> {
	const patch: Record<string, unknown> = {};

	if (skills.skills_required !== undefined) {
		patch.skills_required = skills.skills_required;
	}
	if (skills.skills_preferred !== undefined) {
		patch.skills_preferred = skills.skills_preferred;
	}

	// Nothing to write is not the same as "write nothing": without this, a call
	// with no lists would still bump date_updated and invalidate every match row
	// for the job, which is a rescore of the whole fleet for a no-op.
	if (Object.keys(patch).length === 0) return;

	await db
		.update(jobsTable)
		.set({ ...patch, date_updated: new Date() })
		.where(eq(jobsTable.id, jobId));

	await db
		.update(job_matches)
		.set({ rescore_requested_at: new Date() })
		.where(eq(job_matches.job_id, jobId));
}

/** Back-compat shim for the description-only callers. */
export async function applyJobDescription(jobId: number, description: string): Promise<void> {
	await applyJobTexts(jobId, { job_description: description });
}
