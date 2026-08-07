/**
 * Admin helpers for job_platforms.
 *
 * Edits go through `updatePlatformWithAudit` so every changed field gets a
 * row in `job_platform_changes` — gives the admin UI a per-platform history
 * and lets us correlate template edits with later scraper failures.
 */

import { dbDirect as db } from '$lib/server/db';
import { eq } from 'drizzle-orm';
import { job_platform_changes, job_platforms } from '$lib/server/db/schema';

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
