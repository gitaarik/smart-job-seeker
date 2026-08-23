/**
 * Creating an application, and the manual job it hangs off.
 *
 * Extracted from `/applications/new`'s form action when `add_application`
 * reached MCP, for the reason `status.ts` was extracted before it: two callers
 * writing the same rows by hand is two chances to write them differently, and
 * the ways they can differ here are all invisible. The route inserted a
 * `job_importers` row and enqueued matching; a second copy that forgot either
 * would produce an application whose job never appears in /jobs and never
 * scores — with nothing failing, and the gap only visible weeks later as a job
 * that "didn't match anything".
 *
 * ## Why a job row at all, when `applications.job_id` is nullable
 *
 * It is nullable, and the one-click blank application relies on that. But the
 * title and the company live on `jobs`, not on `applications`, so an
 * application with no job is one that cannot say what it is *for*: it renders
 * as a blank line in every list. That is a fine state to pass through on the
 * way to filling it in on a page, and a poor one to create from an agent that
 * was told the company's name and had somewhere to put it.
 *
 * So: a caller that knows anything about the role gets a job, and a caller that
 * knows nothing gets the blank application the form has always made.
 */

import { db } from '$lib/server/db';
import { applications, application_status_log, job_importers, jobs } from '$lib/server/db/schema';
import {
	parseJobDescription,
	type ParsedJobDescription
} from '$lib/server/jobs/parse-job-description';
import { datePostedOrNull, detectPlatformId } from '$lib/server/jobs/job-fields';
import { triggerMatchForImport } from '$lib/server/job/match-trigger';
import { classifyRegion } from '$lib/data/job-taxonomy';
import {
	normalizeExperienceLevels,
	normalizeJobType,
	normalizeWorkLocation
} from '$lib/data/job-normalize';
import { normalizeSalaryPeriod } from '$lib/salary/conversion';

/**
 * What a caller can say about the role, in the shape the form's fields already
 * had. Every field is optional: this is what the caller happened to know, not a
 * record being validated.
 */
export interface NewApplicationJob {
	title?: string | null;
	company?: string | null;
	job_poster?: string | null;
	office_location?: string | null;
	source_url?: string | null;
	job_description?: string | null;
	salary_min?: number | null;
	salary_max?: number | null;
	salary_currency?: string | null;
	salary_period?: string | null;
	work_location?: string[] | null;
	job_types?: string[] | null;
	experience_levels?: string[] | null;
	date_posted?: string | null;
}

export interface NewApplicationInput {
	profileId: number;
	/** Null, or every field empty, makes the blank application. */
	job?: NewApplicationJob | null;
	/**
	 * A parse the caller already ran, to fill the blanks in `job`.
	 *
	 * Passed in rather than done here so the LLM call stays visible at the call
	 * site: the form parses up front so the user can review the extracted fields
	 * and hands back what it got, and hiding a second one inside a function
	 * called `createApplication` would make the cost of creating an application
	 * depend on which caller you were.
	 */
	parsed?: ParsedJobDescription | null;
	/**
	 * Whether the caller's own fields were shown against `parsed` before they
	 * were sent.
	 *
	 * This is the difference between "they left it blank" and "they cleared it".
	 * Only the form's review step can answer it, and only it passes true —
	 * without a reviewed parse the gap-fill semantics hold: what the caller sent
	 * wins, the parser fills what is missing.
	 */
	reviewed?: boolean;
}

export interface CreatedApplication {
	applicationId: number;
	/** Null when the caller knew nothing about the role. */
	jobId: number | null;
}

/**
 * Did the caller say anything at all about the role?
 *
 * An explicit list rather than "any field is set", because two of the fields
 * cannot describe anything on their own: a form posts `salary_currency` from a
 * select that always has a value, so a blank submission carries "EUR" and would
 * read as a job under a rule that counted every field. The one-click blank
 * application is the behaviour that would have broken, silently, by acquiring
 * an untitled job.
 */
function describesAJob(job: NewApplicationJob): boolean {
	const describing = [
		job.title,
		job.company,
		job.job_poster,
		job.office_location,
		job.source_url,
		job.job_description,
		job.salary_min,
		job.salary_max,
		job.work_location,
		job.job_types,
		job.experience_levels,
		job.date_posted
	];
	return describing.some((value) =>
		Array.isArray(value) ? value.length > 0 : value !== null && value !== undefined && value !== ''
	);
}

/**
 * Parse a pasted description without letting a parse failure block creation.
 *
 * Best-effort by construction: on any failure — provider error, no credits — the
 * caller stores what it was given and nothing else. Shared so both callers fail
 * the same way, which is the half of this that is easy to get wrong twice.
 */
export async function parseForNewApplication(
	description: string,
	opts: { profileId: number; sourceUrl?: string | null }
): Promise<ParsedJobDescription | null> {
	try {
		return await parseJobDescription(description, opts);
	} catch {
		return null;
	}
}

/**
 * The manual job: the row, its importer link, and its place in the match queue.
 *
 * All three or none. The importer row is what puts the job in this profile's
 * /jobs list — `jobs` has no owner column, so without it the row exists and
 * belongs to nobody — and the match trigger is what scores it, no-opping when
 * the parse produced no skills.
 */
