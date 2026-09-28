/**
 * Notes in an export written before they moved to the timeline.
 *
 * An application's notes used to be a list on the row, exported as
 * `application_note`. They are `note` entries on its timeline now, where the
 * key facts, the assistant and the letters read them, and migration 0063 moved
 * the stored ones there and dropped the list. An export file written before
 * that still carries it, so the import makes the same move rather than losing
 * them.
 */
import { deriveRecordTitle } from '$lib/application-records';

export interface LegacyNoteEntry {
	title: string;
	content: string;
	event_date: string;
	date_created: Date;
}

/**
 * The entries to write for one application's exported list, oldest first as
 * the list kept them. A note without text is dropped, and one whose timestamp
 * does not parse is dated `now`, as the migration does, rather than failing
 * the import over it.
 */
export function legacyNoteEntries(raw: unknown, now: Date = new Date()): LegacyNoteEntry[] {
	if (!Array.isArray(raw)) return [];

	const entries: LegacyNoteEntry[] = [];
	for (const item of raw) {
		if (!item || typeof item !== 'object') continue;
		const { text, created_at } = item as { text?: unknown; created_at?: unknown };

		const content = typeof text === 'string' ? text.trim() : '';
		if (!content) continue;

		const written = typeof created_at === 'string' ? new Date(created_at) : null;
		const at = written && !Number.isNaN(written.getTime()) ? written : now;

		entries.push({
			title: deriveRecordTitle(content),
			content,
			event_date: at.toISOString().slice(0, 10),
			date_created: at
		});
	}
	return entries;
}
