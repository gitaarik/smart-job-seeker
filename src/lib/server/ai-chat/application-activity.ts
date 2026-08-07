/**
 * Everything that has happened on an application, rendered as prompt context.
 *
 * This is the merge of what were `application-records.ts` (typed text) and
 * `application-documents.ts` (uploaded files). They were separate because the
 * schema was: records held prose, `applications_files` held blobs. That split
 * only ever sorted artefacts by whether their source had a download button — an
 * email exports cleanly and became a document, the same conversation on
 * LinkedIn had to be pasted and became a record — so the model saw one
 * application's history through two differently-worded windows with two
 * independent budgets. One stream, one budget, one guidance block.
 *
 * See planning/APPLICATION-ACTIVITY.md.
 *
 * ## Why caps rather than retrieval
 *
 * Writing prompts run on the writing provider (Gemini 2.5 Pro, 1M context)
 * falling back to gpt-oss-120b (131k), and ONE application holds a couple of
 * dozen entries at most, so the whole set fits and can be handed over verbatim.
 *
 * Retrieval would also be actively worse here: the value of this stream is
 * sequential ("round 2 pushed on caching"), and top-k similarity returns
 * fragments out of order. Retrieval earns its keep across HUNDREDS of units —
 * which is exactly the cross-application case, and exactly why that is a
 * separate `app_record` / `app_document` unit type on the generic retrieval
 * layer rather than a change to this module.
 */

import { db } from '$lib/server/db';
import { asc, eq } from 'drizzle-orm';
import { application_records } from '$lib/server/db/schema';
import { getFile } from '$lib/server/files';
import { extractUpload } from '$lib/server/documents/extract';
import { getRecordTypeLabel } from '$lib/application-records';

/**
 * `full` is for prompts the history is *about* (cheat sheets), where it is the
 * subject. `compact` is for writing prompts (letters, application answers),
 * which need the gist rather than the transcript.
 */
export type ActivityContextMode = 'compact' | 'full';

/**
 * Per-type trim rank AND compact-mode char ceiling, from one table.
 *
 * These were two independent judgements before — `TRIM_ORDER` said what to
 * sacrifice, `BUDGETS.perRecord` said how much of it to keep — both encoding
 * "how much does this kind of thing matter". Two tables saying the same thing
 * drift apart the first time a type is added to one and not the other.
 *
 * `rank` is lowest-value-first: rank 0 is sacrificed first. A raw transcript is
 * the least efficient way to say what happened; a recap or a piece of feedback
 * is the most; an offer or a signed contract should be the last thing dropped.
 *
 * `compact` is the per-entry ceiling for writing prompts only — see
 * FULL_ENTRY_CEILING for why full mode has no per-type ceiling at all.
 *
 * ⚠️ EVERY value in `recordTypes` must appear here — `weightFor` falls back to
 * rank 0, which means "sacrifice first", so a type added to the vocabulary and
 * forgotten here quietly becomes cheaper than a raw transcript instead of
 * dearer. There is a test asserting the two stay in step.
 */
export const RECORD_WEIGHTS: Record<string, { rank: number; compact: number }> = {
	transcript: { rank: 0, compact: 1500 },
	note: { rank: 1, compact: 750 },
	research: { rank: 2, compact: 750 },
	message: { rank: 3, compact: 750 },
	assessment: { rank: 4, compact: 1500 },
	feedback: { rank: 5, compact: 1500 },
	interview_recap: { rank: 6, compact: 1500 },
	offer: { rank: 7, compact: 3000 },
	contract: { rank: 8, compact: 3000 }
};

const FALLBACK_WEIGHT = { rank: 0, compact: 750 };

function weightFor(recordType: string | null) {
	return RECORD_WEIGHTS[recordType || 'note'] ?? FALLBACK_WEIGHT;
}

/**
 * Full mode does NOT ration by type. Rationing is a scarcity behaviour, and for
 * ONE application there is no scarcity: the largest real application measured
 * holds 149k chars over 17 entries — 37k tokens, against a 1M-token writing
 * model and a 131k-token fallback. The per-type table below it existed because
 * everything shared a 40k total; at that size a 29k interview transcript
 * arrived as 1.5k of head and tail with the middle cut, and the assistant
 * correctly reported it could not see the answer the user was asking about.
 *
 * So full mode keeps ONE ceiling, and it is a backstop against pathological
 * input (a 2MB book attached to an application), not a budget. `rank` still
 * decides what goes first if the total is ever reached — the value judgement
 * lives there, which is where it belongs.
 */
const FULL_ENTRY_CEILING = 60000;

