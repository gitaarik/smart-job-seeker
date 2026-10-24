/**
 * `edit_profile` — the texts on the profile row itself: title, subtitle,
 * headline, summary and About Me.
 *
 * ## Why this is hand-written
 *
 * The same reason as `edit_match_config`. `PROFILE_CAPABILITIES` generates
 * verbs over sections, lists of rows a profile owns, and these are columns on
 * the profile row. There is one row and it always exists, so edit is the only
 * verb that means anything: add, hide, show, reorder and tag have nothing to
 * act on, and "which row" has one answer. That makes it a singleton, like the
 * match config.
 *
 * Which columns, and why not the rest of the row, is `profile/basic-info.ts`.
 *
 * ## Translations
 *
 * The page translates all five, so this carries a twin per column per language
 * (`profile.summary.nl`) exactly as a section's edit verb does, through the same
 * helpers: `section-translations.ts` takes the profile row as an owner beside
 * the sections. The tiering, the before-image and the undo then hold for the
 * Dutch as they do for the English, and MCP's stale-translation warning fires
 * when an agent rewrites the English and leaves the Dutch behind — which is how
 * the Dutch summary of the profile this was built against came to lack the "AI"
 * its English had.
 */

import type { FieldKind } from '$lib/server/utils/field-kinds';
import { TRANSLATION_LOCALES } from '$lib/resume-translations';
import {
	BASIC_INFO_COLUMNS,
	basicInfoError,
	isBasicInfoColumn,
	PROFILE_ROW,
	readBasicInfo,
	writeBasicInfo,
	type BasicInfoColumn
} from '$lib/server/profile/basic-info';
import {
	LANGUAGES_KEY,
	languagesOf,
	parseTranslationField,
	readTranslations,
	translatableColumns,
	translatedLocales,
	translationField,
	translationRefusal,
	translationsIn,
	writeTranslations
} from '$lib/server/profile/section-translations';
import type { CapabilityDef, CapabilityTarget } from './capabilities';

export type BasicInfoCapability = 'edit_profile';

export const BASIC_INFO_CAPABILITY_NAMES: BasicInfoCapability[] = ['edit_profile'];

export function isBasicInfoCapability(capability: string): capability is BasicInfoCapability {
	return (BASIC_INFO_CAPABILITY_NAMES as string[]).includes(capability);
}

/** What the card and the prompt call the row, as the profile navigation names its page. */
const LABEL = 'your Basic Info';

/** `summary` on the wire: `profile.summary`, the way every section prefixes its fields. */
function wireName(column: BasicInfoColumn): string {
	return `${PROFILE_ROW}.${column}`;
}

/** The column a wire name writes, or null for a translation or anything else. */
function columnOf(field: string): BasicInfoColumn | null {
	if (!field.startsWith(`${PROFILE_ROW}.`)) return null;
	const column = field.slice(PROFILE_ROW.length + 1);
	return isBasicInfoColumn(column) ? column : null;
}

/** The English half of a change, by column. */
function columnsOf(fields: Record<string, unknown>): Partial<Record<BasicInfoColumn, unknown>> {
	const columns: Partial<Record<BasicInfoColumn, unknown>> = {};
	for (const [field, value] of Object.entries(fields)) {
		const column = columnOf(field);
		if (column) columns[column] = value;
	}
	return columns;
}

/**
 * Each column followed by its translations, in that order, because the card and
 * the history list a change in the order of this map: a rewritten summary and
 * its Dutch then read as the pair they are.
 */
const FIELDS: Record<string, FieldKind> = Object.fromEntries(
	BASIC_INFO_COLUMNS.flatMap((column) => [
		[wireName(column), 'string'],
		...(translatableColumns(PROFILE_ROW).includes(column)
			? TRANSLATION_LOCALES.map((locale) => [
					translationField(PROFILE_ROW, column, locale),
					'string'
				])
			: [])
	])
);

/**
 * The current values, shown whole.
 *
 * Not the "shown in full in their profile above" a section's long value gets:
 * the profile block is built from a snapshot that is refreshed lazily, and on
 * this page the row is the subject. A model asked to rewrite the summary should
 * be looking at the summary as it stands, not as it stood when the snapshot was
 * taken. Five fields, and the page offers nothing else that competes for the
 * budget.
 */
function renderState(current: Record<string, unknown>): string {
	const lines = Object.entries(current)
		.filter(([field]) => field !== LANGUAGES_KEY)
		.map(([field, value]) =>
			value === null || value === undefined || value === ''
				? `  - ${field}: (not set)`
				: `  - ${field}: ${String(value)}`
		);
	return `Current values:\n\n${lines.join('\n')}`;
}

