/**
 * The fields that can hold alternative wordings, the helpers for reading a set
 * of them, and the rule for which one a document version prints.
 *
 * Everything else a document tailors, it tailors by choosing: an item's `tags`
 * say which documents it belongs on, and a version's overrides say which of
 * those one job prints and in what order. That works because those things are
 * rows, and a row can be left out. The fields here are single columns — there
 * is one summary, one headline, and a role has one position — so nothing about
 * them can be expressed by filtering, and the only way to say something
 * different was to edit the profile before a send and edit it back after.
 *
 * The column keeps being the default. A variant is an alternative TO it, never
 * a replacement for it, which is why picking nothing is always a valid answer
 * and why a profile with no variants renders exactly as it did before.
 *
 * Three questions, each answered in one place:
 *
 * - what a field CAN say is the profile's: its own value, plus the variants
 *   listed under it here;
 * - what one document DOES say is the version's: a pick per field, its own or
 *   the one it inherits from the version it builds on (`resolveWordings`);
 * - how the document LOOKS is the presentation template's, and a template
 *   decides nothing about wording. It did once, for a role's position, as one
 *   forced value per template; what a title should say turned out to depend on
 *   the job, and every document sent in that template shared the one value.
 *
 * Client-safe: pure data + helpers, no DB. The loader lives server-side in
 * server/profile/field-variants.ts.
 */

/** The parts of a profile whose fields can carry alternatives. */
export type VariantEntity = 'profile' | 'work_experience';

const VARIANT_ENTITIES: string[] = ['profile', 'work_experience'] satisfies VariantEntity[];

export function isVariantEntity(value: unknown): value is VariantEntity {
	return typeof value === 'string' && VARIANT_ENTITIES.includes(value);
}