/**
 * ⚠️ `full` is sized to hold one whole application, so it is ~10x the sum of
 * everything else the chat sends. It only reaches that size when the
 * application really has that much history — blocks are rendered from what
 * exists, not padded — but a heavily-documented application now costs
 * materially more per turn than it did. Re-measure with
 * `scripts/measure-chat-budget.ts` before assuming a number here is free.
 *
 * 200000 rather than 150000 because 150000 was already binding: measured on the
 * two busiest real applications, one rendered 129303 over 5 entries and fitted,
 * the other 136556 over 17 — and at 150000 that second one lost its oldest
 * entry on day one. A cap that trims today's largest case is the mistake the
 * 32000 chat budget made; this leaves ~60000 of headroom above it.
 */
const TOTALS: Record<ActivityContextMode, { total: number; maxEntries: number }> = {
	full: { total: 200000, maxEntries: 30 },
	compact: { total: 15000, maxEntries: 10 }
};

function ceilingFor(entry: ActivityEntry, mode: ActivityContextMode): number {
	return mode === 'compact' ? weightFor(entry.record_type).compact : FULL_ENTRY_CEILING;
}

/** The shape the formatter needs — kept narrow so tests need no DB row. */
export interface ActivityEntry {
	/**
	 * The `application_records` row id. No prompt block prints it, but the
	 * activity *index* (activity-manifest.ts) lists these same rows by `#id`, and
	 * a contents shape that could not be matched back to the index would be
	 * strictly less useful as data than the index of it.
	 */
	id: number;
	record_type: string | null;
	title: string | null;
	content: string | null;
	step: string | null;
	event_date: string | null;
	/**
	 * Whether this entry's text was extracted from an attached file rather than
	 * written. Worth telling the model: extracted text is verbatim from a third
	 * party, so its phrasing is evidence, where a typed recap is the applicant's
	 * own paraphrase.
	 */
	from_file?: boolean;
}

/**
 * Truncate keeping BOTH ends. The close of an interview holds the next steps
 * and the parting feedback, which head-only truncation would discard — often
 * the single most useful line in the record.
 */
export function truncateKeepingEnds(text: string, max: number): string {
	if (text.length <= max) return text;
	const marker = '\n\n[…middle omitted…]\n\n';
	const budget = max - marker.length;
	if (budget <= 0) return text.slice(0, max);
	const head = Math.floor(budget * 0.6);
	const tail = budget - head;
	return `${text.slice(0, head).trimEnd()}${marker}${text.slice(text.length - tail).trimStart()}`;
}

/** How much of an entry survives its ceiling, or null when all of it does. */
function truncationOf(
	entry: ActivityEntry,
	mode: ActivityContextMode
): { shown: number; total: number } | null {
	const text = entry.content!.trim();
	const ceiling = ceilingFor(entry, mode);
	if (text.length <= ceiling) return null;
	return {
		shown: truncateKeepingEnds(text, ceiling).length,
		total: text.length
	};
}

function renderBlock(entry: ActivityEntry, mode: ActivityContextMode): string {
	// Say the size out loud on the entry itself. The […middle omitted…] marker
	// alone says "something is missing"; it does not say whether that is a
	// sentence or 95% of an interview, and the model reads a heavily-cut entry as
	// a short one. Stated as a count, "1478 of 29163" is unmistakable.
	const cut = truncationOf(entry, mode);
	const heading = [
		`### ${getRecordTypeLabel(entry.record_type)}: ${entry.title?.trim() || 'Untitled'}`,
		entry.step ? `Stage: ${entry.step}` : null,
		entry.event_date ? `Date: ${entry.event_date}` : null,
		entry.from_file ? 'Source: text extracted from an attached file' : null,
		cut ? `Shown: ${cut.shown} of ${cut.total} characters — the rest is missing` : null
	]
		.filter(Boolean)
		.join('\n');

	return `${heading}\n\n${truncateKeepingEnds(entry.content!.trim(), ceilingFor(entry, mode))}`;
}

/**
 * Format the stream into a prompt block, applying the per-entry ceilings and
 * the total cap. Pure — no DB access — so the budget behaviour is directly
 * testable.
 */
