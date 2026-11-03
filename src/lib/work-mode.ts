/**
 * How a role was worked: at the employer's place, partly there, or from
 * somewhere else.
 *
 * Its own column since 2026-11-03 (migration 0083). Before that the only place
 * to say a role was remote was its location, and a template that prints the
 * location inside a sentence then printed the arrangement as a place: Citrus
 * appends " in {location}." to a role's headline, so a location of
 * "Remote (Austin, USA)" ended a lead line on "…reviewed by senior engineers in
 * Austin, USA (remote)." With the two apart, `location` is where the employer is
 * and each template words the arrangement for itself.
 *
 * The values are the job side's `work_location` words (WORK_LOCATIONS in
 * data/job-taxonomy.ts), so a role and a posting say remote the same way. Null
 * means the applicant has not said, and prints exactly as a role did before
 * the column existed.
 */
import { WORK_MODE_LABELS, templateLabel } from '$lib/resume-template-labels';

export const WORK_MODES = ['onsite', 'hybrid', 'remote'] as const;
export type WorkMode = (typeof WORK_MODES)[number];

/** The editor's choices, in the order a person reads them. */
export const WORK_MODE_OPTIONS: ReadonlyArray<{ value: WorkMode; label: string }> = WORK_MODES.map(
	(value) => ({ value, label: WORK_MODE_LABELS[value].en })
);

/** A stored value as the vocabulary, or null for anything else. */
export function asWorkMode(value: unknown): WorkMode | null {
	return typeof value === 'string' && (WORK_MODES as readonly string[]).includes(value)
		? (value as WorkMode)
		: null;
}

/** The mode on its own, "Remote", in the render locale. */
export function workModeLabel(mode: WorkMode, locale?: string | null): string {
	const entry = WORK_MODE_LABELS[mode];
	return entry[locale ?? 'en'] ?? entry.en;
}

/** The parts of a role that say where it was done. */
export interface RoleWhere {
	/** The employer, which a remote role's lead line names. */
	name?: string | null;
	location?: string | null;
	work_mode?: string | null;
}

/**
 * Where a role was done, for a header or a meta line: "Austin, US (remote)",
 * or "Remote" for a role with no place.
 *
 * In brackets, the way a CV usually writes it and the way a position already
 * carries "(contract)". Not a middot, which a document has no other use for,
 * and not a dash, which the default layout's header already spends on the
 * date range two parts later.
 *
 * On-site adds nothing. A place on its own already says the work was done
 * there, and printing "On-site" beside every office job is noise the reader
 * has to skip.
 */
export function rolePlace(role: RoleWhere, locale?: string | null): string {
	const mode = asWorkMode(role.work_mode);
	const label = mode && mode !== 'onsite' ? workModeLabel(mode, locale) : '';
	const location = (role.location ?? '').trim();
	if (!label) return location;
	return location ? `${location} (${label.toLowerCase()})` : label;
}

/**
 * A role's headline with where it was done, for a template that prints the
 * place inside the sentence (Citrus: `rules.appendLocationToHeadline`).
 *
 * The place lands after whatever the headline ended on, so a bare " in " ties
 * it to the last noun: "…reviewed by senior engineers in Austin" puts the
 * engineers in Austin. That is harmless for an office job, where the work and
 * the place are the same thing. For a remote role they are not, so the line
 * names the employer the place belongs to: "…, remote for Acme in Austin, US."
 * A hybrid role keeps the plain form and says so after the place.
 */
export function headlineWithPlace(
	headline: string,
	role: RoleWhere,
	locale?: string | null
): string {
	// The headline is stored without its full stop, but one typed anyway would
	// otherwise print as "…engineers. in Austin."
	const base = headline.trim().replace(/\.$/, '');
	if (!base) return '';
	const location = (role.location ?? '').trim();
	const at = location ? ` ${templateLabel('inPlace', locale)} ${location}` : '';
	const mode = asWorkMode(role.work_mode);
	const employer = (role.name ?? '').trim();
	if (mode === 'remote' && employer) {
		const remote = workModeLabel(mode, locale).toLowerCase();
		return `${base}, ${remote} ${templateLabel('forEmployer', locale)} ${employer}${at}.`;
	}
	if (mode === 'remote' || mode === 'hybrid') {
		return `${base}${at} (${workModeLabel(mode, locale).toLowerCase()}).`;
	}
	return `${base}${at}.`;
}
