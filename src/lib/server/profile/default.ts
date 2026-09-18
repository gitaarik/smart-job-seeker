/**
 * Profile default helper module
 * Centralized functions for default profile logic
 */

import { dbDirect as db } from '$lib/server/db';
import { asc, desc, eq } from 'drizzle-orm';
import {
	certificates,
	config,
	education,
	highlights,
	languages,
	profiles,
	profile_field_variants,
	profile_versions,
	references,
	side_projects,
	side_project_achievements,
	side_project_technologies,
	tech_skills,
	tech_skill_categories,
	work_experiences,
	work_experience_achievements,
	work_experience_projects,
	work_experience_technologies
} from '$lib/server/db/schema';

/**
 * Standard include structure used across all profile queries.
 * Matches the pattern from profile-loader.ts and portfolio page.
 *
 * Every ordering here is a VALUE — `asc(table.column)` — and never a
 * `(t, { asc }) => ...` callback. Two separate reasons, and both bite silently:
 *
 * A callback needs a contextual type to infer `t` from, and this object has
 * none: it is hoisted, so TypeScript sees a bare object literal. Written as
 * callbacks the parameters had to be annotated `any`, which is what they were
 * until 2026-09-18 — two `no-explicit-any` each, and no check that `t.sort`
 * was a column of the right table.
 *
 * Hoisting is not optional, though. PROFILE_INCLUDE is `as const`, which turns
 * an INLINE array literal into a readonly tuple, and drizzle's `with` rejects
 * that. The failure is not local: the whole include stops satisfying the
 * expected shape, the query's return type degrades to the bare `profiles` row,
 * and every consumer loses `work_experiences`, `educations` and the rest.
 * Measured once at 40 new type errors across the public routes, from one
 * property. So the multi-key orderings are `const`s declared out here, which
 * keep their mutable `SQL[]` type when referenced.
 *
 * Nothing fails at runtime either way. The rows come back; only the types go.
 */
const FIELD_VARIANT_ORDER = [asc(profile_field_variants.sort), asc(profile_field_variants.id)];
const WORK_ORDER = [asc(work_experiences.sort), desc(work_experiences.start_date)];
const EDUCATION_ORDER = [asc(education.sort), desc(education.start_date)];
const SIDE_PROJECT_ORDER = [asc(side_projects.sort), desc(side_projects.start_date)];

const PROFILE_INCLUDE = {
	languages: { orderBy: asc(languages.sort) },
	highlights: { orderBy: asc(highlights.sort) },
	tech_skill_categories: {
		with: {
			tech_skills: { orderBy: asc(tech_skills.sort) }
		},
		orderBy: asc(tech_skill_categories.sort)
	},
	work_experiences: {
		with: {
			work_experience_achievements: { orderBy: asc(work_experience_achievements.sort) },
			work_experience_technologies: { orderBy: asc(work_experience_technologies.sort) },
			// Nothing renders a role's projects yet, but their name/description/
			// outcome are translatable — and both the overlay resolver and the
			// auto-translate endpoint walk the tree this include builds, so a
			// project left out here is a field the user can never translate.
			//
			// Their technologies are skill names like any other, and the tailoring
			// run reads them as part of what the applicant holds: a requirement
			// answered only by a project's stack was answered by nothing while the
			// skills block was the sole inventory.
			work_experience_projects: {
				with: { work_experience_project_technologies: true },
				orderBy: asc(work_experience_projects.sort)
			}
		},
		orderBy: WORK_ORDER
	},
	educations: { orderBy: EDUCATION_ORDER },
	side_projects: {
		with: {
			side_project_achievements: { orderBy: asc(side_project_achievements.sort) },
			side_project_technologies: { orderBy: asc(side_project_technologies.sort) }
		},
		orderBy: SIDE_PROJECT_ORDER
	},
	references: { orderBy: asc(references.sort) },
	certificates: { orderBy: asc(certificates.sort) },
	// Alternative wordings for the scalar profile fields. In the tree rather
	// than fetched by the resolver alone, for the same reason a role's projects
	// are: the auto-translate endpoint walks THIS include to find what can be
	// translated, and a variant left out of it is prose the applicant could
	// never translate — which on a Dutch document reads as the wrong language,
	// not as a missing feature.
	field_variants: { orderBy: FIELD_VARIANT_ORDER },
	profile_versions: {
		columns: {
			id: true,
			status: true,
			sort: true,
			date_created: true,
			date_updated: true,
			slug: true,
			name: true,
			profile_id: true,
			toggles: true
		},
		with: {
			extension_links: true,
			// The per-job include/exclude decisions a tailored version carries.
			// Loaded with the version rather than passed as a separate prop, so
			// every renderer that already resolves a version chain gets them for
			// free — see components/ProfileDisplay/profile-filter.ts.
			overrides: true
		},
		orderBy: asc(profile_versions.sort),
		where: eq(profile_versions.status, 'published')
	}
} as const;

/**
 * Get the default profile with all relations
 */
export async function getDefaultProfile() {
	// Get config to find default profile ID
	const configRecord = await db.query.config.findFirst({
		columns: { default_profile: true }
	});

	if (!configRecord?.default_profile) {
		return null;
	}

	// Fetch the profile with all relations
	return db.query.profiles.findFirst({
		where: eq(profiles.id, configRecord.default_profile),
		with: PROFILE_INCLUDE
	});
}

/**
 * Get profile by ID or fallback to default
 * @param profileId Optional profile ID
 * @returns Profile with all relations, or null if not found
 */
export async function getProfileOrDefault(profileId?: number) {
	if (profileId !== undefined) {
		const profile = await db.query.profiles.findFirst({
			where: eq(profiles.id, profileId),
			with: PROFILE_INCLUDE
		});
		if (profile) return profile;
	}

	return getDefaultProfile();
}

/**
 * Set a profile as default
 * @param profileId Profile ID to set as default
 */
export async function setDefaultProfile(profileId: number) {
	// Get or create config record
	const configRecord = await db.query.config.findFirst();

	if (configRecord) {
		// Update existing config
		return db
			.update(config)
			.set({ default_profile: profileId })
			.where(eq(config.id, configRecord.id));
	} else {
		// Create new config
		const [result] = await db.insert(config).values({ default_profile: profileId }).returning();
		return result;
	}
}

/**
 * Get default profile ID only (lightweight query for scripts)
 */
export async function getDefaultProfileId(): Promise<number | null> {
	const configRecord = await db.query.config.findFirst({
		columns: { default_profile: true }
	});

	return configRecord?.default_profile ?? null;
}

/**
 * Get profile by ID, slug, or default
 * @param identifier Optional profile identifier (ID or slug)
 * @returns Profile with all relations, or null if not found
 */
export async function getProfileByIdentifier(identifier?: string | number) {
	if (identifier === undefined) {
		return getDefaultProfile();
	}

	const id = typeof identifier === 'number' ? identifier : parseInt(String(identifier), 10);

	if (!isNaN(id)) {
		const profile = await db.query.profiles.findFirst({
			where: eq(profiles.id, id),
			with: PROFILE_INCLUDE
		});
		if (profile) return profile;
	}

	return db.query.profiles.findFirst({
		where: eq(profiles.slug, String(identifier)),
		with: PROFILE_INCLUDE
	});
}

// Export the standard include structure for use in other files
export { PROFILE_INCLUDE };

// Export type for profile with all relations
export type ProfileWithRelations = NonNullable<Awaited<ReturnType<typeof getDefaultProfile>>>;
