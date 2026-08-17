/**
 * The shape a project editor works in, shared by the list, one row, and the
 * store underneath both.
 *
 * Strings rather than nullables throughout: an `<input>` has no null, and every
 * "" ↔ null translation happening in one place (`toBody`) is what stops the two
 * halves of a save disagreeing about whether a cleared field is empty or absent.
 */
export interface ProjectData extends Record<string, unknown> {
	name: string;
	url: string;
	/** `YYYY-MM-DD`, which is what `<input type="date">` reads and writes. */
	start_date: string;
	end_date: string;
	description: string;
	outcome: string;
}

/** A date column as the editor needs it: the day, with no timezone in it. */
export function dateInputValue(value: unknown): string {
	if (!value) return '';
	// A `date()` column arrives as "YYYY-MM-DD" already; only a Date (or an
	// ISO string from an older serializer) needs cutting down, and going through
	// the Date constructor for the string form would move the day either side of
	// UTC.
	if (typeof value === 'string') return value.slice(0, 10);
	return value instanceof Date ? value.toISOString().slice(0, 10) : '';
}

/** A project as the page loads it — a type, not an interface, so it is structural. */
export type LoadedProject = {
	id: number;
	name: string | null;
	url: string | null;
	start_date: string | Date | null;
	end_date: string | Date | null;
	description: string | null;
	outcome: string | null;
};

/** One loaded project row as the editor's own shape. */
export function toProjectData(row: LoadedProject): ProjectData {
	return {
		name: row.name ?? '',
		url: row.url ?? '',
		start_date: dateInputValue(row.start_date),
		end_date: dateInputValue(row.end_date),
		description: row.description ?? '',
		outcome: row.outcome ?? ''
	};
}

export function blankProject(): ProjectData {
	return { name: '', url: '', start_date: '', end_date: '', description: '', outcome: '' };
}

/** The PATCH/POST body for a project: trimmed, with empty meaning cleared. */
export function projectBody(v: ProjectData): Record<string, unknown> {
	return {
		name: v.name.trim(),
		url: v.url.trim() || null,
		start_date: v.start_date || null,
		end_date: v.end_date || null,
		description: v.description.trim() || null,
		outcome: v.outcome.trim() || null
	};
}

/**
 * A project is worth creating once it has a name.
 *
 * `name` is the section's only required field, so this is the moment the row
 * would validate — and it is also the moment it becomes something the applicant
 * would recognise in a list. Before that it is a row they have opened, not a row
 * they have written.
 */
export function projectIsWorthCreating(v: ProjectData): boolean {
	return v.name.trim().length > 0;
}
