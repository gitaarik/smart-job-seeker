/**
 * Per-template field overrides — what a field says when one presentation
 * template renders it.
 *
 * A profile item can already be held off a document two ways: its `tags` name a
 * base document type (`resume`/`cv`) or a version slug. Neither can reach the
 * presentation template, which is picked independently at render time
 * (`?template=citrus`), so nothing in a profile could say "on Citrus" — let
 * alone say it with a different value rather than by hiding something.
 *
 * That is what this is for: a consultancy's house style calls the applicant a
 * Senior Engineer where their own history says Lead Engineer, and both are
 * true. `ResumeTemplateConfig.contact` already does this for contact fields
 * (a brand email replacing the profile's own); this does it for fields that
 * belong to a row, which is why it needs a table rather than a config key.
 *
 * This registry is the single source of truth for WHICH fields can be
 * overridden. It drives the editor UI and the render-time applier both, so
 * adding a field here is the whole change. Same pattern as
 * resume-translations.ts and resume-contact-fields.ts.
 *
 * Client-safe: pure data + helpers, no DB. The resolver lives server-side in
 * server/profile/template-overrides.ts.
 */

/** A profile field a template may render differently. */
export interface OverridableField {
	/** Stable key persisted in profile_template_overrides.entity_type. */
	entity: string;
	/** Column/field name persisted in profile_template_overrides.field. */
	field: string;
	/** Human label for the editor UI. */
	label: string;
	/** Editor hint, shown under the control. */
	hint?: string;
}

/**
 * Every field a template may override, in editor order. The `entity` and
 * `field` values are stable strings persisted in the DB — renaming one orphans
 * existing rows, so treat this as an append-only vocabulary.
 *
 * Deliberately short. Every entry is a place a document can disagree with the
 * profile it was built from, and that is a claim the applicant has to be able
 * to defend; the bar for adding one is a real document that needs it, not
 * symmetry with the translatable-field list.
 */
export const OVERRIDABLE_FIELDS: OverridableField[] = [
	{
		entity: 'work_experience',
		field: 'position',
		label: 'Position',
		hint: 'Leave empty to use your own title.'
	}
];

const FIELD_SET = new Set(OVERRIDABLE_FIELDS.map((f) => `${f.entity}:${f.field}`));

export function isOverridable(entity: string, field: string): boolean {
	return FIELD_SET.has(`${entity}:${field}`);
}

export function overridableFieldsFor(entity: string): OverridableField[] {
	return OVERRIDABLE_FIELDS.filter((f) => f.entity === entity);
}

/** Map key shared by the resolver and the editor's lookup. */
export function templateOverrideKey(
	entity: string,
	entityId: number | string,
	field: string
): string {
	return `${entity}:${entityId}:${field}`;
}
