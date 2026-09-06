import type { Actions, PageServerLoad } from './$types';
import { fail } from '@sveltejs/kit';
import { dbDirect as db, queryRaw, sql } from '$lib/server/db';
import { eq, and, inArray, isNull, lte, or, desc } from 'drizzle-orm';
import {
	match_config,
	profiles,
	search_tasks,
	job_matches,
	applications
} from '$lib/server/db/schema';
import { activeStatuses } from '$lib/application-status';
import { sortApplications } from '$lib/application-ranking';
import { attachLastActivity } from '$lib/server/applications/activity';
import { today } from '$lib/application-records';
import { getMatchCounts } from '$lib/server/job/match-counts';
import { getProfileSkillLevels } from '$lib/server/job/match-utils';
import { saveJob, unsaveJob, rejectJob, unrejectJob } from '$lib/server/job/job-actions';
import { getSelectedProfileId } from '../profile/utils';

// Top Matches ranking: the stored jm.score is pure relevance and ignores how
// old a posting is, so without a decay a 90-day-old job outranks a fresher,
// nearly-as-good one. We rank by score decayed against job age and drop
// likely-dead listings past a hard floor.
//
// The first GRACE days count as equally fresh (no decay) — exponential decay
// is steepest at the start, and without a grace window a 3-day age gap can
// flip a 9-point relevance gap between two jobs that are both ~2 weeks old.
// Decay only starts biting once a posting is genuinely old.
//
// All three are deliberately tunable — re-check the live distribution via
// `npm run debug-match-stats` (GET /api/debug/match-stats) before changing them.
const TOP_MATCH_AGE_GRACE_DAYS = 14; // jobs this fresh rank on pure score
const TOP_MATCH_AGE_HALFLIFE_DAYS = 21; // ~3-week soft decay after the grace window
const TOP_MATCH_MAX_AGE_DAYS = 60; // hard floor: never surface jobs older than this (real age)

