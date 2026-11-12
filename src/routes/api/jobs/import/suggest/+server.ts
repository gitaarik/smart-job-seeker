/**
 * POST /api/jobs/import/suggest
 *
 * Asks the LLM to rank every suggestable job platform for the user's
 * profile and pre-fill a per-platform task draft. The LLM's scope is
 * narrow: keywords + ranking + a short note. Filters are computed
 * deterministically from the user's match_config preferences (see
 * preferences-to-filters.ts) — that translation is a pure taxonomy lookup
 * and was previously being done by the LLM, which leaked filter values
 * like "senior" into the keyword string.
 *
 * The scraper drives each platform's search form at run time, silently
 * drops filters the form doesn't expose, and records misses to
 * `job_platforms.unsupported_filters`. We feed that list back in here both
 * to strip already-known-unsupported pairs before they reach the prompt
 * and to surface the overlap so the LLM can downgrade relevance.
 *
 * A career-site feed platform (`fetch_mode = 'feed'`, planning/ATS-FEEDS.md)
 * has no search form: the worker runs the keywords as a full-text query over
 * the ATS corpus. It is suggestable without a `search_page_url`, the prompt
 * sees the size of its corpus instead of a form track record, and its draft
 * carries a `search_location` built from the user's preferred locations.
 *
 * Returns task drafts the client form can save: platform_id, platform name
 * (for display), keywords, note, relevance, filters. The user can edit any
 * field before saving.
 */
import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { dbDirect as db } from '$lib/server/db';
import { and, asc, eq, gt, isNotNull, lt, or, sql } from 'drizzle-orm';
import { job_platforms, match_config, search_tasks } from '$lib/server/db/schema';
import { requireAuth } from '$lib/server/utils/api-helpers';
import { getSelectedProfileId } from '../../../../(app)/profile/utils';
import { createAndGenerateAiChat } from '$lib/server/ai-chat/utils';
import { SUGGEST_PROFILE_FIELDS } from '$lib/server/ai-chat/profile-fields';
import { suggestImportTasksSchema } from '$lib/server/schemas/ai-prompt-schemas';
import {
	SEARCH_FILTER_DEFINITIONS,
	type SearchFilterName,
	type SearchFilterValue
} from '$lib/job-platforms/search-filters';
import {
	preferencesToFilters,
	stripUnsupportedFilters,
	unsupportedOverlap
} from '$lib/job-platforms/preferences-to-filters';

type SuggestablePlatform = {
	id: number;
	key: string;
	name: string;
	url: string;
	search_page_url: string | null;
	login_page_url: string | null;
	/** `browser` drives the site's search form; `feed` queries the ATS corpus the worker sweeps. */
	fetch_mode: string;
	success_count: number;
	failure_count: number;
	unsupported_filters: Record<string, string[]>;
	/** For a feed platform: open postings published in the last 30 days behind it. */
	corpus_30d: number | null;
};

/**
 * Failed runs, with no success ever, that mark a platform as not working.
 * Low enough to catch a board that has never once produced a job, high
 * enough that a bad afternoon does not retire a working one.
 */
const DEAD_PLATFORM_FAILURES = 10;

type PreferenceConfig = {
	job_types: string[];
	experience_levels: string[];
	work_location: string[];
	locations: string[];
	remote_only: boolean | null;
};

type PlatformFilterPlan = {
	platform: SuggestablePlatform;
	filters: Record<string, SearchFilterValue>;
	overlap: Record<string, string[]>;
};

