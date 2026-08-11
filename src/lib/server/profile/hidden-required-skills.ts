/**
 * Which skills a job requires that the applicant *has* but wouldn't print on a
 * given document.
 *
 * This exists because profile-only skills (see $lib/profile-visibility) are
 * deliberately invisible: they score the job and then stay off the page, and
 * they're stripped from the AI snapshot too, so a generated letter won't raise
 * them either. That's the right default — but when the job *requires* one, the
 * silence is exactly wrong. Surfacing it at the moment a version is picked for
 * an application turns a silent omission into a decision.
 *
 * "Profile-only" is not the test. A skill tagged `["!resume","!cv","backend"]`
 * is profile-only yet prints fine on the backend CV, so nudging about it there
 * would be noise. The real question — would this skill render on the document
 * about to be sent — needs the whole tag chain evaluated for that one document,
 * which is what createProfileFilter already does for the templates. So this
 * runs the same filter server-side, per (base template × version) pair.
 *
 * Running that filter for every candidate document also answers a second
 * question for free: not just what each one HIDES, but how much of the job it
 * COVERS — which is what lets the application page recommend a version instead
 * of presenting an empty picker. Same loop, same filter, one more counter; see
 * getVersionCoverage below and planning/TAILORED-VERSIONS.md § Phase 1.
 */

import { dbDirect as db } from '$lib/server/db';
import { and, asc, eq, isNull, or } from 'drizzle-orm';
import { profile_versions, tech_skill_categories, tech_skills } from '$lib/server/db/schema';
import { createProfileFilter } from '$lib/components/ProfileDisplay/profile-filter';
import { BASE_TEMPLATE_TAGS, SHOW_ON_ALL, tagsForShowOn } from '$lib/profile-visibility';
import { OVERRIDE_ENTITIES } from '$lib/version-overrides';
import { hiddenSkillsKey, type HiddenSkill, type VersionCoverage } from '$lib/version-coverage';

// The shapes and the ranking live in $lib/version-coverage so the card can rank
// as the applicant flips between Resume and CV without asking the server again.
export { hiddenSkillsKey };
export type { HiddenSkill, VersionCoverage };

/**
 * Which versions a caller is asking about.
 *
 * Library versions (`application_id IS NULL`) are always in. An application's
 * own tailored version joins them only when that application is the one asking
 * — without this the loop would grow with every application the applicant ever
 * created, computing documents nobody is looking at.
 */
export interface CoverageScope {
	applicationId?: number | null;
}

/**
 * For every (base template × version) combination, the required skills the
 * profile has but that document wouldn't show.
 *
 * Matching is by exact case-insensitive name, the same join the job page's own
 * highlighting uses — a job skill string only resolves to a profile skill when
 * the names agree, so an LLM-fuzzy match ("JavaScript/TypeScript") won't
 * produce a nudge. Only `skills_required` is worth interrupting over; the
 * caller decides what to pass.
 */
export async function getVersionCoverage(
	profileId: number,
	requiredSkills: string[],
	scope: CoverageScope = {}
): Promise<Record<string, VersionCoverage>> {
	const wanted = new Set(
		requiredSkills
			.filter((s): s is string => typeof s === 'string')
			.map((s) => s.trim().toLowerCase())
			.filter(Boolean)
	);
	if (wanted.size === 0) return {};

	const applicationId = scope.applicationId ?? null;
	const [versions, categories] = await Promise.all([
		db.query.profile_versions.findMany({
			where: and(
				eq(profile_versions.profile_id, profileId),
				applicationId === null
					? isNull(profile_versions.application_id)
					: or(
							isNull(profile_versions.application_id),
							eq(profile_versions.application_id, applicationId)
						)
			),
			columns: { id: true, slug: true, toggles: true, application_id: true },
			// A tailored version's visible set is its tags PLUS its per-job
			// overrides, so the prediction has to see both or it would answer for a
			// document that doesn't exist.
			with: { extension_links: true, overrides: true },
			orderBy: asc(profile_versions.sort)
		}),
		db.query.tech_skill_categories.findMany({
			where: eq(tech_skill_categories.profile_id, profileId),
			columns: { id: true, tags: true },
			with: {
				tech_skills: {
					columns: { id: true, name: true, tags: true },
					orderBy: asc(tech_skills.sort)
				}
			},
			orderBy: asc(tech_skill_categories.sort)
		})
	]);

	// The profile's own take on each required skill, if it has one at all.
	type OwnedSkill = {
		id: number;
		name: string;
		tags: string[] | null;
		categoryId: number;
	};
	const owned = new Map<string, OwnedSkill>();
	for (const category of categories) {
		for (const skill of category.tech_skills) {
			const key = skill.name?.trim().toLowerCase();
			if (!key || !wanted.has(key) || owned.has(key)) continue;
			owned.set(key, {
				id: skill.id,
				name: skill.name!,
				tags: Array.isArray(skill.tags) ? (skill.tags as string[]) : null,
				categoryId: category.id
			});
		}
	}
	if (owned.size === 0) return {};

	const result: Record<string, VersionCoverage> = {};
	const versionSlugs = ['', ...versions.map((v) => v.slug).filter(Boolean)];

	for (const docType of BASE_TEMPLATE_TAGS) {
		for (const versionSlug of versionSlugs) {
			const { filterOnTags } = createProfileFilter(
				versions as never,
				docType,
				null,
				versionSlug as string
			);

			// A skill prints only if its category survives the filter too — that is
			// how both templates render them (category first, then its skills).
			const keptCategories = filterOnTags(categories, OVERRIDE_ENTITIES.skillCategory);
			const visibleCategories = new Set(keptCategories.map((c) => c.id));
			const visible = new Set<string>();
			for (const category of keptCategories) {
				for (const skill of filterOnTags(category.tech_skills, OVERRIDE_ENTITIES.skill)) {
					const key = skill.name?.trim().toLowerCase();
					if (key) visible.add(key);
				}
			}

			// What the one-click action here would do, asked of the same function the
			// API route uses to do it.
			const target = versionSlug || SHOW_ON_ALL;

			const hidden: HiddenSkill[] = [];
			const shown: string[] = [];
			for (const [key, skill] of owned) {
				if (visible.has(key)) {
					shown.push(skill.name);
					continue;
				}

				const lifted = filterOnTags([
					{
						tags: tagsForShowOn(skill.tags, target)
					}
				]);
				hidden.push({
					id: skill.id,
					name: skill.name,
					liftable: lifted.length > 0 && visibleCategories.has(skill.categoryId)
				});
			}

			result[hiddenSkillsKey(docType, versionSlug as string)] = {
				shown,
				hidden,
				owned: owned.size,
				required: wanted.size
			};
		}
	}

	return result;
}