export function formatActivityContext(
	entries: ActivityEntry[],
	mode: ActivityContextMode = 'full'
): string {
	const budget = TOTALS[mode];
	const withContent = entries.filter((e) => e.content?.trim());
	if (withContent.length === 0) return '';

	// Entries arrive oldest-first. Drop lowest-value types first and, within a
	// type, the oldest — so what survives is the most recent and most useful.
	const kept = [...withContent];
	const dropOrder = withContent
		.map((entry, index) => ({ entry, index }))
		.sort(
			(a, b) =>
				weightFor(a.entry.record_type).rank - weightFor(b.entry.record_type).rank ||
				a.index - b.index
		);

	let dropped = 0;
	const size = () => kept.reduce((sum, e) => sum + renderBlock(e, mode).length, 0);

	for (const { entry } of dropOrder) {
		if (kept.length <= budget.maxEntries && size() <= budget.total) break;
		// Never drop the last one — a truncated entry beats no context at all.
		if (kept.length === 1) break;
		kept.splice(kept.indexOf(entry), 1);
		dropped++;
	}

	// Two audiences, two different risks. Outward-facing text (letters, answers)
	// can invent a shared history that never happened, so its guidance separates
	// *what was learned* from *the fact that it was learned* — which is a sharper
	// fabrication guard than "use them only where they help", and simultaneously
	// stops the stream being skimmed as optional colour. Cheat sheets are private
	// prep notes: referencing the history is the whole point, so there the
	// pressure is all on acting rather than nodding.
	//
	// The compact guard covers BOTH predecessors' risks, because the stream is
	// now mixed: never imply a conversation that did not happen (records), and
	// never imply the applicant has been sent, has signed or has read anything
	// (documents). Either fabrication is reachable from any entry now.
	// NOTE ON WRAPPING: these lines are joined with "\n", so a clause split
	// across two entries never appears contiguously in the output. The wrapping
	// is chosen so each load-bearing phrase stays whole and can be asserted on —
	// break "Never imply a conversation" over a line and the guard silently stops
	// being testable while still reading fine to a human.
	const guidance =
		mode === 'compact'
			? [
					"This is the applicant's own record of what has happened on this",
					'application: correspondence, interview rounds, feedback, briefs, offers,',
					'and the documents they attached. Treat it as the most reliable',
					'information you have about this employer and this role: where it',
					'contradicts the job posting or an assumption the applicant made earlier,',
					'the record wins, and the corrected version is the one to use.',
					'',
					'It does NOT license you to reference the interaction itself.',
					'Never imply a conversation, meeting or relationship that is not',
					'recorded below, and never imply the applicant has been sent,',
					'has signed, or has read anything — the text you are writing may well',
					'predate all of it.',
					'Use what was learned, not the fact that it was learned.',
					'',
					'It may be written in a different language than the text you are',
					'producing. Translate what you use; never drop a point because of the',
					'language it happens to be written in.'
				]
			: [
					"This is the applicant's own record of earlier rounds, feedback,",
					'correspondence and the documents attached to this application. It is',
					'the most important input you have: act on it,',
					'do not merely acknowledge it. Build on what was already discussed,',
					'address the concerns that were raised, use the exact requirements and',
					'tasks that were set, and do not re-prepare ground already covered.',
					'',
					'Where it corrects something the applicant got wrong, sets a task, or',
					'recommends specific preparation, that correction and that',
					'recommendation are the point — surface them explicitly rather than',
					'quietly working around them.',
					'',
					'It may be written in a different language than the text you are',
					'producing. Translate what you use; never drop a point because of the',
					'language it happens to be written in.'
				];

	const omission =
		dropped > 0
			? [
					'',
					`NOTE: ${dropped} further entry(s) exist but were omitted to fit. Treat`,
					'the picture below as partial rather than complete.'
				]
			: [];

	// A dropped entry is announced; a cut one used to announce only itself, with
	// an inline marker mid-text that is easy to read past. The two failures are
	// not the same and neither is "there is nothing there": an entry you hold 5%
	// of is one whose answer you have probably not been shown.
	const cutCount = kept.filter((e) => truncationOf(e, mode)).length;
	const truncation =
		cutCount > 0
			? [
					'',
					`NOTE: ${cutCount} entry(s) below are shown only in part, marked with a`,
					'[…middle omitted…] break and a Shown: count in the heading. Where you',
					'were asked about something an entry should contain and you cannot find',
					'it there, say the entry is cut rather than concluding it is absent.'
				]
			: [];

	return [
		'## What has already happened in this application',
		'',
		...guidance,
		...omission,
		...truncation,
		'',
		kept.map((e) => renderBlock(e, mode)).join('\n\n---\n\n')
	].join('\n');
}

/**
 * Extract one record's attached file into its `content`, on demand.
 *
 * The composer calls this straight after creating a file-backed record, so the
 * entry is written and visible *before* the extraction runs — a 40-page PDF
 * must not hold the form open. Idempotent via `extraction_status`, so calling
 * it twice, or racing it with the lazy path in `applicationActivityText`, is
 * harmless.
 *
 * Returns the extracted text, or null when there was none to get.
 */
