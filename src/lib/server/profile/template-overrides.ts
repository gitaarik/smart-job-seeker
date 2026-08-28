/**
 * Server-side resolver + tree applier for per-template field overrides.
 *
 * `loadTemplateOverrides` bulk-loads one template's overrides into a Map
 * (single query; no template means no DB hit at all), and
 * `applyTemplateOverrides` walks a loaded profile tree and overwrites the
 * overridable fields in place — so the render components need no changes, the
 * same trick applyTranslations uses.
 *
 * ORDER: this runs AFTER applyTranslations, and that is the whole point. An
 * override is a force — "on this template the title is Senior Engineer" — and a
 * translation row is keyed to (entity, field, locale), so it holds the other
 * language's rendering of the value being replaced. Running translations last
 * would quietly put that value back on every non-English document, which is the
 * one outcome this feature exists to prevent. Running them first means an
 * override lands on top of a translated tree, so an override needs its own
 * translations to stay in-language — hence the `locale` column, and hence the
 * base-locale fallback below: an English-only override still applies to a Dutch
 * document rather than being ignored, and the applicant can add the Dutch
 * wording when they want it.
 *
 * See $lib/template-overrides.ts for the overridable-field vocabulary.
 */

import { dbDirect as db } from '$lib/server/db';
import { and, eq, inArray } from 'drizzle-orm';
import { profile_template_overrides, resume_templates } from '$lib/server/db/schema';
import { overridableFieldsFor, templateOverrideKey } from '$lib/template-overrides';
import { BASE_LOCALE } from '$lib/resume-translations';

export interface TemplateOverrides {
	/** The template these belong to, or null when nothing is overridden. */
	templateId: number | null;
	/** Nothing to apply; the applier short-circuits. */
	isEmpty: boolean;
	/** The override for (entity, id, field), or `base` when there is none. */
	value: (entity: string, id: number | string, field: string, base: string | null) => string | null;
}

/** No template, or a template that overrides nothing. */
export const NO_TEMPLATE_OVERRIDES: TemplateOverrides = {
	templateId: null,
	isEmpty: true,
	value: (_entity, _id, _field, base) => base
};

/**
 * Load every override a template carries for `locale` into an in-memory
 * resolver. One query; no template id returns the identity resolver (no DB
 * hit), and so does a template with no rows.
 */
export async function loadTemplateOverrides(
	templateId: number | null | undefined,
	locale?: string | null
): Promise<TemplateOverrides> {
	if (!templateId) return NO_TEMPLATE_OVERRIDES;

	// The requested language and the base, in one round trip: the base row is
	// the fallback, so both are needed to answer any single lookup.
	const wanted = locale && locale !== BASE_LOCALE ? [BASE_LOCALE, locale] : [BASE_LOCALE];

	const rows = await db
		.select({
			entity_type: profile_template_overrides.entity_type,
			entity_id: profile_template_overrides.entity_id,
			field: profile_template_overrides.field,
			locale: profile_template_overrides.locale,
			value: profile_template_overrides.value
		})
		.from(profile_template_overrides)
		.where(
			and(
				eq(profile_template_overrides.template_id, templateId),
				inArray(profile_template_overrides.locale, wanted)
			)
		);

	if (rows.length === 0) return NO_TEMPLATE_OVERRIDES;

	const inLocale = new Map<string, string>();
	const inBase = new Map<string, string>();
	for (const r of rows) {
		const key = templateOverrideKey(r.entity_type, r.entity_id, r.field);
		(r.locale === BASE_LOCALE ? inBase : inLocale).set(key, r.value);
	}

	return {
		templateId,
		isEmpty: false,
		value: (entity, id, field, base) => {
			const key = templateOverrideKey(entity, id, field);
			return inLocale.get(key) ?? inBase.get(key) ?? base;
		}
	};
}

function textOf(value: unknown): string | null {
	return typeof value === 'string' ? value : null;
}

/** Overwrite one field on a row when an override exists (no-op when it doesn't). */
function overlay(
	ov: TemplateOverrides,
	entity: string,
	row: Record<string, unknown> | null | undefined,
	field: string
): void {
	if (!row || typeof row.id !== 'number') return;
	row[field] = ov.value(entity, row.id, field, textOf(row[field]));
}

/**
 * Apply a template's overrides to a loaded profile tree, mutating it in place.
 *
 * The walk is driven by the vocabulary rather than by a literal field list, so
 * adding an entry to OVERRIDABLE_FIELDS for an entity already walked here is
 * the entire change. Entities are added here only when the vocabulary reaches
 * them — the `profile` loop is a no-op today and costs a closure per render.
 */
export function applyTemplateOverrides<T>(profile: T, ov: TemplateOverrides): T {
	if (ov.isEmpty || !profile) return profile;

	// Generic in the tree it is handed so call sites keep their own profile type
	// (applyTranslations takes `Record<string, any>` and loses it). One cast
	// here, none at the four places that call it.
	const tree = profile as Record<string, unknown>;

	for (const f of overridableFieldsFor('profile')) {
		tree[f.field] = ov.value('profile', Number(tree.id), f.field, textOf(tree[f.field]));
	}

	const roles = Array.isArray(tree.work_experiences) ? tree.work_experiences : [];
	const roleFields = overridableFieldsFor('work_experience');
	for (const role of roles) {
		for (const f of roleFields) {
			overlay(ov, 'work_experience', role as Record<string, unknown>, f.field);
		}
	}

	return profile;
}

/**
 * Every override the profile's templates hold for one entity, for the editor.
 *
 * Scoped through `resume_templates` rather than by a `profile_id` column on the
 * overrides themselves — the template is what owns them, and a second copy of
 * that fact is a second thing that can be wrong.
 */
export async function listTemplateOverridesFor(
	profileId: number,
	entity: string,
	entityId: number
): Promise<{ template_id: number; field: string; locale: string; value: string }[]> {
	return db
		.select({
			template_id: profile_template_overrides.template_id,
			field: profile_template_overrides.field,
			locale: profile_template_overrides.locale,
			value: profile_template_overrides.value
		})
		.from(profile_template_overrides)
		.innerJoin(resume_templates, eq(profile_template_overrides.template_id, resume_templates.id))
		.where(
			and(
				eq(resume_templates.profile_id, profileId),
				eq(profile_template_overrides.entity_type, entity),
				eq(profile_template_overrides.entity_id, entityId)
			)
		);
}