async function fetchSuggestablePlatforms(
	scopeToPlatformId?: number
): Promise<SuggestablePlatform[]> {
	// A platform is suggestable when it has a search_page_url configured —
	// the scraper needs it to drive the form — or when it is a career-site feed
	// (planning/ATS-FEEDS.md), which has no form: the worker queries the ATS
	// corpus with the keywords. Ordered by id for determinism. When
	// scopeToPlatformId is set, restrict to just that one row so the LLM ranks
	// a single platform (used by the "suggest one task for this specific
	// platform" callsite).
	const conditions = [
		or(isNotNull(job_platforms.search_page_url), eq(job_platforms.fetch_mode, 'feed'))!,
		eq(job_platforms.status, 'published')
	];
	// ...and when it has not already been proven not to work. `success_count`
	// and `failure_count` have been accumulating on these rows all along and
	// were never consulted, so the ranking could not tell a working board from
	// a dead one: X-Team (0/90), We Work Remotely (0/61), Welcome to the
	// Jungle (0/43) and Arc.dev (0/23) were all live suggestions on 217 runs
	// that produced no jobs between them.
	//
	// The bar is deliberately low. A single success keeps a platform in (a
	// flaky board is still a board), and one that has never been tried is
	// unproven rather than dead, so it stays too — with its record in the
	// prompt so the model can rank it accordingly.
	if (scopeToPlatformId === undefined) {
		conditions.push(
			or(
				gt(job_platforms.success_count, 0),
				lt(job_platforms.failure_count, DEAD_PLATFORM_FAILURES)
			)!
		);
	}
	if (scopeToPlatformId !== undefined) {
		conditions.push(eq(job_platforms.id, scopeToPlatformId));
	}
	const rows = await db
		.select({
			id: job_platforms.id,
			key: job_platforms.key,
			name: job_platforms.name,
			url: job_platforms.url,
			search_page_url: job_platforms.search_page_url,
			login_page_url: job_platforms.login_page_url,
			fetch_mode: job_platforms.fetch_mode,
			success_count: job_platforms.success_count,
			failure_count: job_platforms.failure_count,
			unsupported_filters: job_platforms.unsupported_filters
		})
		.from(job_platforms)
		.where(and(...conditions))
		.orderBy(asc(job_platforms.id));
	const corpus = rows.some((r) => r.fetch_mode === 'feed') ? await fetchFeedCorpusSizes() : null;
	return rows.map((r) => ({
		...r,
		corpus_30d: r.fetch_mode === 'feed' ? (corpus?.get(r.key) ?? 0) : null
	}));
}

/**
 * How much a feed has to search: open postings of the last 30 days per
 * provider. A feed platform's `key` is its provider in `ats_boards`. The
 * number goes into the prompt in place of a browser platform's track record,
 * which a feed does not accumulate the same way: a feed run never fails on a
 * form, it only finds more or fewer postings.
 */
async function fetchFeedCorpusSizes(): Promise<Map<string, number>> {
	const result = await db.execute(
		sql`SELECT b.provider, count(*)::int AS open_30d
		    FROM ats_postings p JOIN ats_boards b ON b.id = p.board_id
		    WHERE p.closed_at IS NULL AND p.published_at > now() - interval '30 days'
		    GROUP BY b.provider`
	);
	return new Map(
		(result.rows as { provider: string; open_30d: number }[]).map((r) => [r.provider, r.open_30d])
	);
}

/**
 * The "where" a feed task starts with: the user's preferred locations as the
 * task form's free text, plus "remote" when their preferences say so, which
 * admits remote postings from any country next to the countries listed. The
 * feed run reads countries out of this text and says in its log what it
 * could not read. No locations means every country, so no "remote" is needed
 * either: the work_location filter already carries that.
 */
export function _feedSearchLocation(preferences: PreferenceConfig | null): string | null {
	const locations = (preferences?.locations ?? []).map((l) => l.trim()).filter(Boolean);
	if (!locations.length) return null;
	const wantsRemote =
		preferences?.remote_only === true ||
		(preferences?.work_location ?? []).some((w) => w.toLowerCase() === 'remote');
	const alreadyRemote = locations.some((l) => /^(remote|anywhere|worldwide|global)$/i.test(l));
	return [...locations, ...(wantsRemote && !alreadyRemote ? ['remote'] : [])].join(', ');
}

type ExistingTask = {
	platform_id: number | null;
	platform_name: string | null;
	search_term: string | null;
	note: string | null;
};

async function fetchExistingTasks(profileId: number): Promise<ExistingTask[]> {
	// All tasks for this profile, with platform name for the prompt. The LLM
	// uses (platform_id, search_term) to detect near-duplicates; the note is
	// included for context only.
	const rows = await db.query.search_tasks.findMany({
		where: eq(search_tasks.profile_id, profileId),
		columns: {
			platform_id: true,
			search_term: true,
			note: true
		},
		with: {
			job_platform: { columns: { name: true } }
		}
	});
	return rows.map((r) => ({
		platform_id: r.platform_id,
		platform_name: r.job_platform?.name ?? null,
		search_term: r.search_term,
		note: r.note
	}));
}