export const load: PageServerLoad = async ({ parent }) => {
	const layoutData = await parent();

	if (!layoutData.selectedProfile) {
		return {
			profileCompleteness: null,
			matchConfig: null,
			searchTasks: null,
			matchStats: null,
			topMatches: null,
			profileSkillLevels: {},
			activeApplications: []
		};
	}

	const profileId = layoutData.selectedProfile.id;

	// Fetch match config first — needed for visibility scope in getMatchCounts
	const matchConfig = await db.query.match_config.findFirst({
		where: eq(match_config.profile_id, profileId),
		columns: {
			id: true,
			job_types: true,
			experience_levels: true,
			work_location: true,
			locations: true,
			match_community_jobs: true
		}
	});

	const matchCommunityJobs = matchConfig?.match_community_jobs ?? false;

	const [
		profileData,
		searchTasksList,
		[sharedMatchCounts, curationStatsRaw],
		topMatchesRaw,
		profileSkillLevels,
		activeApplicationRows
	] = await Promise.all([
		// Lightweight profile fields for completeness check
		db.query.profiles.findFirst({
			where: eq(profiles.id, profileId),
			columns: {
				title: true,
				headline: true,
				city: true,
				country_code: true
			},
			with: {
				tech_skill_categories: {
					columns: { id: true },
					with: { tech_skills: { columns: { id: true } } }
				},
				work_experiences: { columns: { id: true } },
				educations: { columns: { id: true } }
			}
		}),

		// Search tasks for this profile
		db.query.search_tasks.findMany({
			where: eq(search_tasks.profile_id, profileId),
			columns: {
				id: true,
				note: true,
				is_active: true,
				status: true,
				status_message: true,
				last_run: true,
				last_run_jobs_found: true
			},
			with: {
				job_platform: { columns: { name: true } }
			},
			orderBy: desc(search_tasks.last_run)
		}),

		// Match stats — "total" uses shared getMatchCounts (same as Match Progress page)
		// while strong/saved/newUnreviewed still need job_statuses join
		Promise.all([
			getMatchCounts(profileId, matchCommunityJobs),
			queryRaw<{ strong80: bigint; strong70: bigint; saved: bigint; new_unreviewed: bigint }>(sql`
        SELECT
          COUNT(*) FILTER (WHERE jm.score >= 80 AND COALESCE(js.status, 'new') != 'rejected') as strong80,
          COUNT(*) FILTER (WHERE jm.score >= 70 AND COALESCE(js.status, 'new') != 'rejected') as strong70,
          COUNT(*) FILTER (WHERE js.status = 'saved') as saved,
          COUNT(*) FILTER (WHERE js.id IS NULL AND jm.score > 0) as new_unreviewed
        FROM job_matches jm
        LEFT JOIN job_statuses js ON js.profile_id = jm.profile_id AND js.job_id = jm.job_id
        WHERE jm.profile_id = ${profileId}
      `)
		]),

		// Top 5 matches: score (>= 70, excluding rejected) decayed by job age so
		// stale postings sink below fresher ones, with a hard age floor that drops
		// likely-filled listings. age_days prefers the board's posted date and
		// falls back to when we first scraped it; GREATEST(0, …) guards against
		// bogus future dates blowing up the decay. The floor uses real age; the
		// decay subtracts the grace window first. See constants above.
		queryRaw<{ id: number }>(sql`
      SELECT id FROM (
        SELECT
          jm.id AS id,
          jm.score AS score,
          GREATEST(0, EXTRACT(epoch FROM now() - COALESCE(j.date_posted::timestamptz, j.date_created)) / 86400.0) AS age_days
        FROM job_matches jm
        JOIN jobs j ON j.id = jm.job_id
        LEFT JOIN job_statuses js ON js.profile_id = jm.profile_id AND js.job_id = jm.job_id
        WHERE jm.profile_id = ${profileId}
        AND jm.score >= 70
        AND COALESCE(js.status, 'new') != 'rejected'
      ) ranked
      WHERE age_days <= ${TOP_MATCH_MAX_AGE_DAYS}
      ORDER BY score * exp(-GREATEST(0, age_days - ${TOP_MATCH_AGE_GRACE_DAYS}) / ${TOP_MATCH_AGE_HALFLIFE_DAYS}) DESC
      LIMIT 5
    `).then(async (ids) => {
			if (ids.length === 0) return [];
			const rows = await db.query.job_matches.findMany({
				where: inArray(
					job_matches.id,
					ids.map((r) => r.id)
				),
				with: {
					job: {
						columns: {
							id: true,
							title: true,
							company: true,
							office_location: true,
							source_url: true,
							job_description: true,
							salary_min: true,
							salary_max: true,
							salary_currency: true,
							salary_period: true,
							skills_required: true,
							work_location: true,
							job_types: true,
							experience_levels: true,
							date_posted: true,
							date_created: true
						},
						with: {
							job_platform: { columns: { id: true, name: true } }
						}
					}
				}
			});
			// Preserve the decay-ranked order from the raw query above — the
			// inArray fetch returns rows in an arbitrary order.
			const rank = new Map(ids.map((r, i) => [r.id, i]));
			return rows.sort((a, b) => (rank.get(a.id) ?? 0) - (rank.get(b.id) ?? 0));
		}),

		// Skill levels for match card highlighting
		getProfileSkillLevels(profileId),

		// Active applications
		db.query.applications.findMany({
			where: and(
				eq(applications.profile_id, profileId),
				inArray(applications.status, activeStatuses),
				// A snoozed application is deliberately not on the dashboard — that
				// is the whole point of parking it. It returns on its own when
				// `snoozed_until` falls due; nothing has to clear the column.
				or(isNull(applications.snoozed_until), lte(applications.snoozed_until, today()))
			),
			with: {
				job: {
					with: {
						job_platform: true
					}
				}
			},
			// Ordered by `sortApplications` below, not here. `date_updated` used to
			// be the order, which put whichever application was last *edited* on
			// top — a cover letter draft outranking an interview tomorrow.
			orderBy: desc(applications.date_created)
		})
	]);

	// The same rule the pipeline list uses, so the dashboard's shortlist is the
	// top of that list rather than a second opinion about what matters.
	const activeApplications = sortApplications(
		await attachLastActivity(activeApplicationRows),
		'smart',
		today()
	);

	// Process match stats — total from shared getMatchCounts (same as Match Progress page)
	const curationStats = curationStatsRaw[0];
	const strong80 = Number(curationStats?.strong80 ?? 0);
	const strong70 = Number(curationStats?.strong70 ?? 0);
	// Prefer 80+ threshold, fall back to 70+ if fewer than 3 strong matches at 80+
	const useHighThreshold = strong80 >= 3;
	const matchStats = {
		total: sharedMatchCounts.matchedCount,
		strong: useHighThreshold ? strong80 : strong70,
		strongThreshold: useHighThreshold ? 80 : 70,
		saved: Number(curationStats?.saved ?? 0),
		newUnreviewed: Number(curationStats?.new_unreviewed ?? 0)
	};

	// Compute profile completeness
	const totalSkills =
		profileData?.tech_skill_categories?.reduce((sum, cat) => sum + cat.tech_skills.length, 0) ?? 0;

	const hasWorkExperience = (profileData?.work_experiences?.length ?? 0) > 0;
	const hasEducation = (profileData?.educations?.length ?? 0) > 0;

	const profileCompleteness = {
		hasSkills: totalSkills > 0,
		skillCount: totalSkills,
		hasMatchConfig:
			matchConfig != null &&
			((matchConfig.job_types as string[]) ?? []).length > 0 &&
			((matchConfig.work_location as string[]) ?? []).length > 0,
		hasWorkExperience,
		hasEducation,
		hasExperienceOrEducation: hasWorkExperience || hasEducation,
		hasTitle: !!profileData?.title,
		hasHeadline: !!profileData?.headline,
		hasLocation: !!(profileData?.city && profileData?.country_code)
	};

	// Process search tasks
	const searchTasks = {
		tasks: searchTasksList,
		totalCount: searchTasksList.length,
		activeCount: searchTasksList.filter((s) => s.is_active).length,
		lastRun: searchTasksList.find((s) => s.last_run)?.last_run ?? null,
		totalJobsFound: searchTasksList.reduce((sum, s) => sum + (s.last_run_jobs_found ?? 0), 0)
	};

	// Process top matches (filter out matches where the job was deleted)
	const topMatches = topMatchesRaw
		.filter((m) => m.job != null)
		.map((m) => ({
			id: m.id,
			score: m.score,
			match_summary: m.match_summary,
			matched_skills: m.matched_skills,
			skill_match_percentage: m.skill_match_percentage,
			job: m.job!
		}));

	return {
		profileCompleteness,
		matchConfig,
		searchTasks,
		matchStats,
		topMatches,
		profileSkillLevels,
		activeApplications
	};
};

