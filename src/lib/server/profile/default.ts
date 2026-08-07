/**
 * Profile default helper module
 * Centralized functions for default profile logic
 */

import { dbDirect as db } from '$lib/server/db';
import { eq } from 'drizzle-orm';
import { profiles, config } from '$lib/server/db/schema';

/**
 * Standard include structure used across all profile queries
 * Matches the pattern from profile-loader.ts and portfolio page
 */
const PROFILE_INCLUDE = {
	languages: { orderBy: (t: any, { asc }: any) => asc(t.sort) },
	highlights: { orderBy: (t: any, { asc }: any) => asc(t.sort) },
	tech_skill_categories: {
		with: {
			tech_skills: { orderBy: (t: any, { asc }: any) => asc(t.sort) }
		},
		orderBy: (t: any, { asc }: any) => asc(t.sort)
	},
	work_experiences: {
		with: {
			work_experience_achievements: { orderBy: (t: any, { asc }: any) => asc(t.sort) },
			work_experience_technologies: { orderBy: (t: any, { asc }: any) => asc(t.sort) }
		},
		orderBy: (t: any, { asc, desc }: any) => [asc(t.sort), desc(t.start_date)]
	},
	educations: { orderBy: (t: any, { asc, desc }: any) => [asc(t.sort), desc(t.start_date)] },
	side_projects: {
		with: {
			side_project_achievements: { orderBy: (t: any, { asc }: any) => asc(t.sort) },
			side_project_technologies: { orderBy: (t: any, { asc }: any) => asc(t.sort) }
		},
		orderBy: (t: any, { asc, desc }: any) => [asc(t.sort), desc(t.start_date)]
	},
	references: { orderBy: (t: any, { asc }: any) => asc(t.sort) },
	certificates: { orderBy: (t: any, { asc }: any) => asc(t.sort) },
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
			extension_links: true
		},
		orderBy: (t: any, { asc }: any) => asc(t.sort),
		where: (t: any, { eq }: any) => eq(t.status, 'published')
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