export async function extractRecordFile(recordId: number): Promise<string | null> {
	const row = await db.query.application_records.findFirst({
		where: eq(application_records.id, recordId),
		columns: {
			id: true,
			file_id: true,
			extraction_status: true,
			content: true
		},
		with: { file: { columns: { filename_download: true, title: true } } }
	});
	if (!row) return null;
	return ensureExtracted(row as ExtractableRow, row.content);
}

/** The junction/record shape the extractor needs. */
interface ExtractableRow {
	id: number;
	file_id: string | null;
	extraction_status: string;
	file: { filename_download: string; title: string | null } | null;
}

/**
 * Return a file-backed row's extracted text, extracting and caching it on first
 * use. Terminal states ("extracted"/"skipped") short-circuit; any failure is
 * recorded as "skipped" so it is never retried, and never fails the caller —
 * context is a bonus, not a precondition.
 */
async function ensureExtracted(row: ExtractableRow, cached: string | null): Promise<string | null> {
	if (row.extraction_status === 'extracted') return cached?.trim() || null;
	if (row.extraction_status === 'skipped') return null;

	if (!row.file_id) {
		await markSkipped(row.id, 'no file attached');
		return null;
	}

	try {
		const buffer = await getFile(row.file_id);
		const filename = row.file?.filename_download || 'document';
		const result = await extractUpload({ filename, bytes: buffer });
		const text = result.files
			.map((f) => f.text)
			.join('\n\n')
			.trim();
		if (!text) {
			await markSkipped(row.id, 'no extractable text');
			return null;
		}
		// The extracted text lands in `content`, where it stays user-editable —
		// fix bad OCR, trim a quoted reply chain. The file is provenance, not the
		// source of truth.
		await db
			.update(application_records)
			.set({
				content: text,
				extraction_status: 'extracted',
				extraction_error: null,
				date_extracted: new Date()
			})
			.where(eq(application_records.id, row.id));
		return text;
	} catch (err) {
		await markSkipped(row.id, (err as Error).message);
		return null;
	}
}

async function markSkipped(id: number, reason: string): Promise<void> {
	await db
		.update(application_records)
		.set({
			extraction_status: 'skipped',
			extraction_error: reason.slice(0, 2000),
			date_extracted: new Date()
		})
		.where(eq(application_records.id, id));
}

/**
 * Load everything recorded against an application, oldest first — the order the
 * rounds happened in, which is the order the formatter and the reader both
 * assume. Entries whose text is still empty (a file that failed to extract) are
 * left out: this is the *contents* shape, and the activity index is what says
 * an entry exists at all.
 *
 * Attached files were unioned in from `applications_files` during the Activity
 * transition; migration 0074 moved those rows into `application_records` and
 * dropped the table, so there is one read again. Extraction happens here rather
 * than in the formatter because filling `content` from an attached file is
 * materialising the data, not framing it.
 *
 * THROWS on a real failure, deliberately. Swallowing is a prompt-assembly
 * policy, and it lives one level up in `applicationActivityText`; a caller
 * reading this as data needs "the query failed" and "nothing is recorded" to be
 * different answers.
 */
export async function loadActivityEntries(
	applicationId: number,
	opts: { limit?: number } = {}
): Promise<ActivityEntry[]> {
	const rows = await db.query.application_records.findMany({
		where: eq(application_records.application_id, applicationId),
		// Oldest first: the model reads the rounds in the order they happened.
		orderBy: [asc(application_records.event_date), asc(application_records.date_created)],
		// Read a little past the cap so the budget pass has something to choose
		// between rather than being handed a pre-truncated set. A caller that is
		// not assembling a prompt can raise it — this is a default, not a rule.
		limit: opts.limit ?? TOTALS.full.maxEntries * 2,
		with: {
			file: { columns: { filename_download: true, title: true } }
		}
	});

	const entries: ActivityEntry[] = [];
	for (const row of rows) {
		const content = row.file_id
			? await ensureExtracted(row as ExtractableRow, row.content)
			: row.content;
		if (!content?.trim()) continue;
		entries.push({
			id: row.id,
			record_type: row.record_type,
			title: row.title,
			content,
			step: row.step,
			event_date: row.event_date,
			from_file: !!row.file_id
		});
	}

	return entries;
}

/**
 * Load and render. Returns "" when there is nothing — callers interpolate it
 * blindly.
 */
export async function applicationActivityText(
	applicationId: number,
	mode: ActivityContextMode = 'full'
): Promise<string> {
	try {
		return formatActivityContext(await loadActivityEntries(applicationId), mode);
	} catch {
		// Context is a bonus, never a reason to fail the generation.
		return '';
	}
}
