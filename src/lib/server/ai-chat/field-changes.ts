/**
 * How one change reads to the applicant: a field's label, a value as text, and
 * the old and new values side by side.
 *
 * Moved out of `capabilities.ts` so a capability module can describe its own
 * change in the same words without importing the registry that imports it. The
 * delete verbs were the first to need that (see `delete-capabilities.ts`): their
 * card lists the row's values going to nothing, which is exactly what the
 * history shows for a deletion afterwards.
 */

import { localeLabel, TRANSLATION_LOCALES } from '$lib/resume-translations';
import type { ProposedChange } from './capabilities';

const FIELD_LABELS: Record<string, string> = {
	job_poster: 'Recruiter',
	office_location: 'Location',
	source_url: 'Job URL',
	date_posted: 'Date posted',
	work_location: 'Work arrangement',
	job_types: 'Employment type',
	experience_levels: 'Experience level',
	job_description: 'Description',
	skills_required: 'Required skills',
	skills_preferred: 'Preferred skills',
	cv_sent_through: 'Sent through',
	application_sent_date: 'Sent on',
	application_seen_date: 'Seen on',
	status_step: 'Stage',
	interview_rounds: 'Interview rounds',
	new_round: 'New round',
	round_kind: 'Round kind',
	round_date: 'Round date',
	round_time: 'Round time',
	round_with: 'Round with',
	// Not written any more, and kept so the history still names them on the
	// changes made before interview rounds replaced the next action.
	status_action: 'Next action',
	status_action_date: 'Due on',
	status_note: 'Timeline note',
	entry_content: 'Entry',
	entry_type: 'Kind',
	entry_title: 'Title',
	entry_date: 'Happened on',
	// The profile sections. Their wire names carry the section as a prefix, which
	// the card drops — it already names the row above these, so repeating "Work
	// experience" on every line says nothing.
	start_date: 'From',
	end_date: 'Until',
	graduation_year: 'Graduated',
	study_type: 'Qualification',
	repo_url: 'Repository',
	stars: 'GitHub stars',
	project_role: 'Your role',
	language_code: 'Language code',
	author_position: 'Their role',
	author_email: 'Their email',
	author_phone: 'Their phone',
	institution: 'School',
	// The profile row's bio, as its page labels it.
	about_me_text: 'About me'
};

export function labelFor(field: string): string {
	// A translation reads as the field it translates, in its language:
	// `reference.text.nl` is "Text (Dutch)". Asked of the last segment alone,
	// because this also labels a history row's keys, which have lost their
	// section by the time they arrive (`text.nl`).
	const dot = field.lastIndexOf('.');
	const locale = dot > 0 ? field.slice(dot + 1) : '';
	if (TRANSLATION_LOCALES.includes(locale)) {
		return `${labelFor(field.slice(0, dot))} (${localeLabel(locale)})`;
	}

	// `work_experience.summary` labels as "Summary": the section is context the
	// card gets from the row it names, not part of the field's name to a reader.
	const column = field.slice(field.indexOf('.') + 1);
	return FIELD_LABELS[column] ?? column.replace(/_/g, ' ').replace(/^./, (c) => c.toUpperCase());
}

export function renderValue(value: unknown): string {
	if (value === null || value === undefined || value === '') return '—';
	if (Array.isArray(value)) return value.join(', ');
	// A card is read by the applicant, and "Hidden: true" is a programmer's word.
	if (typeof value === 'boolean') return value ? 'yes' : 'no';
	return String(value);
}

/**
 * The same diff over a field list the caller names.
 *
 * For the history entries that are not capabilities and so have no `fields` map
 * to walk — a deletion is the section's own columns, and what it has to show is
 * a value on the left and nothing on the right. Sides are unioned rather than
 * taken from `next`, because that is the case: a deletion writes no fields, and
 * filtering on the ones it wrote would describe it as nothing having happened.
 */
export function describeFieldChanges(
	names: string[],
	next: Record<string, unknown>,
	previous: Record<string, unknown>
): ProposedChange[] {
	return names
		.filter((field) => field in next || field in previous)
		.map((field) => ({
			field,
			label: labelFor(field),
			from: renderValue(previous[field]),
			to: renderValue(next[field])
		}))
		.filter((change) => change.from !== change.to);
}