const editProfile: CapabilityDef = {
	title: 'Change the title, subtitle, headline, summary or About Me',
	singleton: true,

	/** The actor's own profile, whatever page this is. There is nothing else it could be. */
	resolve: async (_entity, actor): Promise<CapabilityTarget | null> => ({
		id: actor.profileId,
		label: LABEL
	}),

	/**
	 * Re-asked at apply time like every other capability's. The target carries
	 * the profile's own id, so a proposal made on one profile and applied after
	 * switching to another names a profile that is not the actor's.
	 */
	authorize: async (target, actor) =>
		target.id === actor.profileId && (await readBasicInfo(actor.profileId)) !== null,

	/**
	 * Each column, then its translation in every language the profile has
	 * started — null where none is written, which is what lets one be filled and
	 * makes filling it read as additive to the tiering.
	 */
	current: async (_target, actor) => {
		const [row, languages] = await Promise.all([
			readBasicInfo(actor.profileId),
			translatedLocales(actor.profileId)
		]);
		const held =
			languages.length > 0
				? ((await readTranslations(actor.profileId, PROFILE_ROW, [actor.profileId], languages)).get(
						actor.profileId
					) ?? {})
				: {};
		const translatable = translatableColumns(PROFILE_ROW);

		const values: Record<string, unknown> = {};
		for (const column of BASIC_INFO_COLUMNS) {
			values[wireName(column)] = row?.[column] ?? null;
			if (!translatable.includes(column)) continue;
			for (const locale of languages) {
				const field = translationField(PROFILE_ROW, column, locale);
				values[field] = held[field] ?? null;
			}
		}
		if (languages.length > 0) values[LANGUAGES_KEY] = languages;
		return values;
	},

	fields: FIELDS,

	contract: `These are the texts at the top of their profile, which every CV and export
starts from:

- "profile.title" — their professional title, one line ("Senior Full-Stack
  Engineer").
- "profile.subtitle" — one sentence under the title: their role or specialty.
- "profile.headline" — one sentence on their professional focus.
- "profile.summary" — the paragraph that opens their CV.
- "profile.about_me_text" — "About me": the longer bio, in the first person,
  that they paste into LinkedIn and their own site. No CV prints it.

Each is the default wording. A CV version can print one of their alternative
wordings instead, picked on that version's page in Resumes & CVs
(/profile/resume), so changing a field here changes every version that has not
picked one.

A value replaces the field whole. Rewording, reordering and shortening what
their profile says is the job; a skill, an employer, a figure or a number of
years that is not in their profile does not go in, however well it would read.

Their name, contact details, links and location are on the same page and are
not yours to change. Send them to Basic Info (/profile/edit) for those.`,

	renderState,

	validate: (proposed, current) => {
		const refusal = translationRefusal(PROFILE_ROW, proposed, current, languagesOf(current));
		if (refusal) return { ok: false, error: refusal };

		// Each value against the rule its column is held to on the page, and a
		// translation against its English column's: a title is one line in every
		// language.
		for (const [field, value] of Object.entries(proposed)) {
			if (value === null || value === undefined) continue;
			const column = parseTranslationField(field)?.column ?? columnOf(field);
			if (!column || !isBasicInfoColumn(column)) continue;
			const error = basicInfoError(column, value);
			if (error) return { ok: false, error: `${field}: ${error}` };
		}

		return { ok: true };
	},

	translations: async (_targets, actor) => ({
		languages: await translatedLocales(actor.profileId),
		notes: {}
	}),

	/**
	 * To the actor's profile, never to the target's id, the same as the match
	 * config. The English first, so a write that fails halfway leaves the
	 * translations describing the English that is still there.
	 */
	apply: async (_target, proposed, _current, actor) => {
		await writeBasicInfo(actor.profileId, columnsOf(proposed));
		await writeTranslations(
			actor.profileId,
			PROFILE_ROW,
			actor.profileId,
			translationsIn(PROFILE_ROW, proposed)
		);
	},

	/**
	 * Put the replaced values back, translations included. One that was not there
	 * before has a null before-image, and null removes it, so the Dutch CV goes
	 * back to printing the English there.
	 */
	revert: async (_target, previous, actor) => {
		const columns = columnsOf(previous);
		const translations = translationsIn(PROFILE_ROW, previous);
		if (Object.keys(columns).length === 0 && Object.keys(translations).length === 0) {
			throw new Error('edit_profile recorded no fields this can put back');
		}
		await writeBasicInfo(actor.profileId, columns);
		await writeTranslations(actor.profileId, PROFILE_ROW, actor.profileId, translations);
	}
};

export const BASIC_INFO_CAPABILITIES: Record<BasicInfoCapability, CapabilityDef> = {
	edit_profile: editProfile
};
