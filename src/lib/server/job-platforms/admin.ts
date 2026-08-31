/**
 * Admin helpers for job_platforms.
 *
 * Edits go through `updatePlatformWithAudit` so every changed field gets a
 * row in `job_platform_changes` — gives the admin UI a per-platform history
 * and lets us correlate template edits with later scraper failures.
 */

import { dbDirect as db } from '$lib/server/db';
import { count, eq } from 'drizzle-orm';
import {
	job_platform_changes,
	job_platforms,
	jobs,
	platform_credentials,
	platform_profiles,
	search_form_probe_runs,
	search_tasks
} from '$lib/server/db/schema';

/** Subset of job_platforms columns that the admin UI is allowed to edit.
 *  search_url_template is deprecated in favor of job_platform_search_presets,
 *  so it's not in the editable set even though the column still exists. */
export type EditablePlatformFields = {
	status?: string;
	name?: string;
	url?: string;
	type?: string | null;
	key?: string;
	login_page_url?: string | null;
	search_page_url?: string | null;
};

const EDITABLE_FIELDS = [
	'status',
	'name',
	'url',
	'type',
	'key',
	'login_page_url',
	'search_page_url'
] as const satisfies ReadonlyArray<keyof EditablePlatformFields>;

function normalize(value: unknown): string | null {
	if (value === null || value === undefined) return null;
	if (typeof value === 'string') {
		const trimmed = value.trim();
		return trimmed.length === 0 ? null : trimmed;
	}
	return String(value);
}

export async function updatePlatformWithAudit(
	platformId: number,
	userId: string,
	updates: EditablePlatformFields
): Promise<{ changedFields: string[] }> {
	const existing = await db.query.job_platforms.findFirst({
		where: eq(job_platforms.id, platformId)
	});
	if (!existing) {
		throw new Error(`Platform ${platformId} not found`);
	}

	const changes: Array<{ field: string; old: string | null; new: string | null }> = [];
	const setClause: Record<string, unknown> = {};

	for (const field of EDITABLE_FIELDS) {
		if (!(field in updates)) continue;
		const newValue = updates[field] ?? null;
		const oldValue = (existing as Record<string, unknown>)[field] ?? null;
		if (normalize(oldValue) === normalize(newValue)) continue;
		changes.push({
			field,
			old: normalize(oldValue),
			new: normalize(newValue)
		});
		setClause[field] = newValue;
	}

	if (changes.length === 0) {
		return { changedFields: [] };
	}

	setClause.date_updated = new Date();

	await db.transaction(async (tx) => {
		await tx.update(job_platforms).set(setClause).where(eq(job_platforms.id, platformId));
		for (const c of changes) {
			await tx.insert(job_platform_changes).values({
				platform_id: platformId,
				field: c.field,
				old_value: c.old,
				new_value: c.new,
				changed_by_user_id: userId
			});
		}
	});

	return { changedFields: changes.map((c) => c.field) };
}

/**
 * What still points at a platform, split by what the FKs do about it.
 *
 * `blocking` is the set whose FKs are ON DELETE SET NULL: dropping the platform
 * would not fail, it would quietly strip the reference and leave a job with no
 * source, or an import task pointed at nothing. That is the whole reason delete
 * is guarded — the database will not stop you.
 *
 * It matters more since users can create platforms themselves from the add-task
 * form (as `draft`, since job_platforms has no owner column). Their own
 * search_tasks row references the site they added, so the common case for a
 * user-added site is that deleting it breaks that user's task.
 *
 * `cascading` is the set the database removes along with the platform, which is
 * fine but worth showing before the fact.
 *
 * `search_form_probe_runs.applied_platform_id` is a legacy soft reference with
 * no FK of its own, so it is counted here rather than trusted to the database.
 */
export type PlatformReferences = {
	blocking: { jobs: number; search_tasks: number; platform_profiles: number };
	cascading: { platform_credentials: number; discovery_runs: number; changes: number };
};

const countOf = (q: PromiseLike<{ n: number }[]>) => Promise.resolve(q).then((r) => r[0]?.n ?? 0);

