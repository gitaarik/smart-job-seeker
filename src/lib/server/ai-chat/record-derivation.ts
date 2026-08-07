/**
 * Fills in the metadata the Activity composer deliberately never asks for.
 *
 * The composer takes a paste or a file and nothing else. Title, type, event
 * date and contacts are derived — first by cheap fallbacks at write time
 * (first line, filename, the application's current stage, today), then by this
 * pass, which replaces those guesses with something the content actually
 * supports. See planning/APPLICATION-ACTIVITY.md.
 *
 * ## Three rules that are load-bearing rather than stylistic
 *
 * 1. **Fill only what is empty.** A hand-corrected name or a retitled entry is
 *    never overwritten. A write-side process that is right in general silently
 *    undoing a specific correction the user made deliberately is the worst
 *    failure available here, and it is invisible when it happens.
 *
 * 2. **Once per content version.** Guarded on `date_updated > derived_at`, so
 *    edited content gets fresh metadata and untouched content never pays for a
 *    second call. `derived_at` is also what keeps the "no employer contact yet"
 *    aggregate honest: NULL means *nobody has looked*, not *nobody was
 *    involved*.
 *
 * 3. **Never blocks, never charges.** Best-effort: any failure leaves the
 *    fallbacks in place, which are already usable. It is infrastructure the
 *    user never invoked — they attached a file — so billing them for the
 *    system's own indexing would be a surprise.
 */

import { db } from '$lib/server/db';
import { eq } from 'drizzle-orm';
import { application_records } from '$lib/server/db/schema';
import { createAndGenerateAiChat } from './utils';
import { contactRoleValues, type RecordContact, recordTypeValues } from '$lib/application-records';

/**
 * Below this, a first line is as good a title as an LLM one and there is
 * nothing to find in the way of dates or people. Skipping these is most of the
 * cost control: short notes are the commonest entry by far.
 */
const MIN_CHARS_FOR_DERIVATION = 200;

/** What the model is allowed to see. Beyond this, the tail adds nothing. */
const MAX_CHARS_SENT = 12000;

/** The model's answer, before any of it is trusted. */
interface Candidate {
	title?: unknown;
	record_type?: unknown;
	event_date?: unknown;
	contacts?: unknown;
}

const asText = (v: unknown): string | null => (typeof v === 'string' && v.trim() ? v.trim() : null);

/**
 * Coercion lives here rather than in the schema because a `.transform()` on
 * the wire type throws "Transforms cannot be represented in JSON Schema" the
 * moment LangChain converts it for structured output.
 */
export function coerceDerived(candidate: Candidate): {
	title: string | null;
	record_type: string | null;
	event_date: string | null;
	contacts: RecordContact[];
} {
	const title = asText(candidate.title);

	const rawType = asText(candidate.record_type)?.toLowerCase() ?? null;
	// An invented type would render as the fallback label and never match a
	// filter, so an unknown value is dropped rather than stored.
	const record_type = rawType && recordTypeValues.includes(rawType) ? rawType : null;

	// Anything that isn't a plain YYYY-MM-DD is discarded rather than guessed
	// at: a wrong date silently reorders the stream, which is worse than none.
	const rawDate = asText(candidate.event_date);
	const event_date =
		rawDate && /^\d{4}-\d{2}-\d{2}$/.test(rawDate) && !isNaN(new Date(rawDate).getTime())
			? rawDate
			: null;

	const contacts: RecordContact[] = [];
	const seen = new Set<string>();
	if (Array.isArray(candidate.contacts)) {
		for (const entry of candidate.contacts) {
			if (!entry || typeof entry !== 'object') continue;
			const name = asText((entry as { name?: unknown }).name);
			if (!name) continue;
			// Same normalisation the read-time roll-up uses, so "Anna Cooper" twice
			// in one entry collapses to one person.
			const key = name.toLowerCase().replace(/\s+/g, ' ');
			if (seen.has(key)) continue;
			seen.add(key);
			const rawRole = asText((entry as { role?: unknown }).role)?.toLowerCase();
			contacts.push({
				name,
				role:
					rawRole && contactRoleValues.includes(rawRole) ? (rawRole as RecordContact['role']) : null
			});
		}
	}

	return { title, record_type, event_date, contacts };
}