function parseJobId(formData: FormData) {
	const jobId = parseInt(formData.get('jobId') as string);
	if (isNaN(jobId)) return null;
	return jobId;
}

async function getAuthProfileId(locals: App.Locals, cookies: import('@sveltejs/kit').Cookies) {
	const user = locals.user;
	if (!user) return null;
	return getSelectedProfileId(cookies, user.id);
}

export const actions: Actions = {
	saveJob: async ({ request, locals, cookies }) => {
		const profileId = await getAuthProfileId(locals, cookies);
		if (!profileId) return fail(401, { error: 'Not authenticated' });
		const jobId = parseJobId(await request.formData());
		if (!jobId) return fail(400, { error: 'Invalid job ID' });
		return saveJob(profileId, jobId);
	},

	unsaveJob: async ({ request, locals, cookies }) => {
		const profileId = await getAuthProfileId(locals, cookies);
		if (!profileId) return fail(401, { error: 'Not authenticated' });
		const jobId = parseJobId(await request.formData());
		if (!jobId) return fail(400, { error: 'Invalid job ID' });
		return unsaveJob(profileId, jobId);
	},

	rejectJob: async ({ request, locals, cookies }) => {
		const profileId = await getAuthProfileId(locals, cookies);
		if (!profileId) return fail(401, { error: 'Not authenticated' });
		const jobId = parseJobId(await request.formData());
		if (!jobId) return fail(400, { error: 'Invalid job ID' });
		return rejectJob(profileId, jobId);
	},

	unrejectJob: async ({ request, locals, cookies }) => {
		const profileId = await getAuthProfileId(locals, cookies);
		if (!profileId) return fail(401, { error: 'Not authenticated' });
		const jobId = parseJobId(await request.formData());
		if (!jobId) return fail(400, { error: 'Invalid job ID' });
		return unrejectJob(profileId, jobId);
	}
};