function renderExistingTasksForPrompt(tasks: ExistingTask[]): string {
	if (tasks.length === 0) {
		return '(none — the user has no import tasks yet, so no duplicates to avoid)';
	}
	const lines: string[] = [];
	for (const t of tasks) {
		if (t.platform_id === null) continue;
		const name = t.platform_name ?? '(unknown platform)';
		const kw = t.search_term ? `"${t.search_term}"` : '(no keywords)';
		const note = t.note ? ` — note: "${t.note}"` : '';
		lines.push(`- platform_id=${t.platform_id} "${name}": keywords=${kw}${note}`);
	}
	return lines.length > 0
		? lines.join('\n')
		: '(none — the user has no import tasks yet, so no duplicates to avoid)';
}

async function fetchPreferences(profileId: number): Promise<PreferenceConfig | null> {
	const row = await db.query.match_config.findFirst({
		where: eq(match_config.profile_id, profileId),
		columns: {
			job_types: true,
			experience_levels: true,
			work_location: true,
			locations: true,
			remote_only: true
		}
	});
	if (!row) return null;
	return {
		job_types: (row.job_types as string[] | null) ?? [],
		experience_levels: (row.experience_levels as string[] | null) ?? [],
		work_location: (row.work_location as string[] | null) ?? [],
		locations: (row.locations as string[] | null) ?? [],
		remote_only: row.remote_only ?? null
	};
}

/**
 * For each platform, compute the canonical filter set the scraper will
 * apply (user preferences minus that platform's known-unsupported pairs)
 * and record the overlap that got dropped. The overlap is what the prompt
 * surfaces so the LLM can penalize relevance.
 */
function planFiltersPerPlatform(
	platforms: SuggestablePlatform[],
	preferences: PreferenceConfig | null
): PlatformFilterPlan[] {
	const userFilters = preferences ? preferencesToFilters(preferences) : {};
	return platforms.map((platform) => ({
		platform,
		filters: stripUnsupportedFilters(userFilters, platform.unsupported_filters),
		overlap: unsupportedOverlap(userFilters, platform.unsupported_filters)
	}));
}

function renderFilters(filters: Record<string, SearchFilterValue>): string {
	const entries = Object.entries(filters);
	if (entries.length === 0) return '(none — no matching preferences)';
	return entries
		.map(([name, value]) => {
			const values = Array.isArray(value) ? value : [value];
			return `${name}: [${values.join(', ')}]`;
		})
		.join('; ');
}

function renderOverlap(overlap: Record<string, string[]>): string | null {
	const entries = Object.entries(overlap);
	if (entries.length === 0) return null;
	return entries.map(([name, values]) => `${name}: [${values.join(', ')}]`).join('; ');
}

/**
 * How this platform has actually performed, in words the prompt can rank on.
 * Ratios beat raw counts here: "9 of 10 runs" is a judgement the model can
 * make, where "success_count=9" invites it to treat the number as popularity.
 */
function renderTrackRecord(platform: SuggestablePlatform): string {
	const runs = platform.success_count + platform.failure_count;
	if (runs === 0) return 'never run yet (unproven — do not rank above a platform with a record)';
	const rate = Math.round((platform.success_count / runs) * 100);
	return `${platform.success_count} of ${runs} runs returned jobs (${rate}%)`;
}

function renderPlatformsForPrompt(plans: PlatformFilterPlan[]): string {
	const lines: string[] = [];
	for (const plan of plans) {
		const { platform } = plan;
		lines.push(`- platform_id=${platform.id}: "${platform.name}" (key=${platform.key})`);
		if (platform.fetch_mode === 'feed') {
			lines.push(
				`    Career-site feed, no browser: searches ${(platform.corpus_30d ?? 0).toLocaleString('en-US')} postings published in the last 30 days by companies hiring through ${platform.name}. Keywords are matched as whole words against title, company and posting text, so use concrete role and technology terms. Needs no sign-in or device. International; strongest for remote and English-speaking markets.`
			);
			lines.push(`    Filters applied by the feed query: ${renderFilters(plan.filters)}`);
			continue;
		}
		lines.push(`    Track record: ${renderTrackRecord(platform)}`);
		if (platform.login_page_url) {
			lines.push(
				`    Requires a sign-in: the user must add credentials before this can run unattended.`
			);
		}
		lines.push(`    Filters applied by scraper: ${renderFilters(plan.filters)}`);
		const overlap = renderOverlap(plan.overlap);
		if (overlap) {
			lines.push(`    Unsupported overlap (penalize relevance): ${overlap}`);
		}
	}
	return lines.join('\n');
}

