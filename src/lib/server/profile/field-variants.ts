/**
 * Server-side resolver + tree applier for alternative field wordings.
 *
 * `loadFieldVariants` bulk-loads the variants one version picked (one query for
 * the picks, one for the rows; no version means no DB hit at all), and
 * `applyFieldVariants` overwrites the four scalar fields on a loaded profile
 * tree in place — the same trick applyTranslations and applyTemplateOverrides
 * use, so no renderer needs to know this exists.
 *
 * ORDER. Three overlays now write to the same fields, and the order is a rule
 * rather than a preference:
 *
 *     applyTranslations  →  applyFieldVariants  →  applyTemplateOverrides
 *
 * Translations first because they are the language of the DEFAULT value; a
 * variant that replaces it must therefore replace the translated text too, and
 * carry its own translation to stay in-language — which is why the variant's
 * `value` is itself a translatable field keyed on the variant's id (see
 * resume-translations.ts) rather than on `profile.summary`. Reusing the field's
 * key would mean the Dutch document silently printed the default summary while
 * the English one printed the variant, and nothing would report it.
 *
 * Template overrides last, unchanged, because an override is a force: "on
 * Citrus this says Senior Engineer" has to win over both the applicant's
 * choice of wording and the translation of whatever it replaces. In practice
 * the two vocabularies do not yet overlap — overrides reach one role field,
 * variants reach four profile fields — but they are both open lists, and the
 * order is what decides the day they meet.
 *
 * See $lib/field-variants.ts for the field vocabulary.
 */

import { dbDirect as db } from '$lib/server/db';
import { and, asc, desc, eq, inArray } from 'drizzle-orm';
import { profile_field_variants, profile_version_overrides } from '$lib/server/db/schema';
import {
	FIELD_VARIANT_ENTITY,
	FIELD_VARIANT_VALUE,
	VARIANT_FIELDS,
	type FieldVariant
} from '$lib/field-variants';
import { OVERRIDE_ENTITIES } from '$lib/version-overrides';
import type { Translator } from '$lib/server/profile/translations';

export interface FieldVariants {
	/** The version these picks belong to, or null when nothing is picked. */
	versionId: number | null;
	/** Nothing to apply; the applier short-circuits. */
	isEmpty: boolean;
	/** The picked wording for `field`, or `base` when the default stands. */
	value: (field: string, base: string | null) => string | null;
	/** Which variant won each field, for the review diff. */
	picked: Map<string, FieldVariant>;
}

/** No version, or a version that picks nothing. */
export const NO_FIELD_VARIANTS: FieldVariants = {
	versionId: null,
	isEmpty: true,
	value: (_field, base) => base,
	picked: new Map()
};

/** Every variant a profile holds, in editor order. */
export async function listFieldVariants(profileId: number): Promise<FieldVariant[]> {
	const rows = await db
		.select({
			id: profile_field_variants.id,
			field: profile_field_variants.field,
			label: profile_field_variants.label,
			value: profile_field_variants.value,
			note: profile_field_variants.note,
			sort: profile_field_variants.sort
		})
		.from(profile_field_variants)
		.where(eq(profile_field_variants.profile_id, profileId))
		.orderBy(asc(profile_field_variants.sort), asc(profile_field_variants.id));
	return rows;
}

/**
 * The variant ids one version picked, NEWEST FIRST.
 *
 * The order is the tie-break for the rule the schema cannot state: a field
 * holds one value, so only one of its variants may be included, and the unique
 * key is per entity id rather than per field. The pick endpoint clears a
 * field's other picks before writing one, but it is not the only writer — the
 * generic item toggle on the application's document panel takes an entity type
 * and an id from a form, and `profile_field_variant` is a valid one there.
 *
 * Newest wins, because every writer that adds an include means "use this one",
 * and the most recent statement of that is the one the applicant just made.
 * Oldest-wins would make turning on a second wording appear to do nothing.
 */
export async function pickedVariantIds(versionId: number): Promise<number[]> {
	const rows = await db
		.select({ entity_id: profile_version_overrides.entity_id })
		.from(profile_version_overrides)
		.where(
			and(
				eq(profile_version_overrides.version_id, versionId),
				eq(profile_version_overrides.entity_type, OVERRIDE_ENTITIES.fieldVariant),
				eq(profile_version_overrides.action, 'include')
			)
		)
		.orderBy(desc(profile_version_overrides.id));
	return rows.map((r) => r.entity_id);
}

