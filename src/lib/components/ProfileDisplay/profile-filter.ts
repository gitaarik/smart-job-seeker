/**
 * Version/tag filtering shared by the resume/CV templates (default
 * ProfileDisplay and the StructuredResume templates).
 *
 * A resume "version" is a named slug whose extension chain (via
 * profile_version_extensions) plus the base template type ("resume"/"cv")
 * forms the set of active identifiers. Each item (work experience,
 * achievement, skill category, education, …) can carry `tags`:
 *   - a positive `slug`  → whitelist: show only on matching versions
 *   - a negated `!slug`   → blacklist: hide on that version/template
 *   - `resume` / `cv`     → restrict to that base template
 *
 * Exclusions win over includes at the *same* specificity, but a positive tag
 * naming the version being viewed is more specific than a base-template
 * exclusion and re-admits the item there. That is what makes the profile-only
 * pair (`!resume` + `!cv`, see $lib/profile-visibility) an overridable default:
 * off every document, except the versions explicitly tagged back in.
 *
 * A version may additionally carry per-item OVERRIDES (see
 * $lib/version-overrides) — the per-job exceptions that make a version tailored
 * to one application. Tags are the applicant's general rule; an override is
 * this document's exception to it, so overrides are applied last and win in
 * both directions. A caller that passes no entity type gets the tag behaviour
 * unchanged, which is why adding this broke no existing call site.
 */

import { BASE_TEMPLATE_TAGS, isNegated, tagSlug } from '$lib/profile-visibility';
import {
	indexOverrides,
	orderByOverrides,
	overrideKey,
	type VersionOverride
} from '$lib/version-overrides';

interface VersionObj {
	id: number;
	slug: string | null;
	toggles: string[] | unknown;
	extension_links: Array<{ extended_id: number | null } & Record<string, unknown>>;
	/** Loaded alongside the version; absent on every pre-override caller. */
	overrides?: VersionOverride[] | unknown;
}

export interface ProfileFilter {
	/**
	 * Filter one list for the document being rendered. Pass `entityType` (a
	 * $lib/version-overrides entity) for lists a tailored version can speak
	 * about; without it only tags apply.
	 */
	filterOnTags: <T extends { tags?: string[] | unknown } & Record<string, any>>(
		objList: T[],
		entityType?: string
	) => T[];
	versionSlugs: string[];
	toggles: string[];
}

export function createProfileFilter(
	profileVersions: VersionObj[] | undefined,
	type: string | null,
	versionId: number | null,
	versionFromUrl: string
): ProfileFilter {
	function getVersion(idx: string | number): VersionObj | undefined {
		if (!profileVersions) return undefined;
		if (typeof idx === 'number') {
			return profileVersions.find((v) => v.id === idx);
		}
		return profileVersions.find((v) => v.slug === idx);
	}

	const rootVersion = versionId ? getVersion(versionId) : getVersion(versionFromUrl);

	function getAllVersionObjs(versionObj: VersionObj | undefined) {
		const versionObjs: Array<VersionObj | undefined> = [versionObj];

		const addVersionObjs = (vo: VersionObj | undefined) => {
			if (vo && vo.extension_links) {
				for (const junctionObj of vo.extension_links) {
					if (junctionObj.extended_id == null) continue;
					const extObj = getVersion(junctionObj.extended_id);
					versionObjs.push(extObj);
					addVersionObjs(extObj);
				}
			}
		};

		addVersionObjs(versionObj);
		return versionObjs;
	}

	const versionObjs = getAllVersionObjs(rootVersion);
	const versionSlugs = versionObjs.map((v) => v?.slug).filter(Boolean) as string[];

	const toggles: string[] = [];
	versionObjs.forEach((vo) => {
		if (Array.isArray(vo?.toggles) && vo.toggles.length) {
			(vo.toggles as string[]).forEach((t) => toggles.push(t));
		}
	});

	// Chain order is root-first (the version being viewed, then what it extends),
	// and indexOverrides lets the first writer win — so a tailored version's own
	// decision beats the library version it extends, matching how a positive tag
	// on the viewed version beats an inherited exclusion.
	const overrideRows: VersionOverride[] = [];
	versionObjs.forEach((vo) => {
		if (Array.isArray(vo?.overrides)) {
			overrideRows.push(...(vo.overrides as VersionOverride[]));
		}
	});
	const overrides = indexOverrides(overrideRows);

	function filterOnTags<T extends { tags?: string[] | unknown } & Record<string, any>>(
		objList: T[],
		entityType?: string
	): T[] {
		// The identifiers active for the currently-rendered document: the base
		// template ("resume"/"cv") plus the viewed version's extension chain.
		const currentType = (type || 'resume').toLowerCase();
		const activeVersionIds = versionSlugs.map((s) => s.toLowerCase());

		const overrideFor = (obj: T): VersionOverride | undefined => {
			if (!entityType || overrides.size === 0) return undefined;
			const id = (obj as { id?: unknown }).id;
			return typeof id === 'number' ? overrides.get(overrideKey(entityType, id)) : undefined;
		};

		const kept = objList.filter((obj) => {
			// The per-job exception, in both directions: an include re-admits an item
			// the tags hold back (a profile-only skill this job requires) without
			// touching the shared tag array; an exclude drops one the tags allow.
			const override = overrideFor(obj);
			if (override?.action === 'exclude') return false;
			if (override?.action === 'include') return true;

			if (!('tags' in obj && Array.isArray(obj.tags) && obj.tags.length)) {
				return true;
			}
			const tagsArr = (obj.tags as unknown[]).filter((t): t is string => typeof t === 'string');

			const negatedIds = tagsArr.filter(isNegated).map(tagSlug).filter(Boolean);
			const positives = tagsArr
				.filter((t) => !isNegated(t))
				.map(tagSlug)
				.filter(Boolean);

			const versionPositives = positives.filter((p) => !BASE_TEMPLATE_TAGS.includes(p));
			// Is the item explicitly whitelisted for the version being viewed?
			const onActiveVersion = versionPositives.some((p) => activeVersionIds.includes(p));

			// A `!slug` naming the viewed version is the most specific instruction
			// there is — it wins even over a positive tag for that same version.
			if (negatedIds.some((id) => activeVersionIds.includes(id))) return false;

			// A base-template exclusion is a blanket default (`!resume` + `!cv` =
			// profile-only), so an explicit positive for the viewed version beats it.
			if (negatedIds.includes(currentType) && !onActiveVersion) return false;

			if (
				!positives.includes(currentType) &&
				positives.includes(currentType === 'resume' ? 'cv' : 'resume')
			) {
				// The opposite base template is tagged but the current one isn't —
				// e.g. `type` is "cv" and tags contain "resume" but not "cv" → hide.
				return false;
			}

			// Positive version tags act as a whitelist: show only on those versions.
			// With no version being viewed nothing can satisfy the whitelist, so a
			// version-restricted item stays off the plain base document.
			if (!versionPositives.length) return true;
			return onActiveVersion;
		});

		if (!entityType) return kept;
		return orderByOverrides(kept, entityType, overrides, (obj) => {
			const id = (obj as { id?: unknown }).id;
			return typeof id === 'number' ? id : undefined;
		});
	}

	return { filterOnTags, versionSlugs, toggles };
}