/**
 * Light sanity check on the LLM's keyword string: drop any token that's a
 * label or value_key for a filter we've already applied. This is the last
 * line of defense against the senior-in-keywords class of leak — the
 * prompt tells the model not to do it, this enforces it.
 *
 * Token matching is whole-word, case-insensitive. Removes the token and
 * trims excess whitespace; if everything gets stripped, returns null.
 */
function scrubKeywords(
	keywords: string | null,
	appliedFilters: Record<string, SearchFilterValue>
): string | null {
	if (keywords === null) return null;
	const banned = collectBannedTokens(appliedFilters);
	if (banned.size === 0) return keywords;
	const scrubbed = keywords
		.split(/(\s+)/)
		.map((part) => (banned.has(part.trim().toLowerCase()) ? '' : part))
		.join('')
		.replace(/\s+/g, ' ')
		.trim();
	return scrubbed.length > 0 ? scrubbed : null;
}

function collectBannedTokens(filters: Record<string, SearchFilterValue>): Set<string> {
	const banned = new Set<string>();
	for (const [name, value] of Object.entries(filters)) {
		if (!(name in SEARCH_FILTER_DEFINITIONS)) continue;
		const def = SEARCH_FILTER_DEFINITIONS[name as SearchFilterName];
		const values = Array.isArray(value) ? value : [value];
		for (const valueKey of values) {
			banned.add(valueKey.toLowerCase());
			const label = def.values[valueKey];
			if (label) banned.add(label.toLowerCase());
		}
	}
	return banned;
}

export interface SuggestedTaskDraft {
	platform_id: number;
	platform: string;
	platform_name: string;
	platform_url: string;
	keywords: string | null;
	note: string;
	relevance: 'high' | 'medium' | 'low';
	filters: Record<string, SearchFilterValue>;
	/** Whether the platform has a login page, so the card can say so up front. */
	needs_login: boolean;
	/** `feed` for a career-site feed: no browser, device or sign-in; the card says so. */
	fetch_mode: 'browser' | 'feed';
	/** A feed task's "where": countries and "remote", from the user's preferences; null for every country. */
	search_location: string | null;
	/** Runs that returned jobs, and runs attempted. Both zero = never tried. */
	successes: number;
	attempts: number;
}

export interface SuggestResult {
	ok: true;
	tasks: SuggestedTaskDraft[];
	message?: string;
}

export interface SuggestError {
	ok: false;
	status: number;
	message: string;
}

/**
 * Run the import-task suggester for a given profile. Pure function over a
 * profile id — no SvelteKit/auth dependencies — so the dev `suggest-task.ts`
 * script can call it directly. The HTTP handler is a thin wrapper that adds
 * auth + query-param parsing.
 */
