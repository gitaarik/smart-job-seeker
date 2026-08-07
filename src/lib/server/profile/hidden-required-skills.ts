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
 */

import { dbDirect as db } from '$lib/server/db';
import { asc, eq } from 'drizzle-orm';
import { profile_versions, tech_skill_categories, tech_skills } from '$lib/server/db/schema';
import { createProfileFilter } from '$lib/components/ProfileDisplay/profile-filter';
import { BASE_TEMPLATE_TAGS, SHOW_ON_ALL, tagsForShowOn } from '$lib/profile-visibility';

export interface HiddenSkill {
	id: number;
	name: string;
	/**
	 * Whether the one-click lift would actually reveal it here. False when
	 * something else holds it back — a hidden category, or a base-template
	 * restriction like `["cv"]` on a resume — in which case the caller should
	 * report the gap rather than offer a button that appears to do nothing.
	 */
	liftable: boolean;
}

/**
 * Key into the result map. `versionSlug` is "" when no version is picked, which
 * is a real document in its own right (the plain base template).
 */
export function hiddenSkillsKey(docType: string, versionSlug: string): string {
	return `${docType}:${versionSlug}`;
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
export async function getHiddenRequiredSkills(
	profileId: number,
	requiredSkills: string[]
): Promise<Record<string, HiddenSkill[]>> {
	const wanted = new Set(
		requiredSkills
			.filter((s): s is string => typeof s === 'string')
			.map((s) => s.trim().toLowerCase())
			.filter(Boolean)
	);
	if (wanted.size === 0) return {};

	const [versions, categories] = await Promise.all([
		db.query.profile_versions.findMany({
			where: eq(profile_versions.profile_id, profileId),
			columns: { id: true, slug: true, toggles: true },
			with: { extension_links: true },
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

	const result: Record<string, HiddenSkill[]> = {};
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
			const visibleCategories = new Set(filterOnTags(categories).map((c) => c.id));
			const visible = new Set<string>();
			for (const category of filterOnTags(categories)) {
				for (const skill of filterOnTags(category.tech_skills)) {
					const key = skill.name?.trim().toLowerCase();
					if (key) visible.add(key);
				}
			}

			// What the one-click action here would do, asked of the same function the
			// API route uses to do it.
			const target = versionSlug || SHOW_ON_ALL;

			const hidden: HiddenSkill[] = [];
			for (const [key, skill] of owned) {
				if (visible.has(key)) continue;

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

			if (hidden.length > 0) {
				result[hiddenSkillsKey(docType, versionSlug as string)] = hidden;
			}
		}
	}

	return result;
}
