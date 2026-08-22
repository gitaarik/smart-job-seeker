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
import { application_records, applications } from '$lib/server/db/schema';
import { getRecordTypeLabel } from '$lib/application-records';
import { isSnoozed } from '$lib/application-snooze';

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
	/**
	 * The day a paused application comes back, or null.
	 *
	 * Part of what NAMES an application's state for the same reason the status
	 * is: an agent asked which applications need chasing would otherwise call a
	 * deliberately parked one neglected. Only ever set while the pause is still
	 * ahead — see `$lib/application-snooze`.
	 */
	snoozed_until: string | null;
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
			application_sent_date: true,
			snoozed_until: true
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
		application_sent_date: row.application_sent_date,
		snoozed_until: isSnoozed(row) ? row.snoozed_until : null
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
			application_sent_date: true,
			snoozed_until: true
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
		application_sent_date: row.application_sent_date,
		snoozed_until: isSnoozed(row) ? row.snoozed_until : null
	};
}

/**
 * How much of one entry a read returns before asking for an offset.
 *
 * The chat's activity source uses the same 60,000 for one entry, and for the
 * same reason: it is a backstop against a 2MB attachment, not a budget. A real
 * interview transcript measured 57,616 — under it, and close enough that the
 * offset is not decoration.
 */
export const ENTRY_READ_CHARS = 60000;

export interface ApplicationEntryText {
	entry_id: number;
	type: string;
	title: string;
	date: string | null;
	/** Where the text came from: a typed note, or a file that was extracted. */
	from_file: boolean;
	text: string;
	offset: number;
	returned_chars: number;
	more: boolean;
}

/**
 * One activity entry in full, or null when it is not this profile's.
 *
 * This is where an application's DOCUMENTS live as well as its notes: an upload
 * on the Activity tab becomes a record with `file_id` set and its text
 * extracted into `content`. One store, so one reader — the split into "records"
 * and "documents" was undone before this was written, and re-introducing it
 * here would be inventing a distinction the data no longer makes.
 */
export async function readApplicationEntry(
	entryId: number,
	profileId: number,
	opts: { offset?: number } = {}
): Promise<ApplicationEntryText | null> {
	// Joined through the application, so the profile scope is the same query that
	// finds the row rather than a check a later edit could forget.
	const [row] = await db
		.select({
			id: application_records.id,
			record_type: application_records.record_type,
			title: application_records.title,
			event_date: application_records.event_date,
			file_id: application_records.file_id,
			content: application_records.content
		})
		.from(application_records)
		.innerJoin(applications, eq(applications.id, application_records.application_id))
		.where(and(eq(application_records.id, entryId), eq(applications.profile_id, profileId)))
		.limit(1);

	if (!row) return null;

	const whole = row.content ?? '';
	const offset = Math.max(opts.offset ?? 0, 0);
	const text = whole.slice(offset, offset + ENTRY_READ_CHARS);

	return {
		entry_id: row.id,
		type: getRecordTypeLabel(row.record_type),
		title: row.title,
		date: row.event_date,
		from_file: row.file_id !== null,
		text,
		offset,
		returned_chars: text.length,
		more: offset + text.length < whole.length
	};
}