async function createManualJob(
	profileId: number,
	job: NewApplicationJob,
	parsed: ParsedJobDescription | null,
	reviewed: boolean,
	now: Date
): Promise<number> {
	const pick = <T>(sent: T | null | undefined, parsedValue: T | null): T | null =>
		reviewed ? (sent ?? null) : (sent ?? parsedValue);

	// A bare "Remote"/"Hybrid" typed in the location box is a work arrangement,
	// not a city: fold it into work_location rather than lose it, and leave
	// office_location for real physical locations — mirroring upsertJob's split.
	// Outside the review step the parser's dedicated `remote` field takes
	// precedence over that inference.
	const rawLocation = pick(job.office_location, parsed?.location ?? null);
	const typedArrangement = normalizeWorkLocation(rawLocation);
	const effectiveLocation = typedArrangement ? null : rawLocation;

	// Canonicalize taxonomy values even in the review path — the form posts
	// canonical values, but a hand-rolled POST and an MCP call need not.
	const workLocation = reviewed
		? normalizeWorkLocation(job.work_location?.join(',') ?? rawLocation)
		: normalizeWorkLocation(parsed?.remote ?? job.office_location ?? null);
	const jobTypes = reviewed
		? normalizeJobType(job.job_types?.join(',') ?? null)
		: normalizeJobType(parsed?.job_type ?? null);
	const experienceLevels = reviewed
		? normalizeExperienceLevels(job.experience_levels ?? null)
		: normalizeExperienceLevels(parsed?.experience_levels ?? null);

	const effectiveSalaryPeriod = pick(job.salary_period, parsed?.salary_period ?? null);
	const parsedDatePosted = parsed?.date_posted
		? parsed.date_posted.toISOString().split('T')[0]
		: null;
	const datePosted = datePostedOrNull(job.date_posted ?? null);

	// Detect the platform from whichever URL we settled on — the parser can
	// recover a job URL from the posting text when the field was left empty, so
	// this has to run after the merge.
	const effectiveSourceUrl = pick(job.source_url, parsed?.source_url ?? null);
	const platformId = await detectPlatformId(effectiveSourceUrl);

	const [created] = await db
		.insert(jobs)
		.values({
			title: pick(job.title, parsed?.title ?? null),
			company: pick(job.company, parsed?.company ?? null),
			company_description: parsed?.company_description ?? null,
			job_poster: pick(job.job_poster, parsed?.job_poster ?? null),
			office_location: effectiveLocation,
			region: classifyRegion(effectiveLocation),
			source_url: effectiveSourceUrl,
			// Keep the original paste verbatim as the description.
			job_description: job.job_description ?? null,
			salary_min: pick(job.salary_min, parsed?.salary_min ?? null),
			salary_max: pick(job.salary_max, parsed?.salary_max ?? null),
			salary_currency: pick(job.salary_currency, parsed?.salary_currency ?? null),
			salary_period: normalizeSalaryPeriod(effectiveSalaryPeriod) || effectiveSalaryPeriod,
			salary_duration_weeks: parsed?.salary_duration_weeks ?? null,
			work_location: workLocation,
			job_types: jobTypes,
			experience_levels: experienceLevels,
			skills_required: parsed?.skills_required ?? null,
			skills_preferred: parsed?.skills_preferred ?? null,
			responsibilities: parsed?.responsibilities ?? null,
			soft_skills: parsed?.soft_skills ?? null,
			date_posted: pick(datePosted, parsedDatePosted),
			source_html_stripped: parsed?.source_html_stripped ?? null,
			ai_chat_extraction: parsed?.ai_chat_extraction ?? null,
			job_platform_id: platformId,
			created_manually: true,
			status: parsed?.status ?? 'hiring',
			date_created: now,
			date_updated: now
		})
		.returning({ id: jobs.id });

	await db.insert(job_importers).values({ job_id: created.id, profile_id: profileId });
	await triggerMatchForImport(profileId, created.id);

	return created.id;
}

/**
 * Create an application, with the manual job behind it where there is one.
 *
 * The status it starts in is not a parameter. Every application begins at the
 * top of the pipeline — applying / Preparing / Send application — because that
 * is what "I am going to apply for this" means, and the status log's first row
 * has to agree with the column for the history to read correctly. A caller that
 * knows the application is further along says so afterwards, through
 * `writeApplicationStatus`, which is the one writer that keeps the log and the
 * columns in step.
 */
export async function createApplication(input: NewApplicationInput): Promise<CreatedApplication> {
	const { profileId, job = null, parsed = null, reviewed = false } = input;
	const now = new Date();

	const jobId =
		job && describesAJob(job) ? await createManualJob(profileId, job, parsed, reviewed, now) : null;

	const [application] = await db
		.insert(applications)
		.values({
			job_id: jobId,
			profile_id: profileId,
			status: 'applying',
			status_step: 'Preparing',
			status_action: 'Send application',
			date_created: now,
			date_updated: now,
			// application_seen_date is a Drizzle date() column (string mode).
			application_seen_date: now.toISOString().split('T')[0]
		})
		.returning({ id: applications.id });

	await db.insert(application_status_log).values({
		application: application.id,
		date_created: now,
		from_status: null,
		to_status: 'applying',
		step: 'Preparing',
		action: 'Send application'
	});

	return { applicationId: application.id, jobId };
}
