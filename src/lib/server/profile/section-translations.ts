/**
 * A section's translations, as the capability registry reads and writes them.
 *
 * English lives in a section's own columns; every other language is a sparse
 * overlay in `profile_translations`, keyed by (entity, id, field, locale) — see
 * `$lib/resume-translations`. The profile pages write that overlay through
 * their own endpoint, beside the column rather than through it, and the
 * assistant and the MCP server could only ever write the column. So every
 * agent edit of a translated field left the Dutch CV saying what the English
 * used to say, and nothing could put it right but a person with the NL tab open.
 *
 * ## One field per language, beside the column it translates
 *
 * `reference.text.nl` next to `reference.text`, in the same capability rather
 * than a `translate_*` verb of its own. A translation is only ever judged
 * against the English it translates, and one proposal carrying both is one card
 * showing both — a separate verb would put the Dutch on a second card, which can
 * be approved while the first is rejected. It also gets everything else for
 * nothing: the tiering (filling an empty translation is additive, replacing one
 * is not), the before-image and the undo are all written in terms of a field's
 * current value, and a translation has one.
 *
 * ## Offered in the languages the profile has started, not in every one
 *
 * A capability's `fields` is declared up front — it is the coercion's
 * allow-list — so it carries a twin per column for every language the app
 * knows. What a model is SHOWN is narrower: the languages this profile already
 * has a translation in, which for most profiles is none and costs them nothing.
 * Writing to any other language is refused rather than offered, because one
 * field of it would add that language to every language picker with the rest of
 * the document still in English.
 */

import { and, eq, inArray } from 'drizzle-orm';
import { dbDirect as db } from '$lib/server/db';
import { profile_translations } from '$lib/server/db/schema';
import { isTranslatable, localeLabel, TRANSLATION_LOCALES } from '$lib/resume-translations';
import { assistantFields, PROFILE_RESOURCES, type ProfileResourceName } from './resources';
import { isEntityOwned } from './translations';
import { touchProfile } from './touch-profile';

/**
 * The languages a profile has started — every one it holds a translation in.
 * Re-exported so a caller that reads and writes translations asks one module.
 */
export { translatedLocales } from './translations';

/**
 * The columns of this section that print in another language too.
 *
 * The overlay's vocabulary decides which, narrowed to what the assistant may
 * write at all: a translation of a column it cannot touch would be a way round
 * `notForAssistant`.
 */
export function translatableColumns(name: ProfileResourceName): string[] {
	const resource = PROFILE_RESOURCES[name];
	const entity = resource.translationEntity;
	if (!entity) return [];
	return Object.keys(assistantFields(resource)).filter((column) => isTranslatable(entity, column));
}

/** `reference.text` in Dutch: `reference.text.nl`. */
export function translationField(
	name: ProfileResourceName,
	column: string,
	locale: string
): string {
	return `${name}.${column}.${locale}`;
}

/** What one translation field is the translation of. */
export interface TranslationField {
	section: ProfileResourceName;
	column: string;
	locale: string;
	/** The English field it translates, named the way a capability names it. */
	base: string;
}

/**
 * What a field name translates, or null when it is not a translation.
 *
 * Strict: the last segment has to be a language, and the rest a section and a
 * column that section translates. Every capability's field names pass through
 * here — a job's, a directive's — and a lenient reading would take a field that
 * merely ends in two letters for a language.
 */
export function parseTranslationField(field: string): TranslationField | null {
	const parts = field.split('.');
	if (parts.length !== 3) return null;

	const [section, column, locale] = parts;
	if (!TRANSLATION_LOCALES.includes(locale) || !(section in PROFILE_RESOURCES)) return null;

	const name = section as ProfileResourceName;
	if (!translatableColumns(name).includes(column)) return null;

	return { section: name, column, locale, base: `${name}.${column}` };
}

/** Every translation field this section has, in every language, for a capability's `fields`. */
export function translationFieldKinds(name: ProfileResourceName): Record<string, 'string'> {
	return Object.fromEntries(
		translatableColumns(name).flatMap((column) =>
			TRANSLATION_LOCALES.map((locale) => [translationField(name, column, locale), 'string'])
		)
	);
}

/**
 * Whether a field is offered to someone writing in these languages.
 *
 * True for every field that is not a translation, so a caller can filter a
 * capability's whole field list with it.
 */
export function isOfferedField(field: string, languages: string[]): boolean {
	const translation = parseTranslationField(field);
	return !translation || languages.includes(translation.locale);
}

/** The translation fields in a change that belong to this section, and nothing else. */
export function translationsIn(
	name: ProfileResourceName,
	fields: Record<string, unknown>
): Record<string, unknown> {
	return Object.fromEntries(
		Object.entries(fields).filter(([field]) => parseTranslationField(field)?.section === name)
	);
}

