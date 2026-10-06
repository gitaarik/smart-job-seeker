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
 *
 * ## The rounds ahead
 *
 * Besides its facts, a digest says which rounds are still to come, in the shape
 * of an application's own rounds (`InterviewRound`). A list of facts kept what
 * comes next only by luck. Measured on a real 17,000-character intro call,
 * where the recruiter named the first round's interviewer in passing, in answer
 * to another question and on a condition ("if this goes forward, you will
 * meet..."): the facts kept him in 1 run of 3, and filled their "next step" with
 * the to-dos around it (send a CV, accept a LinkedIn request). A paragraph
 * telling the model to look for it took that to 2 of 3, filed under "other". A
 * field it has to fill kept him in 3 of 3 (twice in the field itself), and in
 * this shape the smoke's version of that call has had him in the field 4 of 4.
 *
 * A call that only moves a round is where the field still slips: the model
 * writes the new day as a fact and leaves the rounds empty, about 1 run in 14 at
 * temperature 0 (1 in 4 at 0.2), measured on the smoke's version of such a call
 * on 2026-10-06. So a digest with no rounds ahead but a fact dated on or after
 * the entry's day is read once more, with those facts named above the text
 * (roundsLeftOut, recheckNote), and the second reading is kept when it finds a
 * round. Only those entries pay for it.
 */

import { createHash } from 'node:crypto';
import { db } from '$lib/server/db';
import { eq } from 'drizzle-orm';
import { application_records } from '$lib/server/db/schema';
import { createAndGenerateAiChat } from './utils';
import { truncateKeepingEnds } from './application-activity';
import { getRecordTypeLabel, LONG_ENTRY_CHARS } from '$lib/application-records';
import { coerceEntryFacts, parseObject, type EntryFact } from '$lib/application-details';
import { roundKindValues, type InterviewRound } from '$lib/application-status';

/**
 * The digest contract's version, carried on every hash. Bump it when what a
 * digest holds changes shape, and every entry is re-read on its application's
 * next summary. Not for prompt wording. See SUMMARY_CONTRACT_VERSION for the
 * failure this prevents.
 *
 *   v1 — gist + facts
 *   v2 — adds `ahead`, the rounds still to come; relative days become dates,
 *        and the employer's name corrects a transcript that misheard it
 */
export const DIGEST_CONTRACT_VERSION = 2;

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

/** More rounds than one entry ever announces. Only there so a list is bounded. */
const MAX_AHEAD = 5;
const MAX_WITH_CHARS = 200;
const MAX_ABOUT_CHARS = 300;

/**
 * One round still to come, as an entry describes it: an `InterviewRound`, so
 * what a call says about the next round reads the way the application records
 * it, plus a line for the rest.
 */
export interface AheadRound extends InterviewRound {
	/** Its format, what it covers, any condition on it, what it was moved from. */
	about: string | null;
}

export interface EntryDigest {
	gist: string;
	facts: EntryFact[];
	/** Empty when the entry says nothing about rounds to come, and for a v1 digest. */
	ahead: AheadRound[];
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

/**
 * Whether the stored digest was written from this entry's text as it is now,
 * by this contract or an older one.
 *
 * An older contract's digest is stale, since it lacks what the contract added
 * since, but nothing in it is wrong, so the summariser reads it until the entry
 * is read again. Without this a contract bump turned every long entry into a cut
 * excerpt at once, and the write path re-reads only three per save.
 */
export function digestReadsCurrentText(
	entry: DigestSource & { digest_hash: string | null }
): boolean {
	if (!entry.digest_hash) return false;
	const text = (hash: string) => hash.slice(hash.indexOf(':') + 1);
	return text(entry.digest_hash) === text(digestHash(entry));
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
	return { gist, facts: coerceEntryFacts(r.facts), ahead: coerceAhead(r.ahead) };
}

const asLine = (v: unknown, max: number): string | null => {
	if (typeof v !== 'string') return null;
	const line = v.trim().replace(/\s+/g, ' ');
	if (!line) return null;
	return line.length > max ? line.slice(0, max).trimEnd() + '…' : line;
};

/**
 * The rounds ahead, field by field. A field that is not what its name says is
 * dropped rather than the round: "next Thursday" is no date, but the round it
 * belongs to, and who runs it, are still worth having. A kind outside
 * `roundKinds` is dropped for the reason the assistant is held to them, and a
 * round with nothing left in it is no round.
 */
export function coerceAhead(raw: unknown): AheadRound[] {
	if (!Array.isArray(raw)) return [];
	const rounds: AheadRound[] = [];
	for (const item of raw) {
		const value = typeof item === 'string' ? parseObject(item) : item;
		if (!value || typeof value !== 'object' || Array.isArray(value)) continue;
		const o = value as Record<string, unknown>;

		const kindText = typeof o.kind === 'string' ? o.kind.trim().toLowerCase() : null;
		const kind = roundKindValues.find((k) => k.toLowerCase() === kindText) ?? null;
		const dateText = typeof o.date === 'string' ? o.date.trim() : '';
		const date =
			/^\d{4}-\d{2}-\d{2}$/.test(dateText) && !Number.isNaN(Date.parse(dateText)) ? dateText : null;
		// 9:30, 15.30 and 15:30:00 are all a time; "3.30pm" is not, and is dropped.
		const clock =
			typeof o.time === 'string' ? o.time.trim().match(/^(\d{1,2})[:.](\d{2})(?::\d{2})?$/) : null;
		const time =
			clock && Number(clock[1]) < 24 && Number(clock[2]) < 60
				? `${clock[1].padStart(2, '0')}:${clock[2]}`
				: null;

		const round: AheadRound = {
			kind,
			date,
			time,
			with: asLine(o.with, MAX_WITH_CHARS),
			about: asLine(o.about, MAX_ABOUT_CHARS)
		};
		if (Object.values(round).some((v) => v !== null)) rounds.push(round);
	}
	return rounds.slice(0, MAX_AHEAD);
}

const DAY_MS = 86_400_000;

/** A `YYYY-MM-DD` as UTC midnight, where that string parses, or null. */
function dayOf(date: string): Date | null {
	const at = new Date(`${date}T00:00:00Z`);
	return /^\d{4}-\d{2}-\d{2}$/.test(date) && !Number.isNaN(at.getTime()) ? at : null;
}

/**
 * The entry's week and the one after, day by day: "Mon 2026-09-28, Tue ...".
 *
 * Measured on a call that moved a round to "Thursday from 3.30": given only
 * the date and its weekday, gpt-oss put the round on the Wednesday one run in
 * seven, counting the days itself. A list turns the count into a lookup, and
 * "Thursday next week" said on a Friday is the first Thursday in it.
 */
function weekLines(at: Date): string[] {
	const monday = at.getTime() - ((at.getUTCDay() + 6) % 7) * DAY_MS;
	const week = (start: number) =>
		Array.from({ length: 7 }, (_, i) => {
			const day = new Date(start + i * DAY_MS);
			const name = day.toLocaleDateString('en-US', { weekday: 'short', timeZone: 'UTC' });
			return `${name} ${day.toISOString().slice(0, 10)}`;
		}).join(', ');
	return [`Its week: ${week(monday)}`, `The week after: ${week(monday + 7 * DAY_MS)}`];
}

/** What the lines above an entry's text are written from. */
export interface DigestAbout {
	record_type: string | null;
	title: string | null;
	event_date: string | null;
	filename: string | null;
	/** The job the application is for: it names the employer a transcript mishears. */
	job: { title: string | null; company: string | null } | null;
}

/**
 * The lines above the text: what kind of entry it is and when, so the model can
 * read "the recruiter" and "Monday" correctly, and how much of it is shown.
 *
 * The weekday and the two weeks are there because "Thursday" is a date only
 * against them (see `weekLines`). The employer is there because a transcriber
 * hears a company name it does not know as words it does ("Nor Vic Data" for
 * Norvik Data), and that name is how the applicant finds the round again.
 */
export function renderDigestAbout(entry: DigestAbout, shown: number, total: number): string {
	const day = entry.event_date ? dayOf(entry.event_date) : null;
	const weekday = day?.toLocaleDateString('en-US', { weekday: 'long', timeZone: 'UTC' });
	return [
		`Type: ${getRecordTypeLabel(entry.record_type)}`,
		`Title: ${entry.title?.trim() || 'Untitled'}`,
		entry.event_date ? `Date: ${entry.event_date}${weekday ? ` (${weekday})` : ''}` : null,
		...(day ? weekLines(day) : []),
		entry.job?.company?.trim() ? `Employer: ${entry.job.company.trim()}` : null,
		entry.job?.title?.trim() ? `Role: ${entry.job.title.trim()}` : null,
		entry.filename ? `Extracted from a file named "${entry.filename}".` : null,
		shown < total
			? `Shown: ${shown} of ${total} characters. The middle is cut; say nothing about what it held.`
			: null
	]
		.filter((l) => l !== null)
		.join('\n');
}

/**
 * The facts a digest dates on or after the entry's own day, when it lists no
 * rounds ahead: the sign that a round still to come was written down as a fact
 * only (see "The rounds ahead" above). Empty when the digest lists a round, or
 * when the entry has no date to count from.
 */
export function roundsLeftOut(digest: EntryDigest, entryDate: string | null): EntryFact[] {
	if (digest.ahead.length > 0 || !entryDate || !dayOf(entryDate)) return [];
	return digest.facts.filter((fact) =>
		(`${fact.label} ${fact.value}`.match(/\b\d{4}-\d{2}-\d{2}\b/g) ?? []).some(
			(date) => date >= entryDate
		)
	);
}

/**
 * The line added above the text when an entry is read again because of
 * roundsLeftOut. It names the dated facts and leaves the call to the model: a
 * deadline is dated too, and stays a fact.
 */
export function recheckNote(facts: readonly EntryFact[]): string {
	const listed = facts
		.slice(0, 5)
		.map((fact) => `"${fact.label}: ${fact.value}"`)
		.join('; ');
	return (
		`A first reading of this entry listed no rounds ahead, yet dated these facts on or after its day: ${listed}. ` +
		'If one of them is an interview, a call, an assignment or another round still to come, list it in "ahead" too, with its date and time. ' +
		'A deadline for something to send or do is not a round.'
	);
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
			with: {
				file: { columns: { filename_download: true } },
				application: {
					columns: { id: true },
					with: { job: { columns: { title: true, company: true } } }
				}
			}
		});
		if (!record || !isLongEntry(record)) return null;
		if (hasCurrentDigest(record)) return record.digest ? coerceDigest(record.digest) : null;

		const text = record.content!.trim();
		const shownText = truncateKeepingEnds(text, MAX_CHARS_READ);

		const about = renderDigestAbout(
			{
				...record,
				filename: record.file?.filename_download ?? null,
				job: record.application?.job ?? null
			},
			shownText.length,
			text.length
		);
		const read = async (lines: string) => {
			const result = await createAndGenerateAiChat(
				profileId,
				'digest_activity_entry',
				{ about: lines, content: shownText },
				undefined,
				{ traceSession: `application:${record.application_id}` }
			);
			return result.success && result.aiChat?.response
				? coerceDigest(JSON.parse(result.aiChat.response))
				: null;
		};

		let digest = await read(about);
		if (!digest) return null;
		// A round written down as a fact only: read once more, and keep that
		// reading when it lists the round (see "The rounds ahead" above).
		const leftOut = roundsLeftOut(digest, record.event_date);
		if (leftOut.length) {
			const again = await read(`${about}\n${recheckNote(leftOut)}`);
			if (again?.ahead.length) digest = again;
		}

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
