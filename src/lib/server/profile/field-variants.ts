/**
 * Server-side loader, tree applier and writer for alternative field wordings.
 *
 * `loadFieldVariants` loads the wordings one version prints — its own picks and
 * the ones it inherits from the versions it builds on — and `applyFieldVariants`
 * overwrites those fields on a loaded profile tree in place, the same trick
 * applyTranslations uses, so no renderer needs to know this exists.
 *
 * ORDER. Two overlays write to the same fields, and the order is a rule rather
 * than a preference:
 *
 *     applyTranslations  →  applyFieldVariants
 *
 * Translations first because they are the language of the DEFAULT value; a
 * variant that replaces it must therefore replace the translated text too, and
 * carry its own translation to stay in-language — which is why the variant's
 * `value` is itself a translatable field keyed on the variant's id (see
 * resume-translations.ts) rather than on `profile.summary`. Reusing the field's
 * key would mean the Dutch document silently printed the default summary while
 * the English one printed the variant, and nothing would report it.
 *
 * There was a third overlay after these two, a value per presentation template
 * that beat both. It is gone: what a field says is the version's decision
 * alone, and a template only decides how the document looks. See
 * $lib/field-variants.ts for the vocabulary and for the rule that picks.
 */

import { dbDirect as db } from '$lib/server/db';
import { and, asc, desc, eq, inArray } from 'drizzle-orm';
import {
	profile_field_variants,
	profile_version_overrides,
	profile_versions,
	profiles,
	work_experiences
} from '$lib/server/db/schema';
import {
	FIELD_VARIANT_ENTITY,
	FIELD_VARIANT_VALUE,
	describeWordings,
	resolveWordings,
	toFieldVariant,
	variantFieldLabel,
	variantFieldsFor,
	variantTargetKey,
	variantsForTarget,
	type FieldVariant,
	type VariantEntity,
	type WordingPickRow,
	type WordingState
} from '$lib/field-variants';
import { OVERRIDE_ENTITIES } from '$lib/version-overrides';
import { versionChain } from '$lib/server/profile/skill-words';
import type { Translator } from '$lib/server/profile/translations';

export interface FieldVariants {
	/** The version these picks belong to, or null when nothing is picked. */
	versionId: number | null;
	/** Nothing to apply; the applier short-circuits. */
	isEmpty: boolean;
	/** The picked wording for one field of one item, or `base` when the default stands. */
	value: (entity: string, entityId: number, field: string, base: string | null) => string | null;
	/** Which variant won each target (keyed by `variantTargetKey`), for the review diff. */
	picked: Map<string, FieldVariant>;
}

/** No version, or a version that picks nothing. */
export const NO_FIELD_VARIANTS: FieldVariants = {
	versionId: null,
	isEmpty: true,
	value: (_entity, _entityId, _field, base) => base,
	picked: new Map()
};

const VARIANT_COLUMNS = {
	id: profile_field_variants.id,
	profile_id: profile_field_variants.profile_id,
	work_experience_id: profile_field_variants.work_experience_id,
	field: profile_field_variants.field,
	label: profile_field_variants.label,
	value: profile_field_variants.value,
	note: profile_field_variants.note,
	sort: profile_field_variants.sort
};

/** Every variant a profile holds, in editor order. */
export async function listFieldVariants(profileId: number): Promise<FieldVariant[]> {
	const rows = await db
		.select(VARIANT_COLUMNS)
		.from(profile_field_variants)
		.where(eq(profile_field_variants.profile_id, profileId))
		.orderBy(asc(profile_field_variants.sort), asc(profile_field_variants.id));
	return rows.map(toFieldVariant);
}

/**
 * A version and everything it builds on, nearest first.
 *
 * Walked by the same function a version's skill words are (`versionChain`), so
 * "the version being viewed beats the one it builds on" means one thing for a
 * word and for a wording. The versions are read for the whole profile and
 * walked in memory: a profile has a handful, and one query answers a chain of
 * any depth where a query per step would not.
 *
 * A version that is not this profile's has no chain, and so no wordings.
 */
