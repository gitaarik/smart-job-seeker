/**
 * One long activity entry, read once and condensed: a line on what it is, and
 * the facts it holds.
 *
 * ## Why entries are digested one at a time
 *
 * The application's summariser writes the standing summary, the offer terms
 * and the key facts from the whole history, and it reran over the raw text of
 * every entry on every change. That had a ceiling, and the ceiling bit: it read
 * the chronology oldest first and stopped at 40,000 characters, so a busy
 * application was summarised from its opening weeks. Measured on dev: one with
 * 379,000 characters over 40 entries was read to its seventh, and another,
 * seven entries and 151,000 characters, to its third. Both overviews described
 * a state weeks out of date, and the assistant compared other applications
 * against them.
 *
 * Reading each long entry once, when it is written, splits that work in two.
 * This pass reads one entry whole and writes its digest; the summariser reads
 * the digests. An entry's text is paid for once rather than on every later
 * change to the application, and what the summariser reads grows by about a
 * paragraph per entry instead of by the entry.
 *
 * Short entries are not digested. Under LONG_ENTRY_CHARS the text is about as
 * long as its digest would be, and they are mostly the applicant's own notes,
 * whose exact words (a threshold, a condition) are what matters. The
 * summariser reads those whole.
 *
 * ## When it runs
 *
 * From the summariser, for any long entry whose digest is missing or stale, so
 * every path that already summarises an application after a write (the
 * composer, an upload, the assistant, MCP, an undo) digests the new entry with
 * no change of its own. Hash-gated like the summary: an edit to the title costs
 * nothing, an edit to the text re-reads it.
 */

import { createHash } from 'node:crypto';
import { db } from '$lib/server/db';
import { eq } from 'drizzle-orm';
import { application_records } from '$lib/server/db/schema';
import { createAndGenerateAiChat } from './utils';
import { truncateKeepingEnds } from './application-activity';
import { getRecordTypeLabel, LONG_ENTRY_CHARS } from '$lib/application-records';
import { coerceEntryFacts, type EntryFact } from '$lib/application-details';

/**
 * The digest contract's version, carried on every hash. Bump it when what a
 * digest holds changes shape, and every entry is re-read on its application's
 * next summary. Not for prompt wording. See SUMMARY_CONTRACT_VERSION for the
 * failure this prevents.
 *
 *   v1 — gist + facts
 */
export const DIGEST_CONTRACT_VERSION = 1;

const DIGEST_PREFIX = `v${DIGEST_CONTRACT_VERSION}:`;

/**
 * The most of one entry this pass reads. The longest entry on dev in 2026-09
 * was 94,565 characters (an interview transcript), about 25,000 tokens: well
 * inside the extraction model's window. Past this the middle is cut, and the
 * prompt says so.
 */
const MAX_CHARS_READ = 120000;

/** A gist is a line or two. This only stops a runaway answer. */
const MAX_GIST_CHARS = 600;

export interface EntryDigest {
	gist: string;
	facts: EntryFact[];
}

/** The fields a digest is written from. Only these can change what it says. */
export interface DigestSource {
	record_type: string | null;
	event_date: string | null;
	content: string | null;
}

/**
 * Fingerprint what the digest reads. The title is left out on purpose: the
 * derivation pass retitles an entry after it is written, and a new title says
 * nothing new about what the text holds. The date stays in, because a
 * transcript's "next Tuesday" means something only against it.
 */
export function digestHash(entry: DigestSource): string {
	const material = [entry.record_type, entry.event_date, entry.content].join('\u0000');
	return DIGEST_PREFIX + createHash('sha256').update(material).digest('hex');
}

/** Long enough that the summariser reads it through a digest, not whole. */
export function isLongEntry(entry: { content: string | null }): boolean {
	return (entry.content?.trim().length ?? 0) > LONG_ENTRY_CHARS;
}