export async function countPlatformReferences(platformId: number): Promise<PlatformReferences> {
	const [
		jobCount,
		taskCount,
		profileCount,
		credentialCount,
		runCount,
		appliedRunCount,
		changeCount
	] = await Promise.all([
		countOf(db.select({ n: count() }).from(jobs).where(eq(jobs.job_platform_id, platformId))),
		countOf(
			db.select({ n: count() }).from(search_tasks).where(eq(search_tasks.platform_id, platformId))
		),
		countOf(
			db
				.select({ n: count() })
				.from(platform_profiles)
				.where(eq(platform_profiles.platform_id, platformId))
		),
		countOf(
			db
				.select({ n: count() })
				.from(platform_credentials)
				.where(eq(platform_credentials.platform_id, platformId))
		),
		countOf(
			db
				.select({ n: count() })
				.from(search_form_probe_runs)
				.where(eq(search_form_probe_runs.platform_id, platformId))
		),
		countOf(
			db
				.select({ n: count() })
				.from(search_form_probe_runs)
				.where(eq(search_form_probe_runs.applied_platform_id, platformId))
		),
		countOf(
			db
				.select({ n: count() })
				.from(job_platform_changes)
				.where(eq(job_platform_changes.platform_id, platformId))
		)
	]);

	return {
		blocking: { jobs: jobCount, search_tasks: taskCount, platform_profiles: profileCount },
		cascading: {
			platform_credentials: credentialCount,
			// A run can be counted by either column, and one row usually sets both.
			// The union is what actually disappears, so take the max rather than
			// the sum, which would double-count the ordinary case.
			discovery_runs: Math.max(runCount, appliedRunCount),
			changes: changeCount
		}
	};
}

/** `1 job` / `2 jobs`, matching how the rest of the admin UI counts things. */
export function plural(n: number, one: string, many = `${one}s`): string {
	return `${n} ${n === 1 ? one : many}`;
}

export function blockingTotal(refs: PlatformReferences): number {
	return refs.blocking.jobs + refs.blocking.search_tasks + refs.blocking.platform_profiles;
}

/**
 * The counts as prose, for the page and for the refusal message. Built here
 * rather than in the component because `$lib/server` cannot be imported from
 * one, and two copies of this wording would drift.
 */
export function describePlatformReferences(refs: PlatformReferences): {
	blockers: string[];
	cascades: string[];
} {
	const present = (xs: Array<string | false>) =>
		xs.filter((x): x is string => typeof x === 'string');
	return {
		blockers: present([
			refs.blocking.jobs > 0 && plural(refs.blocking.jobs, 'job'),
			refs.blocking.search_tasks > 0 && plural(refs.blocking.search_tasks, 'import task'),
			refs.blocking.platform_profiles > 0 &&
				plural(refs.blocking.platform_profiles, 'platform profile')
		]),
		cascades: present([
			refs.cascading.platform_credentials > 0 &&
				plural(refs.cascading.platform_credentials, 'stored credential'),
			refs.cascading.discovery_runs > 0 && plural(refs.cascading.discovery_runs, 'discovery run'),
			refs.cascading.changes > 0 &&
				plural(refs.cascading.changes, 'history entry', 'history entries')
		])
	};
}

/**
 * Remove a platform, refusing while anything would be orphaned by it.
 *
 * There is no soft-delete column and no undo. `status` is the existing way to
 * retire a platform that has history, so that is what a refusal points at —
 * except for a platform that is already draft, where saying so would be no
 * advice at all.
 */
export async function deletePlatform(
	platformId: number
): Promise<{ ok: true; removed: PlatformReferences['cascading'] } | { ok: false; error: string }> {
	const existing = await db.query.job_platforms.findFirst({
		where: eq(job_platforms.id, platformId),
		columns: { id: true, name: true, status: true }
	});
	if (!existing) return { ok: false, error: `Platform ${platformId} not found` };

	const refs = await countPlatformReferences(platformId);
	if (blockingTotal(refs) > 0) {
		const { blockers } = describePlatformReferences(refs);

		const advice =
			existing.status === 'published'
				? 'Set the status to draft to retire it without deleting.'
				: 'Remove what references it first, or leave it as the draft it already is.';

		return {
			ok: false,
			error:
				`${existing.name} is still referenced by ${blockers.join(', ')}. ` +
				`Deleting it would strip those references rather than fail, so it is refused. ${advice}`
		};
	}

	await db.delete(job_platforms).where(eq(job_platforms.id, platformId));
	return { ok: true, removed: refs.cascading };
}