export async function versionChainFor(profileId: number, versionId: number): Promise<number[]> {
	const versions = await db.query.profile_versions.findMany({
		where: eq(profile_versions.profile_id, profileId),
		columns: { id: true },
		with: { extension_links: { columns: { extended_id: true } } }
	});
	return versionChain(versions, versionId);
}

/** Every wording decision the given versions hold. */
export async function wordingRowsFor(versionIds: number[]): Promise<WordingPickRow[]> {
	if (versionIds.length === 0) return [];
	return db
		.select({
			id: profile_version_overrides.id,
			version_id: profile_version_overrides.version_id,
			entity_id: profile_version_overrides.entity_id,
			action: profile_version_overrides.action,
			source: profile_version_overrides.source,
			reason: profile_version_overrides.reason
		})
		.from(profile_version_overrides)
		.where(
			and(
				inArray(profile_version_overrides.version_id, versionIds),
				eq(profile_version_overrides.entity_type, OVERRIDE_ENTITIES.fieldVariant)
			)
		);
}

/**
 * Load the wordings one version prints into an in-memory resolver.
 *
 * The version's own picks and the ones it inherits: a job's version built on a
 * library version prints the title that library version picked unless it picks
 * one itself, which is what its items have always done (see
 * ProfileDisplay/profile-filter.ts). Which of several decisions stands is
 * `resolveWordings` in $lib/field-variants.ts.
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

	// Every wording decision on any of this profile's versions, before the
	// chain is known. Most profiles have none, and this way a document that uses
	// no wordings costs one query here, as it did before versions inherited.
	const everyRow = await db
		.select({
			id: profile_version_overrides.id,
			version_id: profile_version_overrides.version_id,
			entity_id: profile_version_overrides.entity_id,
			action: profile_version_overrides.action,
			source: profile_version_overrides.source,
			reason: profile_version_overrides.reason
		})
		.from(profile_version_overrides)
		.innerJoin(profile_versions, eq(profile_version_overrides.version_id, profile_versions.id))
		.where(
			and(
				eq(profile_versions.profile_id, profileId),
				eq(profile_version_overrides.entity_type, OVERRIDE_ENTITIES.fieldVariant)
			)
		);
	if (everyRow.length === 0) return NO_FIELD_VARIANTS;

	const chain = await versionChainFor(profileId, versionId);
	const rows = everyRow.filter((r) => chain.includes(r.version_id));
	if (rows.length === 0) return NO_FIELD_VARIANTS;

	const variants = (
		await db
			.select(VARIANT_COLUMNS)
			.from(profile_field_variants)
			.where(
				and(
					eq(profile_field_variants.profile_id, profileId),
					inArray(profile_field_variants.id, [...new Set(rows.map((r) => r.entity_id))])
				)
			)
	).map(toFieldVariant);
	if (variants.length === 0) return NO_FIELD_VARIANTS;

	const resolved = resolveWordings(chain, rows, variants);
	if (resolved.size === 0) return NO_FIELD_VARIANTS;

	const picked = new Map([...resolved].map(([key, pick]) => [key, pick.variant]));
	return {
		versionId,
		isEmpty: false,
		value: (entity, entityId, field, base) => {
			const variant = picked.get(variantTargetKey(entity, entityId, field));
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
 * Every printed target of a profile, with what one version says for each — the
 * list both pickers render (the version page and the job's document panel).
 *
 * `versionId` null describes the plain, version-less document. The rows come
 * whole from `profiles` and `work_experiences` rather than by named column, so
 * that a field added to the vocabulary is read here without this query being
 * told about it.
 */
