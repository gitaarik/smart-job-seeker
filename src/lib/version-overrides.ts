/**
 * Per-item include/exclude decisions belonging to one version — the delta that
 * makes a version job-tailored.
 *
 * Two layers decide whether an item prints, and they answer different
 * questions. The item's own `tags` (see $lib/profile-visibility) are the
 * applicant's GENERAL rule: "this is a CV-only detail", "this is profile-only".
 * An override is a per-job EXCEPTION to that rule: "for this one application,
 * lead with this bullet and drop that one." So overrides are applied after the
 * tag pass, and win over it in both directions.
 *
 * Why a sidecar table instead of more tags — see profile_version_overrides in
 * schema.ts. Short version: `tags` is a shared column on a shared row, and a
 * per-application tag can never be cleaned up.
 *
 * Client-safe: pure data + helpers, no DB. The filter that consumes them lives
 * in components/ProfileDisplay/profile-filter.ts, the resolver in
 * server/profile/version-overrides.ts.
 */

/**
 * Entity vocabulary. These strings are persisted in
 * `profile_version_overrides.entity_type`, so renaming one orphans existing
 * rows — treat as append-only, same contract as resume-translations.ts.
 */
export const OVERRIDE_ENTITIES = {
	workExperience: 'work_experience',
	achievement: 'work_experience_achievement',
	technology: 'work_experience_technology',
	skillCategory: 'tech_skill_category',
	skill: 'tech_skill',
	sideProject: 'side_project',
	education: 'education'
} as const;

export type OverrideEntity = (typeof OVERRIDE_ENTITIES)[keyof typeof OVERRIDE_ENTITIES];

/** Every entity an override may name. */
export const OVERRIDE_ENTITY_TYPES: string[] = Object.values(OVERRIDE_ENTITIES);

export function isOverrideEntity(value: unknown): value is OverrideEntity {
	return typeof value === 'string' && OVERRIDE_ENTITY_TYPES.includes(value);
}

/**
 * Slug namespace reserved for versions owned by an application.
 *
 * Reserved rather than merely conventional: a hand-made version called `app-45`
 * would collide with the one this application generates, and the collision
 * would surface as the wrong document being sent. The create/update forms
 * reject the prefix, so the namespace is the feature's alone.
 */
export const TAILORED_SLUG_PREFIX = 'app-';

export function isTailoredSlug(slug: string): boolean {
	return /^app-\d+(-|$)/.test(slug.trim().toLowerCase());
}

/** The slug an application's own version gets. */
export function tailoredSlugFor(applicationId: number): string {
	return `${TAILORED_SLUG_PREFIX}${applicationId}`;
}

export type OverrideAction = 'include' | 'exclude';

export function isOverrideAction(value: unknown): value is OverrideAction {
	return value === 'include' || value === 'exclude';
}

/** One stored decision. Shaped after the DB row, but usable before it is saved. */
export interface VersionOverride {
	version_id?: number;
	entity_type: string;
	entity_id: number;
	action: string;
	/** Per-version order; null leaves the item's own global `sort` in charge. */
	sort?: number | null;
	/** Why — surfaced in the review diff, never hidden from the applicant. */
	reason?: string | null;
	/** 'ai' | 'user'. A regeneration must not overwrite a hand-made decision. */
	source?: string | null;
}

/** Lookup key for one item. */
export function overrideKey(entityType: string, entityId: number): string {
	return `${entityType}:${entityId}`;
}

/**
 * Index a flat list for lookup. FIRST writer wins, so callers pass the most
 * specific version's rows first: a tailored version extending a library one
 * overrides what the parent said, the same precedence the tag chain uses.
 */
export function indexOverrides(rows: VersionOverride[]): Map<string, VersionOverride> {
	const index = new Map<string, VersionOverride>();
	for (const row of rows) {
		if (!isOverrideAction(row.action)) continue;
		const key = overrideKey(row.entity_type, row.entity_id);
		if (!index.has(key)) index.set(key, row);
	}
	return index;
}

/**
 * The per-version order for a list, when the version carries one.
 *
 * Only reorders when at least one item actually has an override `sort` —
 * otherwise the list is returned untouched, so a version with no ordering
 * opinion renders exactly as it did before overrides existed. Items without one
 * fall to the end in their original relative order rather than interleaving by
 * a global `sort` that means something different.
 */
export function orderByOverrides<T>(
	items: T[],
	entityType: string,
	index: Map<string, VersionOverride>,
	idOf: (item: T) => number | undefined
): T[] {
	if (index.size === 0) return items;

	const sortOf = (item: T): number | null => {
		const id = idOf(item);
		if (id === undefined) return null;
		const sort = index.get(overrideKey(entityType, id))?.sort;
		return typeof sort === 'number' ? sort : null;
	};

	if (!items.some((item) => sortOf(item) !== null)) return items;

	return items
		.map((item, index) => ({ item, index, sort: sortOf(item) }))
		.sort((a, b) => {
			const as = a.sort ?? Number.MAX_SAFE_INTEGER;
			const bs = b.sort ?? Number.MAX_SAFE_INTEGER;
			return as === bs ? a.index - b.index : as - bs;
		})
		.map((entry) => entry.item);
}