/**
 * Load one version's picked wordings into an in-memory resolver.
 *
 * `profileId` is not decoration: the picks are ids supplied by whatever wrote
 * the override rows, so the variant query is scoped to the profile as well.
 * A row naming another profile's variant resolves to nothing rather than to
 * that profile's prose.
 *
 * A translator is taken rather than a locale because the caller has already
 * built one, and because a variant's translation is looked up by the variant's
 * own id — a second resolver would have to re-query for the same locale.
 */
export async function loadFieldVariants(
	profileId: number,
	versionId: number | null | undefined,
	translator?: Translator
): Promise<FieldVariants> {
	if (!versionId) return NO_FIELD_VARIANTS;

	const ids = await pickedVariantIds(versionId);
	if (ids.length === 0) return NO_FIELD_VARIANTS;

	const rows = await db
		.select({
			id: profile_field_variants.id,
			field: profile_field_variants.field,
			label: profile_field_variants.label,
			value: profile_field_variants.value,
			note: profile_field_variants.note,
			sort: profile_field_variants.sort
		})
		.from(profile_field_variants)
		.where(
			and(eq(profile_field_variants.profile_id, profileId), inArray(profile_field_variants.id, ids))
		);
	if (rows.length === 0) return NO_FIELD_VARIANTS;

	// One pick per field: `ids` is newest-first, so the first row for a field is
	// the most recent thing anyone said about it. See pickedVariantIds.
	const byId = new Map(rows.map((r) => [r.id, r]));
	const picked = new Map<string, FieldVariant>();
	for (const id of ids) {
		const row = byId.get(id);
		if (row && !picked.has(row.field)) picked.set(row.field, row);
	}
	if (picked.size === 0) return NO_FIELD_VARIANTS;

	return {
		versionId,
		isEmpty: false,
		value: (field, base) => {
			const variant = picked.get(field);
			if (!variant) return base;
			// The variant's own translation, not the field's — the field's is the
			// translation of the default this is replacing.
			return (
				translator?.t(FIELD_VARIANT_ENTITY, variant.id, FIELD_VARIANT_VALUE, variant.value) ??
				variant.value
			);
		},
		picked
	};
}

/**
 * Apply a version's picked wordings to a loaded profile tree, mutating it in
 * place. Driven by the vocabulary, so adding a field to VARIANT_FIELDS is the
 * whole change here.
 */
export function applyFieldVariants<T>(profile: T, variants: FieldVariants): T {
	if (variants.isEmpty || !profile) return profile;

	// Generic in the tree it is handed so call sites keep their own profile
	// type, the same shape applyTemplateOverrides uses. One cast here, none at
	// the routes that call it.
	const tree = profile as Record<string, unknown>;
	for (const f of VARIANT_FIELDS) {
		const base = typeof tree[f.field] === 'string' ? (tree[f.field] as string) : null;
		tree[f.field] = variants.value(f.field, base);
	}
	return profile;
}

/**
 * The profile tree with its alternative wordings removed, for anything that
 * hands it to a browser.
 *
 * The variants are in the tree (see PROFILE_INCLUDE) because the overlay
 * resolver and the auto-translate walk both need them server-side. But a
 * SvelteKit `load` serialises whatever it returns into the page, so leaving
 * them on meant every public resume and CV shipped the applicant's OTHER
 * wordings to anyone who opened the page source — including an anonymous
 * visitor, and including wordings no version had picked. The alternative you
 * did not send is exactly the one you did not want that reader to have.
 *
 * Applied AFTER applyFieldVariants: the fields have already taken their values
 * by then, so removing the source list changes nothing about what renders.
 */
export function withoutFieldVariants<T>(profile: T): T {
	if (!profile || typeof profile !== 'object') return profile;
	const rest = { ...(profile as Record<string, unknown>) };
	delete rest.field_variants;
	return rest as T;
}

/**
 * Confirm a variant belongs to a profile before a version picks it or an edit
 * touches it.
 *
 * Every write path takes the id from the client, and the render side reads
 * picks back by id, so an unchecked write is one user printing another's prose.
 */
export async function isVariantOwned(variantId: number, profileId: number): Promise<boolean> {
	const row = await db
		.select({ id: profile_field_variants.id })
		.from(profile_field_variants)
		.where(
			and(
				eq(profile_field_variants.id, variantId),
				eq(profile_field_variants.profile_id, profileId)
			)
		)
		.limit(1);
	return row.length > 0;
}