/**
 * Where a capability's `current` carries the languages its row may be
 * translated into — beside the values rather than among them, for the reason
 * `parents` rides there: `validate` is synchronous and has no database, and a
 * language the profile has not started is refused there.
 */
export const LANGUAGES_KEY = 'translationLocales';

/** The languages `current` says its row may be translated into. */
export function languagesOf(current: Record<string, unknown> | null | undefined): string[] {
	const languages = current?.[LANGUAGES_KEY];
	return Array.isArray(languages) ? (languages as string[]) : [];
}

/** "Dutch and German". */
export function languageList(languages: string[]): string {
	const names = languages.map(localeLabel);
	return names.length > 1 ? `${names.slice(0, -1).join(', ')} and ${names.at(-1)}` : names.join('');
}

/**
 * The translations some of a section's rows have, keyed the way a capability
 * names them: row id -> `{ "reference.text.nl": "…" }`.
 *
 * Only what exists. A row with no Dutch has no key for it, and the caller
 * decides what that means — null among a row's current values, nothing at all
 * in a list's notes.
 */
export async function readTranslations(
	profileId: number,
	name: ProfileResourceName,
	ids: number[],
	languages: string[]
): Promise<Map<number, Record<string, string>>> {
	const entity = PROFILE_RESOURCES[name].translationEntity;
	const columns = translatableColumns(name);
	const found = new Map<number, Record<string, string>>();
	if (!entity || columns.length === 0 || ids.length === 0 || languages.length === 0) return found;

	const rows = await db
		.select({
			id: profile_translations.entity_id,
			field: profile_translations.field,
			locale: profile_translations.locale,
			value: profile_translations.value
		})
		.from(profile_translations)
		.where(
			and(
				eq(profile_translations.profile_id, profileId),
				eq(profile_translations.entity_type, entity),
				inArray(profile_translations.entity_id, ids),
				inArray(profile_translations.field, columns),
				inArray(profile_translations.locale, languages)
			)
		);

	for (const row of rows) {
		const values = found.get(row.id) ?? {};
		values[translationField(name, row.field, row.locale)] = row.value;
		found.set(row.id, values);
	}
	return found;
}

/**
 * Write some of one row's translations: a string sets one, and null or an
 * empty string removes it, so the English prints there instead.
 *
 * Ownership is asked here as well as by the capability's `authorize`, for the
 * reason `toColumns` repeats its allow-list: this is the call that writes, and a
 * write that is safe only because of what its caller checked is one refactor
 * away from not being.
 *
 * `stamp` pins both timestamps, for the one caller that has to recognise its
 * own rows later. An add stamps the translations it writes with the new row's
 * `date_created`, which is how undoing that add tells them apart from a
 * translation somebody wrote since — see `translatedSince`.
 */
export async function writeTranslations(
	profileId: number,
	name: ProfileResourceName,
	id: number,
	values: Record<string, unknown>,
	opts: { stamp?: Date } = {}
): Promise<void> {
	const entity = PROFILE_RESOURCES[name].translationEntity;
	const writes = Object.entries(translationsIn(name, values));
	if (!entity || writes.length === 0) return;

	if (!(await isEntityOwned(entity, id, profileId))) {
		throw new Error(`There is no ${PROFILE_RESOURCES[name].label} ${id} on this profile.`);
	}

	const now = opts.stamp ?? new Date();
	for (const [field, value] of writes) {
		const { column, locale } = parseTranslationField(field) as TranslationField;
		const text = typeof value === 'string' ? value.trim() : '';

		if (text) {
			await db
				.insert(profile_translations)
				.values({
					profile_id: profileId,
					entity_type: entity,
					entity_id: id,
					field: column,
					locale,
					value: text,
					date_created: now,
					date_updated: now
				})
				.onConflictDoUpdate({
					target: [
						profile_translations.profile_id,
						profile_translations.entity_type,
						profile_translations.entity_id,
						profile_translations.field,
						profile_translations.locale
					],
					set: { value: text, date_updated: now }
				});
		} else {
			await db
				.delete(profile_translations)
				.where(
					and(
						eq(profile_translations.profile_id, profileId),
						eq(profile_translations.entity_type, entity),
						eq(profile_translations.entity_id, id),
						eq(profile_translations.field, column),
						eq(profile_translations.locale, locale)
					)
				);
		}
	}

	await touchProfile(profileId);
}

/**
 * Whether anything but the add that made this row has written one of its
 * translations: a translation stamped at any other moment than `created`.
 *
 * Asked before an add is undone, for the reason its `revert` asks the row about
 * `date_updated`. A Dutch line written by hand afterwards is work done to the
 * entry, and deleting the entry would take it along.
 */
