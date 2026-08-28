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
 * Nor is the skills block the only place an answer can render. A role's TECH
 * line is skill names, and on the templates that print one it is the same page:
 * asking only the skills block called a skill missing that a reader and a
 * keyword search both find. Whether it prints is the template's answer, so the
 * caller passes one — see CoverageScope.template.
 *
 * Running that filter for every candidate document also answers a second
 * question for free: not just what each one HIDES, but how much of the job it
 * COVERS — which is what lets the application page recommend a version instead
 * of presenting an empty picker. Same loop, same filter, one more counter; see
 * getVersionCoverage below and planning/TAILORED-VERSIONS.md § Phase 1.
 */

import { dbDirect as db } from '$lib/server/db';
import { and, asc, eq, isNull, or } from 'drizzle-orm';
import {
	profile_versions,
	tech_skill_categories,
	tech_skills,
	work_experience_technologies,
	work_experiences
} from '$lib/server/db/schema';
import { createProfileFilter } from '$lib/components/ProfileDisplay/profile-filter';
import { BASE_TEMPLATE_TAGS, SHOW_ON_ALL, tagsForShowOn } from '$lib/profile-visibility';
import { templatePrintsTechnologies } from '$lib/resume-templates';
import { OVERRIDE_ENTITIES } from '$lib/version-overrides';
import {
	carrierOf,
	hiddenSkillsKey,
	type HiddenSkill,
	type VersionCoverage
} from '$lib/version-coverage';

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
	/**
	 * The presentation template the document is recorded as going out in.
	 *
	 * A skills question with a template answer: the generic renderer prints a
	 * role's TECH line and the built-in layout prints none, so a required skill
	 * listed against a role is on the page in one and missing from the other.
	 *
	 * It is the RECORDED template, not whatever the picker is currently showing
	 * — the map is precomputed per (base template × version) and the picker is
	 * unsaved client state. Flipping to a template of the other kind without
	 * saving leaves these numbers describing the saved one; saving re-runs the
	 * load. Making it live means giving the map a third axis, which the sibling
	 * maps keyed alongside it (`outOfReach`, `exclusions`, `heldBackParents`)
	 * would have to grow too.
	 */
	template?: string | null;
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
	// Only fetched for a template that renders them, which is no profile's
	// default and most profiles never.
	const printsTech = templatePrintsTechnologies(scope.template);
	const [versions, categories, roles] = await Promise.all([
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
		}),
		printsTech
			? db.query.work_experiences.findMany({
					where: eq(work_experiences.profile_id, profileId),
					columns: { id: true, tags: true },
					with: {
						work_experience_technologies: {
							columns: { id: true, name: true, tags: true },
							orderBy: asc(work_experience_technologies.sort)
						}
					},
					orderBy: asc(work_experiences.sort)
				})
			: Promise.resolve([])
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
			// Kept as a list too: a hidden skill's name may already be on the page
			// inside another one, and saying which needs the name, not the key.
			const printed: string[] = [];
			for (const category of keptCategories) {
				for (const skill of filterOnTags(category.tech_skills, OVERRIDE_ENTITIES.skill)) {
					const key = skill.name?.trim().toLowerCase();
					if (!key) continue;
					visible.add(key);
					printed.push(skill.name!);
				}
			}

			// The skills block is not the only place a skill name reaches the page.
			// On a template that renders a role's TECH line, a skill listed there is
			// shown by this document, and reporting it as hidden asked the applicant
			// to fix an omission that was not one — then offered a button whose only
			// effect would be to print the word a second time.
			for (const role of filterOnTags(roles, OVERRIDE_ENTITIES.workExperience)) {
				for (const entry of filterOnTags(
					role.work_experience_technologies,
					OVERRIDE_ENTITIES.technology
				)) {
					const key = entry.name?.trim().toLowerCase();
					if (!key) continue;
					visible.add(key);
					printed.push(entry.name!);
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
					liftable: lifted.length > 0 && visibleCategories.has(skill.categoryId),
					carriedBy: carrierOf(skill.name, printed)
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
