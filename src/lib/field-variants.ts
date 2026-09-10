/**
 * The profile fields that can hold alternative wordings, and the helpers for
 * reading a set of them.
 *
 * Everything else a document tailors, it tailors by choosing: an item's `tags`
 * say which documents it belongs on, and a version's overrides say which of
 * those one job prints and in what order. That works because those things are
 * rows, and a row can be left out. The four fields here are columns on
 * `profiles` — there is one summary, one headline — so nothing about them can
 * be expressed by filtering, and the only way to say something different was to
 * edit the profile before a send and edit it back after.
 *
 * The column keeps being the default. A variant is an alternative TO it, never
 * a replacement for it, which is why picking nothing is always a valid answer
 * and why a profile with no variants renders exactly as it did before.
 *
 * Client-safe: pure data + helpers, no DB. The resolver lives server-side in
 * server/profile/field-variants.ts.
 */

/** A profile field that may carry alternatives. */
export interface VariantField {
	/** Column on `profiles`, persisted in profile_field_variants.field. */
	field: string;
	/** Human label, matching the profile editor's own heading for the field. */
	label: string;
	/**
	 * Whether a resume or CV prints this field.
	 *
	 * The library is one thing and picking from it is another. Every field here
	 * gets the editor control, because writing down two wordings is useful
	 * wherever the prose is; only a printed field gets the version picker and a
	 * tailoring decision, because those choose which wording a DOCUMENT uses and
	 * there is nothing to choose for a field no document renders.
	 *
	 * Required rather than defaulted: the wrong answer is silent either way (a
	 * picker over a field that never prints, or a printed field the tailoring run
	 * skips), so the next field added has to say which it is.
	 */
	printed: boolean;
	/** Rendered as a textarea, and how tall. */
	multiline?: boolean;
	rows?: number;
	placeholder?: string;
}

/**
 * Every field that may have variants, in editor order.
 *
 * Deliberately short, and short for a different reason than
 * OVERRIDABLE_FIELDS is. A template override exists to let a document disagree
 * with the profile, so each entry is a claim someone has to defend. These are
 * all equally true statements about the same person, so the limit is not
 * honesty but usefulness: an alternative wording is worth having where the
 * field is prose ABOUT the applicant and the emphasis is genuinely a choice.
 *
 * That is what rules out the rest of the profile. A role's dates, an
 * employer's name and a skill's spelling are facts, not emphases; a role's
 * achievements are already tailorable by picking which of them print.
 *
 * `about_me_text` is the one entry no document prints. It is the long bio a
 * profile SITE wants — a LinkedIn About, a portfolio page — which is prose
 * about the applicant in exactly the sense above, and having two of them (one
 * for a network that shows five lines, one for a page with room) is the same
 * need the other four have. What it does not have is a document to be chosen
 * by, so it carries `printed: false` and the version picker and the tailoring
 * run both skip it. Whoever re-enables /p/[slug] should flip that flag.
 *
 * The `field` strings are persisted, so renaming one orphans rows. Append-only.
 */
export const VARIANT_FIELDS: VariantField[] = [
	{
		field: 'title',
		label: 'Professional Title',
		printed: true,
		placeholder: 'e.g., Senior Software Engineer'
	},
	{
		field: 'subtitle',
		label: 'Subtitle',
		printed: true,
		multiline: true,
		rows: 2,
		placeholder: 'e.g., Full-Stack Developer'
	},
	{
		field: 'headline',
		label: 'Headline',
		printed: true,
		multiline: true,
		rows: 2,
		placeholder: 'A short tagline about yourself'
	},
	{
		field: 'summary',
		label: 'Professional Summary',
		printed: true,
		multiline: true,
		rows: 4,
		placeholder: 'Write a brief professional summary...'
	},
	{
		field: 'about_me_text',
		label: 'About Me',
		printed: false,
		multiline: true,
		rows: 8,
		placeholder: 'The longer bio you use on LinkedIn, a portfolio site, a personal page...'
	}
];

/** Field names only, in editor order. */
export const VARIANT_FIELD_NAMES: string[] = VARIANT_FIELDS.map((f) => f.field);

/**
 * The subset a document version can pick a wording for.
 *
 * Every version-scoped consumer reads this rather than VARIANT_FIELDS: the
 * picker on a resume version, and the tailoring run that scores one wording
 * against another. Both are answering "which of these does this document say",
 * and a field no document says has no answer to give — offering one would put a
 * dead control in the version editor and spend an embedding per run on prose
 * that never reaches the page.
 */
export const PRINTED_VARIANT_FIELDS: VariantField[] = VARIANT_FIELDS.filter((f) => f.printed);

const BY_FIELD = new Map(VARIANT_FIELDS.map((f) => [f.field, f]));

export function isVariantField(field: unknown): field is string {
	return typeof field === 'string' && BY_FIELD.has(field);
}

/**
 * Whether a document version may pick a wording for this field.
 *
 * Narrower than `isVariantField` on purpose. Storing an alternative is allowed
 * for every field in the vocabulary; choosing one on behalf of a resume is
 * allowed only where a resume renders it, because a pick for a field nothing
 * prints resolves to nothing at render time — which is the failure the pick
 * endpoint's own id checks exist to prevent, arriving by a different route.
 */
export function isPrintedVariantField(field: unknown): field is string {
	return typeof field === 'string' && (BY_FIELD.get(field)?.printed ?? false);
}

export function variantField(field: string): VariantField | undefined {
	return BY_FIELD.get(field);
}

/** The field's label, falling back to the raw name so an unknown row still says what it is. */
export function variantFieldLabel(field: string): string {
	return BY_FIELD.get(field)?.label ?? field;
}

/**
 * Entity type these rows are named by elsewhere — in
 * `profile_version_overrides.entity_type` when a version picks one, and in
 * `profile_translations.entity_type` when one is translated.
 *
 * Duplicated as a literal in $lib/version-overrides.ts and
 * $lib/resume-translations.ts rather than imported from here, because those two
 * are vocabulary lists whose whole point is that every entry is readable in
 * place. Changing it means changing all three, which is why it is written down
 * in each of them.
 */
export const FIELD_VARIANT_ENTITY = 'profile_field_variant';

/** The translated (or not) column on a variant row. One field, so it has a name. */
export const FIELD_VARIANT_VALUE = 'value';

/** One variant, shaped after the DB row but usable before it is saved. */
export interface FieldVariant {
	id: number;
	field: string;
	label: string;
	value: string;
	/** When to use it, in the applicant's words. What the tailoring run matches. */
	note?: string | null;
	sort?: number | null;
}

/** Group a flat list by field, in VARIANT_FIELDS order, each in `sort` order. */
export function groupVariantsByField<T extends { field: string; sort?: number | null; id: number }>(
	variants: T[]
): Map<string, T[]> {
	const grouped = new Map<string, T[]>();
	for (const f of VARIANT_FIELDS) grouped.set(f.field, []);
	for (const v of variants) {
		const bucket = grouped.get(v.field);
		if (bucket) bucket.push(v);
	}
	for (const bucket of grouped.values()) {
		bucket.sort((a, b) => (a.sort ?? 0) - (b.sort ?? 0) || a.id - b.id);
	}
	return grouped;
}

/**
 * The text a picker shows for a variant when the applicant is choosing between
 * them: the label, and enough of the value to tell two apart at a glance.
 */
export function variantPreview(value: string, chars = 120): string {
	const flat = value.replace(/\s+/g, ' ').trim();
	return flat.length > chars ? `${flat.slice(0, chars).trimEnd()}…` : flat;
}