/** A field that may carry alternatives. */
export interface VariantField {
	/**
	 * Which part of the profile holds the field. The strings match the entity
	 * names the translations and the version overrides already use for the same
	 * rows, so a field is called one thing everywhere.
	 */
	entity: VariantEntity;
	/** Column on that entity's table, persisted in profile_field_variants.field. */
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
 * Deliberately short. These are all equally true statements about the same
 * person, so the limit is not honesty but usefulness: an alternative wording is
 * worth having where the emphasis is genuinely a choice.
 *
 * That is what rules out most of the profile. A role's dates and an employer's
 * name are facts, not emphases; a role's achievements are already tailorable by
 * picking which of them print.
 *
 * A role's `position` is here because the same job is honestly called more
 * than one thing — a lead who wrote most of the Python was a Lead Engineer and
 * a Senior Python Engineer — and which of them a document should say depends on
 * who reads it. It is the applicant who writes every alternative, so each one
 * is a title they are prepared to defend.
 *
 * `about_me_text` is the one entry no document prints. It is the long bio a
 * profile SITE wants — a LinkedIn About, a portfolio page — which is prose
 * about the applicant in exactly the sense above, and having two of them (one
 * for a network that shows five lines, one for a page with room) is the same
 * need the others have. What it does not have is a document to be chosen by,
 * so it carries `printed: false` and the version picker and the tailoring run
 * both skip it. Whoever re-enables /p/[slug] should flip that flag.
 *
 * The `entity` and `field` strings are persisted, so renaming one orphans
 * rows. Append-only. A new ENTITY also needs a column on
 * `profile_field_variants` to say which row a variant belongs to (see the
 * table's comment in schema.ts), a walk in `applyFieldVariants`, and a place in
 * the export.
 */
export const VARIANT_FIELDS: VariantField[] = [
	{
		entity: 'profile',
		field: 'title',
		label: 'Professional Title',
		printed: true,
		placeholder: 'e.g., Senior Software Engineer'
	},
	{
		entity: 'profile',
		field: 'subtitle',
		label: 'Subtitle',
		printed: true,
		multiline: true,
		rows: 2,
		placeholder: 'e.g., Full-Stack Developer'
	},
	{
		entity: 'profile',
		field: 'headline',
		label: 'Headline',
		printed: true,
		multiline: true,
		rows: 2,
		placeholder: 'A short tagline about yourself'
	},
	{
		entity: 'profile',
		field: 'summary',
		label: 'Professional Summary',
		printed: true,
		multiline: true,
		rows: 4,
		placeholder: 'Write a brief professional summary...'
	},
	{
		entity: 'profile',
		field: 'about_me_text',
		label: 'About Me',
		printed: false,
		multiline: true,
		rows: 8,
		placeholder: 'The longer bio you use on LinkedIn, a portfolio site, a personal page...'
	},
	{
		entity: 'work_experience',
		field: 'position',
		label: 'Position',
		printed: true,
		placeholder: 'e.g., Senior Software Engineer'
	}
];

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

const fieldKey = (entity: string, field: string) => `${entity}:${field}`;
const BY_FIELD = new Map(VARIANT_FIELDS.map((f) => [fieldKey(f.entity, f.field), f]));

/** The fields of one part of the profile, in editor order. */
export function variantFieldsFor(entity: VariantEntity): VariantField[] {
	return VARIANT_FIELDS.filter((f) => f.entity === entity);
}

export function variantField(entity: string, field: string): VariantField | undefined {
	return BY_FIELD.get(fieldKey(entity, field));
}

export function isVariantField(entity: unknown, field: unknown): boolean {
	return typeof entity === 'string' && typeof field === 'string' && !!variantField(entity, field);
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
export function isPrintedVariantField(entity: unknown, field: unknown): boolean {
	return (
		typeof entity === 'string' &&
		typeof field === 'string' &&
		(variantField(entity, field)?.printed ?? false)
	);
}

/** The field's label, falling back to the raw name so an unknown row still says what it is. */
export function variantFieldLabel(entity: string, field: string): string {
	return variantField(entity, field)?.label ?? field;
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

/**
 * One field of one item: what a set of variants are alternatives for, and what
 * a version picks one wording for.
 *
 * `entityId` is the profile's own id for a field of the profile, so every
 * target has the same three parts and one key — the alternative was a null id
 * that every lookup would have had to special-case.
 */
export interface VariantTarget {
	entity: VariantEntity;
	entityId: number;
	field: string;
}

/** Lookup key for one target, shared by the resolver, the pickers and the tailoring run. */
export function variantTargetKey(entity: string, entityId: number, field: string): string {
	return `${entity}:${entityId}:${field}`;
}

/** One variant, as everything outside the table reads it. */
export interface FieldVariant {
	id: number;
	/** Which part of the profile its field is on. */
	entity: VariantEntity;
	/** The row it belongs to: the profile's id, or a role's. */
	entity_id: number;
	field: string;
	label: string;
	value: string;
	/** When to use it, in the applicant's words. What the tailoring run matches. */
	note?: string | null;
	sort?: number | null;
}

/**
 * A variant as the table holds it, and as the loaded profile tree carries it.
 *
 * The table says which row a variant belongs to with one nullable column per
 * kind of item, because those are real foreign keys (see schema.ts). Everything
 * else wants the answer as an (entity, id) pair, and this is the one place the
 * two are translated.
 */
export interface FieldVariantRow {
	id: number;
	profile_id: number;
	work_experience_id?: number | null;
	field: string;
	label: string;
	value: string;
	note?: string | null;
	sort?: number | null;
}

export function toFieldVariant(row: FieldVariantRow): FieldVariant {
	const onRole = typeof row.work_experience_id === 'number';
	return {
		id: row.id,
		entity: onRole ? 'work_experience' : 'profile',
		entity_id: onRole ? (row.work_experience_id as number) : row.profile_id,
		field: row.field,
		label: row.label,
		value: row.value,
		note: row.note ?? null,
		sort: row.sort ?? null
	};
}

/** The target a variant is an alternative for. */
export function targetKeyOf(variant: Pick<FieldVariant, 'entity' | 'entity_id' | 'field'>): string {
	return variantTargetKey(variant.entity, variant.entity_id, variant.field);
}

const bySort = (a: { sort?: number | null; id: number }, b: { sort?: number | null; id: number }) =>
	(a.sort ?? 0) - (b.sort ?? 0) || a.id - b.id;

/** Group a flat list by target, each group in `sort` order. Targets with no variants have no entry. */
export function groupVariantsByTarget<T extends FieldVariant>(variants: T[]): Map<string, T[]> {
	const grouped = new Map<string, T[]>();
	for (const v of variants) {
		const key = targetKeyOf(v);
		const bucket = grouped.get(key);
		if (bucket) bucket.push(v);
		else grouped.set(key, [v]);
	}
	for (const bucket of grouped.values()) bucket.sort(bySort);
	return grouped;
}

/** One target's variants out of a flat list, in `sort` order. */
export function variantsForTarget<T extends FieldVariant>(
	variants: T[],
	entity: string,
	entityId: number,
	field: string
): T[] {
	return variants
		.filter((v) => v.entity === entity && v.entity_id === entityId && v.field === field)
		.sort(bySort);
}

/**
 * The text a picker shows for a variant when the applicant is choosing between
 * them: the label, and enough of the value to tell two apart at a glance.
 */
export function variantPreview(value: string, chars = 120): string {
	const flat = value.replace(/\s+/g, ' ').trim();
	return flat.length > chars ? `${flat.slice(0, chars).trimEnd()}…` : flat;
}

/**
 * Whether two wordings of a field are the same text, for "is this one already
 * in the list". Case and spacing are not a difference worth a second entry: a
 * title typed again for another job with a capital moved is the same title.
 */
export function sameWording(a: string, b: string): boolean {
	const flat = (s: string) => s.replace(/\s+/g, ' ').trim().toLowerCase();
	return flat(a) === flat(b);
}

/** A version's decision about one variant: the override row, reduced to what the rule reads. */
export interface WordingPickRow {
	/** The override row's id. Later rows are newer. */
	id: number;
	version_id: number;
	/** The variant the row names. */
	entity_id: number;
	/** 'include' picks the variant; 'exclude' says "not this one here". */
	action: string;
	/** 'user' | 'ai'. */
	source?: string | null;
	/** Why, as the row records it. Carried through for the pickers; the rule ignores it. */
	reason?: string | null;
}

/** The wording a version prints for one target, and which decision put it there. */
export interface ResolvedWording<T extends FieldVariant = FieldVariant> {
	variant: T;
	/** The version whose decision this is: the viewed one, or one it builds on. */
	versionId: number;
	rowId: number;
	source: string | null;
	reason: string | null;
}

/**
 * Which wording a version prints for each target that has a pick.
 *
 * `chain` is the version being viewed followed by the versions it builds on,
 * nearest first — the same order the tag filter, the item overrides and a
 * version's skill words are read in (see ProfileDisplay/profile-filter.ts, and
 * `versionChain` in server/profile/skill-words.ts, which builds it). A target
 * with no entry in the result prints the profile's own value.
 *
 * The rule, in the order it is applied:
 *
 * 1. The nearest version to say anything about a VARIANT settles that variant.
 *    A job's version that says "not this one" about a wording its library
 *    version picked takes it back off, exactly as an exclude on an item the
 *    base prints does. That is also how "use my own title here" is written on
 *    a version whose base picks one: there is no row that means "the default",
 *    because the absence of a pick has always meant that.
 * 2. Within one version the applicant's own rows are read before generated
 *    ones, and newer before older. A field holds one value and the unique key
 *    is per variant, so two picks for one target can coexist; the hand-made one
 *    has to win, or a regeneration that picks a different wording for the same
 *    field silently replaces the one the applicant chose.
 * 3. The first pick left standing for a target is the one it prints. So a
 *    version's own pick beats an inherited one, and a version that picks
 *    nothing prints what the version it builds on picked.
 *
 * Rows naming a variant that is not in `variants` are ignored: a pick for a
 * deleted wording, or for another profile's, resolves to nothing rather than to
 * a blank or to somebody else's prose.
 */
export function resolveWordings<T extends FieldVariant>(
	chain: number[],
	rows: WordingPickRow[],
	variants: T[]
): Map<string, ResolvedWording<T>> {
	const byId = new Map(variants.map((v) => [v.id, v]));
	const depth = new Map<number, number>();
	chain.forEach((id, index) => {
		if (!depth.has(id)) depth.set(id, index);
	});

	const ordered = rows
		.filter(
			(r) =>
				depth.has(r.version_id) &&
				byId.has(r.entity_id) &&
				(r.action === 'include' || r.action === 'exclude')
		)
		.sort(
			(a, b) =>
				(depth.get(a.version_id) ?? 0) - (depth.get(b.version_id) ?? 0) ||
				Number(b.source === 'user') - Number(a.source === 'user') ||
				b.id - a.id
		);

	const settled = new Set<number>();
	const picked = new Map<string, ResolvedWording<T>>();
	for (const row of ordered) {
		if (settled.has(row.entity_id)) continue;
		settled.add(row.entity_id);
		if (row.action !== 'include') continue;
		const variant = byId.get(row.entity_id);
		if (!variant) continue;
		const key = targetKeyOf(variant);
		if (!picked.has(key)) {
			picked.set(key, {
				variant,
				versionId: row.version_id,
				rowId: row.id,
				source: row.source ?? null,
				reason: row.reason ?? null
			});
		}
	}
	return picked;
}

/** One alternative as a picker lists it. */
export interface WordingOption {
	id: number;
	label: string;
	value: string;
	note: string | null;
}

/**
 * One target as a picker shows it: what the field can say, and what the version
 * being looked at makes it say.
 */
export interface WordingState {
	/** The target's key (see `variantTargetKey`). */
	key: string;
	entity: VariantEntity;
	entityId: number;
	field: string;
	/** The field's own heading: "Professional Title", "Position". */
	label: string;
	/** Which row it is on, when the label alone does not say: a role's employer. */
	context: string | null;
	multiline: boolean;
	rows: number;
	/** The profile's own value, which prints when nothing is picked. */
	own: string;
	options: WordingOption[];
	/** The variant this version prints, or null for the profile's own value. */
	pickedId: number | null;
	/**
	 * Where that answer comes from: nothing picked anywhere ('own'), a decision
	 * on the version itself ('this'), or a pick made by a version it builds on
	 * ('inherited').
	 */
	from: 'own' | 'this' | 'inherited';
	/** The version an inherited pick comes from, by name. */
	inheritedFrom: string | null;
	/** Who made the decision that stands on this version: nobody, a tailoring run, or the applicant. */
	source: 'base' | 'tailoring' | 'user';
	reason: string | null;
}

/** The text a state's version prints for its target. */
export function wordingText(state: Pick<WordingState, 'own' | 'options' | 'pickedId'>): string {
	return state.options.find((o) => o.id === state.pickedId)?.value ?? state.own;
}

function ownText(value: unknown): string {
	return typeof value === 'string' ? value : '';
}

/**
 * Every printed target of a profile, with what one version says for each.
 *
 * One list for every picker — the version page and the job's document panel —
 * so they cannot disagree about which wording a version prints, and so both
 * read it through `resolveWordings`, the rule the renderer applies.
 *
 * Every printed field is listed, whether or not it has alternatives yet: the
 * job's panel offers "write another one for this job" on a field that has
 * none. A caller that only chooses between existing ones filters on
 * `options.length`.
 *
 * `versionId` null describes the plain, version-less document: nothing is
 * picked and every target says the profile's own value.
 */
export function describeWordings(input: {
	/** The profile row: its id and its own value for each field. */
	profile: { id: number; [field: string]: unknown };
	/** The profile's roles, in the order the document lists them. */
	roles: { id: number; name?: unknown; [field: string]: unknown }[];
	variants: FieldVariant[];
	versionId: number | null;
	/** `versionId` and what it builds on, nearest first (server/profile/skill-words.ts → versionChain). */
	chain: number[];
	/** Every wording decision the chain holds. */
	rows: WordingPickRow[];
	/** Names of the versions in the chain, for "from <the version it builds on>". */
	versionNames?: Map<number, string>;
}): WordingState[] {
	const { profile, roles, variants, versionId, chain, rows } = input;
	const picks = resolveWordings(chain, rows, variants);
	const grouped = groupVariantsByTarget(variants);
	const variantTarget = new Map(variants.map((v) => [v.id, targetKeyOf(v)]));

	const states: WordingState[] = [];
	const add = (spec: VariantField, entityId: number, own: string, context: string | null): void => {
		const key = variantTargetKey(spec.entity, entityId, spec.field);
		const pick = picks.get(key) ?? null;
		const state: WordingState = {
			key,
			entity: spec.entity,
			entityId,
			field: spec.field,
			label: spec.label,
			context,
			multiline: spec.multiline ?? false,
			rows: spec.rows ?? 3,
			own,
			options: (grouped.get(key) ?? []).map((v) => ({
				id: v.id,
				label: v.label,
				value: v.value,
				note: v.note ?? null
			})),
			pickedId: pick?.variant.id ?? null,
			from: !pick ? 'own' : pick.versionId === versionId ? 'this' : 'inherited',
			inheritedFrom:
				pick && pick.versionId !== versionId
					? (input.versionNames?.get(pick.versionId) ?? null)
					: null,
			source: 'base',
			reason: null
		};
		if (pick && pick.versionId === versionId) {
			state.source = pick.source === 'user' ? 'user' : 'tailoring';
			state.reason = pick.reason;
		} else if (!pick && versionId !== null) {
			// Nothing picked, but the version may still have spoken: "not this one
			// here" about a wording, which is how the applicant's own value is
			// chosen over an inherited pick and how a generated pick is taken back.
			const said = rows
				.filter((r) => r.version_id === versionId && variantTarget.get(r.entity_id) === key)
				.sort((a, b) => b.id - a.id)[0];
			if (said) {
				state.source = said.source === 'user' ? 'user' : 'tailoring';
				state.reason = said.reason ?? null;
			}
		}
		states.push(state);
	};

	for (const spec of PRINTED_VARIANT_FIELDS) {
		if (spec.entity === 'profile') add(spec, profile.id, ownText(profile[spec.field]), null);
	}
	for (const role of roles) {
		for (const spec of PRINTED_VARIANT_FIELDS) {
			if (spec.entity !== 'work_experience') continue;
			add(spec, role.id, ownText(role[spec.field]), ownText(role.name) || null);
		}
	}
	return states;
}