export async function _runSuggester(
	profileId: number,
	scopeToPlatformId?: number
): Promise<SuggestResult | SuggestError> {
	const [platforms, preferences, existingTasks] = await Promise.all([
		fetchSuggestablePlatforms(scopeToPlatformId),
		fetchPreferences(profileId),
		fetchExistingTasks(profileId)
	]);
	if (platforms.length === 0) {
		return {
			ok: false,
			status: scopeToPlatformId !== undefined ? 404 : 503,
			message:
				scopeToPlatformId !== undefined
					? `Platform ${scopeToPlatformId} is not suggestable (not published, or a browser platform without a search_page_url)`
					: 'No suggestable platforms configured'
		};
	}

	const plans = planFiltersPerPlatform(platforms, preferences);
	const platformsList = renderPlatformsForPrompt(plans);
	const existingTasksList = renderExistingTasksForPrompt(existingTasks);
	const planById = new Map(plans.map((p) => [p.platform.id, p]));

	const result = await createAndGenerateAiChat(
		profileId,
		'suggest_import_tasks',
		{
			platforms_list: platformsList,
			existing_tasks_list: existingTasksList
		},
		undefined,
		{
			profileDataFields: SUGGEST_PROFILE_FIELDS
		}
	);

	if (!result.success || !result.aiChat?.response) {
		return {
			ok: false,
			status: 422,
			message: result.message || 'Failed to generate suggestions'
		};
	}

	let parsed: unknown;
	try {
		parsed = JSON.parse(result.aiChat.response);
	} catch {
		return { ok: false, status: 502, message: 'AI returned non-JSON response' };
	}

	const validated = suggestImportTasksSchema.safeParse(parsed);
	if (!validated.success) {
		return { ok: false, status: 502, message: 'AI response failed validation' };
	}

	// Merge the LLM's keywords/note/relevance with the server-computed
	// filters. Drop any suggestion referencing an unknown platform_id —
	// defensive against schema-shape-valid but ID-hallucinating responses.
	const tasks: SuggestedTaskDraft[] = [];
	const droppedIds: number[] = [];
	for (const task of validated.data.tasks) {
		const plan = planById.get(task.platform_id);
		if (!plan) {
			droppedIds.push(task.platform_id);
			continue;
		}
		tasks.push({
			platform_id: plan.platform.id,
			platform: plan.platform.key,
			platform_name: plan.platform.name,
			// Prefer the scraper's actual entry URL; fall back to the platform
			// home if no search-page URL is configured.
			platform_url: plan.platform.search_page_url ?? plan.platform.url,
			keywords: scrubKeywords(task.keywords, plan.filters),
			note: task.note,
			relevance: task.relevance,
			filters: plan.filters,
			needs_login: !!plan.platform.login_page_url,
			fetch_mode: plan.platform.fetch_mode === 'feed' ? 'feed' : 'browser',
			search_location:
				plan.platform.fetch_mode === 'feed' ? _feedSearchLocation(preferences) : null,
			successes: plan.platform.success_count,
			attempts: plan.platform.success_count + plan.platform.failure_count
		});
	}
	if (droppedIds.length > 0) {
		console.warn(
			`[suggest_import_tasks] Dropped ${droppedIds.length} task(s) ` +
				`referencing invalid platform_ids: [${droppedIds.join(', ')}]. ` +
				`Valid IDs offered: [${[...planById.keys()].join(', ')}].`
		);
	}

	// Empty tasks is a valid outcome now that the LLM skips near-duplicates of
	// existing tasks. Distinguish "covered everything" from "fresh slate but
	// model returned nothing" so the client can show appropriate copy.
	const message =
		tasks.length === 0
			? existingTasks.length > 0
				? 'Your existing tasks already cover the suggestable platforms — no new ideas right now.'
				: 'AI returned no usable suggestions'
			: undefined;

	return { ok: true, tasks, message };
}

export const POST: RequestHandler = async ({ cookies, locals, url }) => {
	const user = requireAuth(locals);

	const profileId = await getSelectedProfileId(cookies, user.id);
	if (!profileId) {
		return json({ success: false, message: 'No active profile selected' }, { status: 400 });
	}

	// Optional ?platform_id=<n> narrows the suggestion to a single platform.
	// Useful when the caller already knows which platform they want a task
	// for (e.g. the "add a task for Indeed" UI), so the LLM doesn't burn
	// tokens ranking platforms we're going to discard.
	let scopeToPlatformId: number | undefined;
	const rawPlatformId = url.searchParams.get('platform_id');
	if (rawPlatformId !== null) {
		const parsed = Number(rawPlatformId);
		if (!Number.isInteger(parsed) || parsed <= 0) {
			return json(
				{ success: false, message: 'platform_id must be a positive integer' },
				{ status: 400 }
			);
		}
		scopeToPlatformId = parsed;
	}

	const result = await _runSuggester(profileId, scopeToPlatformId);
	if (!result.ok) {
		return json({ success: false, message: result.message }, { status: result.status });
	}
	return json({ success: true, tasks: result.tasks, message: result.message });
};