export async function wordingStatesFor(
	profileId: number,
	versionId: number | null
): Promise<WordingState[]> {
	const [profile, roles, variants] = await Promise.all([
		db.query.profiles.findFirst({ where: eq(profiles.id, profileId) }),
		db.query.work_experiences.findMany({
			where: eq(work_experiences.profile_id, profileId),
			// The order the documents list roles in (see PROFILE_INCLUDE).
			orderBy: [asc(work_experiences.sort), desc(work_experiences.start_date)]
		}),
		listFieldVariants(profileId)
	]);
	if (!profile) return [];

	const chain = versionId ? await versionChainFor(profileId, versionId) : [];
	const rows = await wordingRowsFor(chain);
	// Only the versions it builds on need a name, to say where an inherited pick
	// comes from; a version that builds on nothing skips the query.
	const named =
		chain.length > 1
			? await db
					.select({ id: profile_versions.id, name: profile_versions.name })
					.from(profile_versions)
					.where(
						and(eq(profile_versions.profile_id, profileId), inArray(profile_versions.id, chain))
					)
			: [];

	return describeWordings({
		profile,
		roles,
		variants,
		versionId,
		chain,
		rows,
		versionNames: new Map(named.map((v) => [v.id, v.name ?? 'another version']))
	});
}

function textOf(value: unknown): string | null {
	return typeof value === 'string' ? value : null;
}

/**
 * Apply a version's picked wordings to a loaded profile tree, mutating it in
 * place. Driven by the vocabulary, so adding a field of the profile or of a
 * role to VARIANT_FIELDS is the whole change here; a new KIND of item needs its
 * own walk below, since this is the one function that knows where in the tree
 * each kind lives.
 */
export function applyFieldVariants<T>(profile: T, variants: FieldVariants): T {
	if (variants.isEmpty || !profile) return profile;

	// Generic in the tree it is handed so call sites keep their own profile
	// type. One cast here, none at the routes that call it.
	const tree = profile as Record<string, unknown>;
	const profileId = Number(tree.id);
	for (const f of variantFieldsFor('profile')) {
		tree[f.field] = variants.value('profile', profileId, f.field, textOf(tree[f.field]));
	}

	const roles = Array.isArray(tree.work_experiences) ? tree.work_experiences : [];
	const roleFields = variantFieldsFor('work_experience');
	for (const role of roles as Record<string, unknown>[]) {
		if (!role || typeof role.id !== 'number') continue;
		for (const f of roleFields) {
			role[f.field] = variants.value('work_experience', role.id, f.field, textOf(role[f.field]));
		}
	}
	return profile;
}

/**
 * The profile tree with its alternative wordings removed, for anything that
 * hands it to a browser.
 *
 * The variants are in the tree (see PROFILE_INCLUDE) because the auto-translate
 * walk needs them server-side. But a SvelteKit `load` serialises whatever it
 * returns into the page, so leaving them on meant every public resume and CV
 * shipped the applicant's OTHER wordings to anyone who opened the page source —
 * including an anonymous visitor, and including wordings no version had
 * picked. The alternative you did not send is exactly the one you did not want
 * that reader to have.
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

/**
 * Confirm the row a wording is being written for belongs to a profile.
 *
 * The target's id comes from the client like every other id here. A field of
 * the profile is addressed by the profile's own id; a role's by the role's.
 */
export async function isVariantTargetOwned(
	profileId: number,
	entity: VariantEntity,
	entityId: number
): Promise<boolean> {
	if (entity === 'profile') return entityId === profileId;
	const row = await db
		.select({ id: work_experiences.id })
		.from(work_experiences)
		.where(and(eq(work_experiences.id, entityId), eq(work_experiences.profile_id, profileId)))
		.limit(1);
	return row.length > 0;
}

/**
 * Add one alternative wording to a target's list.
 *
 * A library row, not a decision: nothing prints it until a version picks it.
 * The caller has confirmed the target belongs to the profile (see
 * `isVariantTargetOwned`) and that the field is one that can have variants.
 *
 * Appended, not inserted: order among a target's variants is cosmetic (the
 * pickers list them), so a new one going last is the least surprising place
 * and needs no renumbering of the others.
 */
