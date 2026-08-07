/**
 * An index of everything recorded across ALL of the applicant's applications.
 *
 * ## Why an index and not the contents
 *
 * The contents do not fit. Measured on a real profile with four active
 * applications: 315751 chars of activity, ~79k tokens, against a 131k-token
 * fallback model — and it grows with every application. The index of the same
 * material is 2209 chars, less than the pipeline summaries already cost.
 *
 * ## Why it exists at all
 *
 * Because "the route did not request this source" and "there is nothing there"
 * were indistinguishable to the model, and both come out of its mouth as a
 * confident *no*. That has now bitten twice: the pipeline was absent from the
 * applications list, so "compare these two" had nothing to answer from; and
 * activity arrived at 5% of its size on the application page, so a question
 * about the middle of an interview got "I cannot see that part". The second one
 * at least said so. The first did not.
 *
 * So this block is unconditional wherever there is a profile, and it is cheap
 * enough to be. It does not answer questions — it makes the model able to say
 * *which* questions it cannot answer from here, and where the answer lives.
 * That turns a silent blind spot into "open that application and I can".
 */

import { db } from '$lib/server/db';
import { asc, eq } from 'drizzle-orm';
import { application_records, applications, jobs } from '$lib/server/db/schema';
import { getRecordTypeLabel } from '$lib/application-records';

/**
 * A ceiling, because this is an index of an unbounded thing. At ~85 chars a
 * line it takes ~70 entries to reach, well beyond the 26 a real profile has —
 * but "it is small today" is exactly what was said about every other block
 * here, so it trims rather than grows.
 */
export const MANIFEST_BUDGET_CHARS = 6000;

/** The shape the formatter needs — kept narrow so tests need no DB row. */
export interface ManifestEntry {
	id: number;
	record_type: string | null;
	title: string | null;
	event_date: string | null;
	chars: number;
}

export interface ManifestApplication {
	id: number;
	company: string | null;
	position: string | null;
	status: string | null;
	/** True for the application the current page is about, if any. */
	isCurrent: boolean;
	entries: ManifestEntry[];
}

/**
 * Named exactly as the pipeline block names it — "title at company (application
 * N)" — because both blocks describe the same applications and the model has to
 * be able to tell that. Two spellings of one application reads as two.
 */
function heading(app: ManifestApplication): string {
	const name = [app.position, app.company].filter(Boolean).join(' at ') || 'Untitled application';
	return `### ${name} (application ${app.id})${
		app.isCurrent ? ' — the one on screen, shown in full above' : ''
	}`;
}

function line(entry: ManifestEntry): string {
	return `- #${entry.id} ${getRecordTypeLabel(entry.record_type)}: "${
		entry.title?.trim() || 'Untitled'
	}"${entry.event_date ? ` · ${entry.event_date}` : ''} · ${entry.chars} chars`;
}

/**
 * Render the index. Pure — no DB access — so the trimming is directly testable.
 *
 * Trims by dropping the oldest entries of the largest applications first, never
 * whole applications: an application missing from the index reads as one that
 * does not exist, which is the exact failure this block was built to remove. A
 * truncated list still says the application is there.
 */
export function formatActivityManifest(
	apps: ManifestApplication[],
	budgetChars = MANIFEST_BUDGET_CHARS
): string {
	if (apps.length === 0) return '';

	const working = apps.map((a) => ({ ...a, entries: [...a.entries] }));
	const body = () =>
		working
			.map((a) =>
				[
					heading(a),
					...(a.entries.length === 0 ? ['- nothing recorded yet'] : a.entries.map(line))
				].join('\n')
			)
			.join('\n\n');

	let trimmed = 0;
	// Oldest-first within the currently-largest application, so what survives is
	// the recent activity on every application rather than all of one and none
	// of another.
	while (body().length > budgetChars) {
		const fattest = working
			.filter((a) => a.entries.length > 1)
			.sort((a, z) => z.entries.length - a.entries.length)[0];
		if (!fattest) break;
		fattest.entries.shift();
		trimmed++;
	}

	return [
		// NOTE ON WRAPPING: joined with "\n", so a phrase split across two entries
		// never appears contiguously in the output. The breaks are chosen so each
		// load-bearing phrase stays whole and can be asserted on — same convention
		// as the guidance block in application-activity.ts.
		'## Everything on record, across all their applications',
		'',
		'An index, not the contents: it says what exists, so you can tell the',
		'difference between something you cannot see and something that is not',
		'there. Every entry listed here is real. If one of them holds the answer',
		'and its text is not in this prompt, say so, and',
		"offer to go through it on that application's own page —",
		'rather than answering as though there were nothing to find.',
		...(trimmed > 0
			? [
					'',
					`NOTE: ${trimmed} older entry(s) are missing from this index to fit.`,
					'Every application is listed; the oldest entries of the busiest ones',
					'are not.'
				]
			: []),
		'',
		body()
	].join('\n');
}

/**
 * Load the index for a profile — every application, with every entry on it as a
 * header line. Ordered oldest-application-first, and oldest-entry-first within
 * each, which is the order the formatter's trimming assumes.
 *
 * THROWS on a real failure, deliberately. Swallowing is a prompt-assembly
 * policy, and it lives one level up in `activityManifestText`; a caller reading
 * this as data needs "the query failed" and "nothing is recorded" to be
 * different answers — which is the exact distinction this whole block exists to
 * preserve for the model.
 */
export async function loadActivityManifest(
	profileId: number,
	currentApplicationId?: number
): Promise<ManifestApplication[]> {
	const rows = await db
		.select({
			appId: applications.id,
			status: applications.status,
			company: jobs.company,
			position: jobs.title,
			recordId: application_records.id,
			recordType: application_records.record_type,
			title: application_records.title,
			eventDate: application_records.event_date,
			chars: application_records.content
		})
		.from(applications)
		.leftJoin(jobs, eq(jobs.id, applications.job_id))
		.leftJoin(application_records, eq(application_records.application_id, applications.id))
		.where(eq(applications.profile_id, profileId))
		.orderBy(asc(applications.id), asc(application_records.event_date));

	const byApp = new Map<number, ManifestApplication>();
	for (const r of rows) {
		let app = byApp.get(r.appId);
		if (!app) {
			app = {
				id: r.appId,
				company: r.company,
				position: r.position,
				status: r.status,
				isCurrent: r.appId === currentApplicationId,
				entries: []
			};
			byApp.set(r.appId, app);
		}
		// An entry with no text yet (a file still extracting) is still worth
		// listing: it exists, and saying so beats implying it does not.
		if (r.recordId != null) {
			app.entries.push({
				id: r.recordId,
				record_type: r.recordType,
				title: r.title,
				event_date: r.eventDate,
				chars: (r.chars ?? '').length
			});
		}
	}

	return [...byApp.values()];
}

/**
 * Load and render the index for a profile. Returns "" when the applicant has no
 * applications at all — callers interpolate it blindly.
 */
export async function activityManifestText(
	profileId: number,
	currentApplicationId?: number
): Promise<string> {
	try {
		return formatActivityManifest(await loadActivityManifest(profileId, currentApplicationId));
	} catch {
		// Context is a bonus, never a reason to fail the generation.
		return '';
	}
}