/** Whether the stored digest was written from this entry as it is now. */
export function hasCurrentDigest(entry: DigestSource & { digest_hash: string | null }): boolean {
	return !!entry.digest_hash && entry.digest_hash === digestHash(entry);
}

/** A long entry with no digest, or one written from different text. */
export function needsDigest(entry: DigestSource & { digest_hash: string | null }): boolean {
	return isLongEntry(entry) && !hasCurrentDigest(entry);
}

/**
 * Our side of the boundary. A digest with no gist is a malformed answer rather
 * than an entry with nothing in it, so it is not stored and the entry is tried
 * again on the next summary. A gist with no facts is a real answer: a long
 * onboarding guide can have nothing in it worth keeping.
 */
export function coerceDigest(raw: unknown): EntryDigest | null {
	if (!raw || typeof raw !== 'object') return null;
	const r = raw as Record<string, unknown>;
	const gistRaw = typeof r.gist === 'string' ? r.gist.trim().replace(/\s+/g, ' ') : '';
	if (!gistRaw) return null;
	const gist =
		gistRaw.length > MAX_GIST_CHARS ? gistRaw.slice(0, MAX_GIST_CHARS).trimEnd() + '…' : gistRaw;
	return { gist, facts: coerceEntryFacts(r.facts) };
}

/**
 * The lines above the text: what kind of entry it is and when, so the model can
 * read "the recruiter" and "Monday" correctly, and how much of it is shown.
 */
function renderAbout(
	entry: DigestSource & { title: string | null; filename: string | null },
	shown: number,
	total: number
): string {
	return [
		`Type: ${getRecordTypeLabel(entry.record_type)}`,
		`Title: ${entry.title?.trim() || 'Untitled'}`,
		entry.event_date ? `Date: ${entry.event_date}` : null,
		entry.filename ? `Extracted from a file named "${entry.filename}".` : null,
		shown < total
			? `Shown: ${shown} of ${total} characters. The middle is cut; say nothing about what it held.`
			: null
	]
		.filter((l) => l !== null)
		.join('\n');
}

/**
 * Digest one entry, if it needs it. Returns the digest the entry now carries,
 * or null when it has none (too short, or the call failed).
 *
 * Best-effort: the summariser reads a long entry without a digest as a cut
 * excerpt, which is what it did before this existed, so nothing here is worth
 * failing the write that triggered it.
 */
export async function digestEntry(
	recordId: number,
	profileId: number
): Promise<EntryDigest | null> {
	try {
		const record = await db.query.application_records.findFirst({
			where: eq(application_records.id, recordId),
			columns: {
				id: true,
				application_id: true,
				record_type: true,
				title: true,
				event_date: true,
				content: true,
				digest: true,
				digest_hash: true
			},
			with: { file: { columns: { filename_download: true } } }
		});
		if (!record || !isLongEntry(record)) return null;
		if (hasCurrentDigest(record)) return record.digest ? coerceDigest(record.digest) : null;

		const text = record.content!.trim();
		const shownText = truncateKeepingEnds(text, MAX_CHARS_READ);

		const result = await createAndGenerateAiChat(
			profileId,
			'digest_activity_entry',
			{
				about: renderAbout(
					{ ...record, filename: record.file?.filename_download ?? null },
					shownText.length,
					text.length
				),
				content: shownText
			},
			undefined,
			{ traceSession: `application:${record.application_id}` }
		);
		if (!result.success || !result.aiChat?.response) return null;

		const digest = coerceDigest(JSON.parse(result.aiChat.response));
		if (!digest) return null;

		// Hashed from the row as it was read, so text that changed during the call
		// is stale on the next summary rather than stamped current.
		await db
			.update(application_records)
			.set({ digest, digest_hash: digestHash(record), digest_at: new Date() })
			.where(eq(application_records.id, recordId));

		return digest;
	} catch (error) {
		console.warn(
			`[digest] entry ${recordId} not digested:`,
			error instanceof Error ? error.message : error
		);
		return null;
	}
}
