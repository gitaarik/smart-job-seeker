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
 */

import { BASE_TEMPLATE_TAGS, isNegated, tagSlug } from '$lib/profile-visibility';

interface VersionObj {
	id: number;
	slug: string | null;
	toggles: string[] | unknown;
	extension_links: Array<{ extended_id: number | null } & Record<string, unknown>>;
}

export interface ProfileFilter {
	filterOnTags: <T extends { tags?: string[] | unknown } & Record<string, any>>(
		objList: T[]
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

	function filterOnTags<T extends { tags?: string[] | unknown } & Record<string, any>>(
		objList: T[]
	): T[] {
		// The identifiers active for the currently-rendered document: the base
		// template ("resume"/"cv") plus the viewed version's extension chain.
		const currentType = (type || 'resume').toLowerCase();
		const activeVersionIds = versionSlugs.map((s) => s.toLowerCase());

		return objList.filter((obj) => {
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
	}

	return { filterOnTags, versionSlugs, toggles };
}
