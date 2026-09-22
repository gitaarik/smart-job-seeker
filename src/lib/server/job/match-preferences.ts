/**
 * The match preferences: what the applicant wants imported and scored, and the
 * one place that says which values are legal.
 *
 * Three consumers had grown two copies of the same knowledge. The config page
 * declared the option lists inline, under a comment saying "Keep in sync
 * manually for now", and `api/job-preferences` built the same update object
 * twice (once in PUT, once in PATCH) with the empty-array-to-null rule spelled
 * out in both. Adding `edit_match_config` would have made a third of each, and
 * a model held to a list that the form no longer offers proposes a value the
 * user cannot see — which is the failure `STATUS_VOCABULARY` exists to prevent
 * one table over.
 *
 * So the lists live here and the write lives here. The form, the REST route and
 * the capability all read the same names and go through the same upsert.
 *
 * These are NOT the taxonomy's canonical values. "Freelance" is a user-facing
 * preference that normalizes to "contract" for matching (see
 * `data/job-taxonomy.ts`); what is stored is the label, and the label is what
 * every consumer here compares.
 */

import { dbDirect as db } from '$lib/server/db';
import { eq } from 'drizzle-orm';
import { match_config } from '$lib/server/db/schema';

export const JOB_TYPE_OPTIONS = ['Full-time', 'Part-time', 'Contract', 'Freelance', 'Internship'];

export const EXPERIENCE_LEVEL_OPTIONS = ['Entry-level', 'Mid-level', 'Senior', 'Lead', 'Executive'];

export const WORK_LOCATION_OPTIONS = ['Remote', 'Hybrid', 'On-site'];

/** The columns a caller may patch. `date_updated` is this module's, not theirs. */
export interface MatchPreferenceValues {
	job_types?: string[] | null;
	experience_levels?: string[] | null;
	work_location?: string[] | null;
	locations?: string[] | null;
	remote_only?: boolean;
	match_community_jobs?: boolean;
	community_max_age_days?: number | null;
}

/** What a read gives back: every column, with the list ones never null. */
export interface MatchPreferences {
	id: number;
	job_types: string[];
	experience_levels: string[];
	work_location: string[];
	locations: string[];
	remote_only: boolean;
	match_community_jobs: boolean;
	community_max_age_days: number | null;
}

function shape(row: typeof match_config.$inferSelect): MatchPreferences {
	return {
		id: row.id,
		job_types: (row.job_types as string[] | null) ?? [],
		experience_levels: (row.experience_levels as string[] | null) ?? [],
		work_location: (row.work_location as string[] | null) ?? [],
		locations: (row.locations as string[] | null) ?? [],
		remote_only: row.remote_only,
		match_community_jobs: row.match_community_jobs,
		community_max_age_days: row.community_max_age_days ?? null
	};
}

/**
 * This profile's config, creating the empty row if it has none.
 *
 * Get-or-create rather than get-or-null, because every caller wants a row: the
 * page renders a form against one, and a capability has nothing to resolve
 * without one. The auto-create was already the page's behaviour and is kept
 * here so the capability cannot be the one door that refuses a profile which
 * has simply never opened the page.
 */
export async function readMatchPreferences(profileId: number): Promise<MatchPreferences> {
	const existing = await db.query.match_config.findFirst({
		where: eq(match_config.profile_id, profileId)
	});
	if (existing) return shape(existing);

	const [created] = await db
		.insert(match_config)
		.values({ profile_id: profileId, date_created: new Date(), date_updated: new Date() })
		.returning();
	return shape(created);
}

/**
 * Patch the config, creating the row if there is none.
 *
 * Partial by construction: a key that is absent leaves its column alone, and
 * only a key that is present is written. An empty array on one of the four list
 * columns is stored as NULL, because that is what "no preference" has always
 * meant to `eligibility.ts` and an empty JSON array would read as "a preference
 * satisfied by nothing".
 *
 * Scoped by profile, so a caller that forgot to authorize still cannot reach
 * another profile's row.
 */
export async function writeMatchPreferences(
	profileId: number,
	values: MatchPreferenceValues
): Promise<MatchPreferences> {
	const data: Record<string, unknown> = { date_updated: new Date() };

	for (const key of ['job_types', 'experience_levels', 'work_location', 'locations'] as const) {
		if (values[key] === undefined) continue;
		const list = values[key];
		data[key] = list && list.length > 0 ? list : null;
	}
	for (const key of ['remote_only', 'match_community_jobs', 'community_max_age_days'] as const) {
		if (values[key] === undefined) continue;
		data[key] = values[key];
	}

	const existing = await db.query.match_config.findFirst({
		where: eq(match_config.profile_id, profileId),
		columns: { id: true }
	});

	if (existing) {
		const [updated] = await db
			.update(match_config)
			.set(data)
			.where(eq(match_config.profile_id, profileId))
			.returning();
		return shape(updated);
	}

	const [created] = await db
		.insert(match_config)
		.values({ ...data, profile_id: profileId, date_created: new Date() })
		.returning();
	return shape(created);
}