/**
 * Which derived values may actually be written.
 *
 * A record the user has never edited (`date_updated` null) carries only
 * write-time fallbacks — a first-line title, a defaulted type, today's date —
 * so derivation may replace all of them. Once they have edited it, only fields
 * that are still genuinely blank get filled, because anything else could be a
 * deliberate correction and silently undoing one is the failure that matters.
 *
 * Pure, so the rule is testable without a DB or an LLM.
 */
export function pickChanges(
	record: {
		contacts: unknown;
		event_date: string | null;
		date_updated: Date | null;
	},
	derived: {
		title: string | null;
		record_type: string | null;
		event_date: string | null;
		contacts: RecordContact[];
	}
): Record<string, unknown> {
	const untouched = !record.date_updated;
	const changes: Record<string, unknown> = {};

	if (derived.title && untouched) changes.title = derived.title;
	if (derived.record_type && untouched) {
		changes.record_type = derived.record_type;
	}
	// The date is fallback-filled with today, which is a guess rather than a
	// decision — so an untouched record may have it replaced, and an edited one
	// only if it is somehow blank.
	if (derived.event_date && (untouched || !record.event_date)) {
		changes.event_date = derived.event_date;
	}
	// Contacts are the one field the composer cannot pre-fill, so a non-empty
	// array can only have come from the user. It always stands.
	const existing = Array.isArray(record.contacts) ? record.contacts : [];
	if (derived.contacts.length > 0 && existing.length === 0) {
		changes.contacts = derived.contacts;
	}

	return changes;
}

/**
 * Whether this record is worth a call at all. Exported so the decision is
 * testable without a DB or an LLM.
 */
export function shouldDerive(record: {
	content: string | null;
	derived_at: Date | null;
	date_updated: Date | null;
}): boolean {
	const content = record.content?.trim() ?? '';
	if (content.length < MIN_CHARS_FOR_DERIVATION) return false;
	if (!record.derived_at) return true;
	// Re-derive only when the content actually moved on.
	return !!record.date_updated && record.date_updated > record.derived_at;
}

/**
 * Derive and store metadata for one record. Returns what was written, or null
 * when nothing was (too short, already current, the call failed).
 *
 * ## How "don't overwrite the user" is decided
 *
 * Not by emptiness — the composer ALWAYS writes a title and a type, so those
 * fields are never empty and a naive emptiness check would either overwrite
 * every hand-edit or fill nothing at all.
 *
 * `date_updated` is the signal instead: it is null until something edits the
 * row, and only the update action does that. So a record the user has never
 * touched is carrying nothing but write-time fallbacks, and derivation may
 * replace them freely. The moment they edit anything, derivation stops
 * touching the fields they could plausibly have set and fills only what is
 * genuinely still blank.
 */
export async function deriveRecordMetadata(
	recordId: number,
	profileId: number
): Promise<Record<string, unknown> | null> {
	try {
		const record = await db.query.application_records.findFirst({
			where: eq(application_records.id, recordId),
			columns: {
				id: true,
				title: true,
				content: true,
				record_type: true,
				event_date: true,
				contacts: true,
				derived_at: true,
				date_updated: true,
				file_id: true
			},
			with: { file: { columns: { filename_download: true } } }
		});
		if (!record || !shouldDerive(record)) return null;

		const result = await createAndGenerateAiChat(profileId, 'derive_record_metadata', {
			content: record.content!.slice(0, MAX_CHARS_SENT),
			filename: record.file?.filename_download
				? `The text was extracted from a file named "${record.file.filename_download}".\n\n`
				: ''
		});
		if (!result.success || !result.aiChat?.response) return null;

		const derived = coerceDerived(JSON.parse(result.aiChat.response) as Candidate);

		const changes = pickChanges(record, derived);

		// Stamped even when nothing changed: the point of the column is "has
		// anyone looked", and a pass that found nothing HAS looked.
		await db
			.update(application_records)
			.set({ ...changes, derived_at: new Date() })
			.where(eq(application_records.id, recordId));

		return changes;
	} catch {
		// Never a reason to fail a save. The write-time fallbacks stand.
		return null;
	}
}