export async function createFieldVariant(opts: {
	profileId: number;
	entity: VariantEntity;
	entityId: number;
	field: string;
	label: string;
	value: string;
	note?: string | null;
}): Promise<FieldVariant> {
	const { profileId, entity, entityId, field } = opts;
	const siblings = variantsForTarget(await listFieldVariants(profileId), entity, entityId, field);
	const nextSort = siblings.reduce((max, v) => Math.max(max, v.sort ?? 0), -1) + 1;

	const now = new Date();
	const [row] = await db
		.insert(profile_field_variants)
		.values({
			profile_id: profileId,
			// Which row it belongs to. One nullable column per kind of item, so
			// the database can take a role's wordings with the role.
			work_experience_id: entity === 'work_experience' ? entityId : null,
			field,
			label: opts.label.trim() || 'Alternative',
			value: opts.value.trim(),
			note: opts.note?.trim() || null,
			sort: nextSort,
			date_created: now,
			date_updated: now
		})
		.returning(VARIANT_COLUMNS);
	return toFieldVariant(row);
}

/**
 * Set — or clear — the wording one version prints for one target.
 *
 * Stored as `profile_version_overrides` rows rather than in a table of its own
 * (see the entity's entry in $lib/version-overrides.ts for why). The rule the
 * schema cannot enforce is enforced here: a field holds one value, so setting a
 * wording REPLACES whatever this version had said about the target.
 *
 * `variantId: null` means the profile's own value. On a version that builds on
 * nothing, that is the absence of a row, as it always was. On one whose base
 * picks a wording for the target, saying nothing would inherit that pick, so
 * each wording the base picks is taken back off here with an exclude — the
 * same row "hide this item on this job" writes about an item the base prints.
 *
 * Written as the applicant's own decision ('user'), so a regeneration of a
 * tailored version leaves it standing.
 *
 * The caller has confirmed that the version and the target belong to the
 * profile. This confirms the variant belongs to the target, and returns false
 * without writing when it does not: a pick naming another field's variant
 * would resolve to that other field at render time.
 */
export async function setVersionWording(opts: {
	profileId: number;
	versionId: number;
	entity: VariantEntity;
	entityId: number;
	field: string;
	variantId: number | null;
	/** Why, for the review. Defaults to "you chose this … for this version". */
	reason?: string;
}): Promise<boolean> {
	const { profileId, versionId, entity, entityId, field, variantId } = opts;

	const targetVariants = variantsForTarget(
		await listFieldVariants(profileId),
		entity,
		entityId,
		field
	);
	const targetIds = targetVariants.map((v) => v.id);
	if (variantId !== null && !targetIds.includes(variantId)) return false;

	// Clear what this version said about the target first, in every branch.
	// Setting one is a replacement, not an addition, and choosing the profile's
	// own value is the same statement with nothing after it.
	if (targetIds.length > 0) {
		await db
			.delete(profile_version_overrides)
			.where(
				and(
					eq(profile_version_overrides.version_id, versionId),
					eq(profile_version_overrides.entity_type, OVERRIDE_ENTITIES.fieldVariant),
					inArray(profile_version_overrides.entity_id, targetIds)
				)
			);
	}

	const what = variantFieldLabel(entity, field).toLowerCase();
	const now = new Date();
	const row = (id: number, action: 'include' | 'exclude', reason: string) => ({
		version_id: versionId,
		entity_type: OVERRIDE_ENTITIES.fieldVariant,
		entity_id: id,
		action,
		reason,
		source: 'user',
		date_created: now,
		date_updated: now
	});

	if (variantId !== null) {
		await db
			.insert(profile_version_overrides)
			.values(row(variantId, 'include', opts.reason ?? `you chose this ${what} for this version`));
		return true;
	}

	const inherited = (await versionChainFor(profileId, versionId)).slice(1);
	if (inherited.length === 0 || targetIds.length === 0) return true;
	const pickedAbove = new Set(
		(await wordingRowsFor(inherited))
			.filter((r) => r.action === 'include' && targetIds.includes(r.entity_id))
			.map((r) => r.entity_id)
	);
	if (pickedAbove.size === 0) return true;
	await db
		.insert(profile_version_overrides)
		.values(
			[...pickedAbove].map((id) =>
				row(id, 'exclude', opts.reason ?? `you chose your own ${what} for this version`)
			)
		);
	return true;
}