export async function translatedSince(
	profileId: number,
	name: ProfileResourceName,
	id: number,
	created: Date
): Promise<boolean> {
	const entity = PROFILE_RESOURCES[name].translationEntity;
	if (!entity) return false;

	const rows = await db
		.select({
			created: profile_translations.date_created,
			updated: profile_translations.date_updated
		})
		.from(profile_translations)
		.where(
			and(
				eq(profile_translations.profile_id, profileId),
				eq(profile_translations.entity_type, entity),
				eq(profile_translations.entity_id, id)
			)
		);

	return rows.some(
		(row) =>
			row.created?.getTime() !== created.getTime() || row.updated?.getTime() !== created.getTime()
	);
}

/**
 * Remove every translation of one row, in every language.
 *
 * For a row that is going away. The overlay has no foreign key to the row it
 * translates — one table serves eleven kinds of row — so nothing else would.
 */
export async function deleteRowTranslations(
	profileId: number,
	name: ProfileResourceName,
	id: number
): Promise<void> {
	const entity = PROFILE_RESOURCES[name].translationEntity;
	if (!entity) return;

	await db
		.delete(profile_translations)
		.where(
			and(
				eq(profile_translations.profile_id, profileId),
				eq(profile_translations.entity_type, entity),
				eq(profile_translations.entity_id, id)
			)
		);
}

function isBlank(value: unknown): boolean {
	return value === null || value === undefined || (typeof value === 'string' && !value.trim());
}

/**
 * Why a change's translation fields cannot be written, or null when they can.
 *
 * Three refusals, each for a document that would otherwise disagree with itself:
 *
 *  - **A language they have not started.** One field of it adds the language
 *    to every picker, with the rest of the CV in English.
 *  - **A translation of nothing.** Dutch for an English field that is empty,
 *    and stays empty, prints on the Dutch CV only.
 *  - **Clearing the English under a translation.** The Dutch goes on printing
 *    what the English no longer says. Clearing both, in one change, is fine.
 *
 * `current` is the row's values, translations included, for an edit, and has
 * no values for an add — whose English has to come in the same change.
 * `languages` is what the profile has started. Pure, so both the chat and MCP
 * refuse the same things in the same words.
 */
export function translationRefusal(
	name: ProfileResourceName,
	proposed: Record<string, unknown>,
	current: Record<string, unknown>,
	languages: string[]
): string | null {
	for (const [field, value] of Object.entries(translationsIn(name, proposed))) {
		const { base, locale } = parseTranslationField(field) as TranslationField;

		if (!languages.includes(locale)) {
			return (
				`"${field}" is in ${localeLabel(locale)}, and their CV has no ${localeLabel(locale)} ` +
				`version to add it to` +
				(languages.length > 0 ? ` (it exists in ${languageList(languages)} only)` : '') +
				`. They start a language themselves, with "AI translation" on /profile/edit or ` +
				`a field's language tab`
			);
		}

		const english = base in proposed ? proposed[base] : current[base];
		if (!isBlank(value) && isBlank(english)) {
			return (
				`"${field}" translates "${base}", which is empty. Send the English as well, ` +
				`or leave the translation out`
			);
		}
	}

	for (const [field, value] of Object.entries(current)) {
		const translation = parseTranslationField(field);
		if (!translation || translation.section !== name || isBlank(value)) continue;
		if (!(translation.base in proposed) || !isBlank(proposed[translation.base])) continue;
		if (field in proposed && isBlank(proposed[field])) continue;

		return (
			`Clearing "${translation.base}" would leave its ${localeLabel(translation.locale)} ` +
			`version printing on their ${localeLabel(translation.locale)} CV. Clear "${field}" ` +
			`too, with null, or keep the English`
		);
	}

	return null;
}

/**
 * The translations a change leaves describing the English it replaced.
 *
 * A field it rewrites whose translation exists and is neither rewritten nor
 * cleared by the same change. Not a refusal: rewording the English without the
 * Dutch is sometimes what was asked for, and the agent may be about to send the
 * Dutch next. But it is the one thing an agent cannot see from the result of
 * its own write, and the reason the Dutch CV used to go stale.
 */
export function staleTranslations(
	fields: Record<string, unknown>,
	current: Record<string, unknown>
): string[] {
	return Object.keys(current).filter((field) => {
		const translation = parseTranslationField(field);
		if (!translation || isBlank(current[field]) || field in fields) return false;
		if (!(translation.base in fields) || isBlank(fields[translation.base])) return false;
		return fields[translation.base] !== current[translation.base];
	});
}
