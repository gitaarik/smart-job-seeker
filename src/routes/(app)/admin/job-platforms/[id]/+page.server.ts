import type { Actions, PageServerLoad } from './$types';
import { error, fail } from '@sveltejs/kit';
import { dbDirect as db } from '$lib/server/db';
import { desc, eq } from 'drizzle-orm';
import { job_platform_changes, job_platforms, search_form_probe_runs } from '$lib/server/db/schema';
import { updatePlatformWithAudit } from '$lib/server/job-platforms/admin';

export const load: PageServerLoad = async ({ params, locals }) => {
	const platformId = parseInt(params.id, 10);
	if (isNaN(platformId)) error(400, 'Invalid platform id');

	const platform = await db.query.job_platforms.findFirst({
		where: eq(job_platforms.id, platformId)
	});
	if (!platform) error(404, 'Platform not found');

	const user = locals.user;
	if (!user) error(401, 'Not authenticated');

	const [history, discoveryRuns] = await Promise.all([
		db.query.job_platform_changes.findMany({
			where: eq(job_platform_changes.platform_id, platformId),
			orderBy: desc(job_platform_changes.changed_at),
			limit: 50
		}),
		db.query.search_form_probe_runs.findMany({
			where: eq(search_form_probe_runs.platform_id, platformId),
			orderBy: desc(search_form_probe_runs.started_at),
			limit: 10
		})
	]);

	return {
		platform,
		history,
		discoveryRuns
	};
};

function parseString(raw: FormDataEntryValue | null): string {
	return raw === null ? '' : String(raw);
}

function parseNullableString(raw: FormDataEntryValue | null): string | null {
	if (raw === null) return null;
	const trimmed = String(raw).trim();
	return trimmed.length === 0 ? null : trimmed;
}

export const actions: Actions = {
	/** Save platform-level fields (name, status, login URL, etc.) */
	save: async ({ params, request, locals }) => {
		const user = locals.user;
		if (!user) return fail(401, { error: 'Not authenticated' });

		const platformId = parseInt(params.id ?? '', 10);
		if (isNaN(platformId)) return fail(400, { error: 'Invalid platform id' });

		const formData = await request.formData();

		try {
			const result = await updatePlatformWithAudit(platformId, user.id, {
				name: parseString(formData.get('name')),
				key: parseString(formData.get('key')),
				url: parseString(formData.get('url')),
				type: parseNullableString(formData.get('type')),
				status: parseString(formData.get('status')),
				login_page_url: parseNullableString(formData.get('login_page_url')),
				search_page_url: parseNullableString(formData.get('search_page_url'))
			});
			return { success: true, savedFields: result.changedFields };
		} catch (err) {
			return fail(500, {
				error: err instanceof Error ? err.message : 'Save failed'
			});
		}
	},

	/**
	 * Remove entries from `unsupported_filters`. Pass `canonical=<name>` to
	 * clear one filter, or `canonical=__all__` to wipe the whole map. Each
	 * removed canonical writes an audit row so the change shows up in the
	 * platform's history.
	 */
	clear_unsupported: async ({ params, request, locals }) => {
		const user = locals.user;
		if (!user) return fail(401, { error: 'Not authenticated' });

		const platformId = parseInt(params.id ?? '', 10);
		if (isNaN(platformId)) return fail(400, { error: 'Invalid platform id' });

		const formData = await request.formData();
		const canonical = parseString(formData.get('canonical')).trim();
		if (!canonical) {
			return fail(400, { error: 'canonical is required' });
		}

		try {
			const existing = await db.query.job_platforms.findFirst({
				where: eq(job_platforms.id, platformId),
				columns: { unsupported_filters: true }
			});
			if (!existing) return fail(404, { error: 'Platform not found' });

			const current = (existing.unsupported_filters ?? {}) as Record<string, string[]>;
			const removed: Array<{ canonical: string; values: string[] }> = [];
			let next: Record<string, string[]>;
			if (canonical === '__all__') {
				for (const [k, v] of Object.entries(current)) {
					removed.push({ canonical: k, values: v });
				}
				next = {};
			} else {
				if (!(canonical in current)) {
					return { success: true, clearedFields: [] };
				}
				removed.push({ canonical, values: current[canonical] });
				next = { ...current };
				delete next[canonical];
			}

			if (removed.length === 0) return { success: true, clearedFields: [] };

			await db.transaction(async (tx) => {
				await tx
					.update(job_platforms)
					.set({
						unsupported_filters: next,
						// Touch the timestamp so admins can see when the entries were
						// cleared, not just when they were last *added*.
						unsupported_filters_at: new Date()
					})
					.where(eq(job_platforms.id, platformId));
				for (const entry of removed) {
					await tx.insert(job_platform_changes).values({
						platform_id: platformId,
						field: `unsupported_filters.${entry.canonical}`,
						old_value: JSON.stringify(entry.values),
						new_value: null,
						changed_by_user_id: user.id
					});
				}
			});

			return {
				success: true,
				clearedFields: removed.map((r) => r.canonical)
			};
		} catch (err) {
			return fail(500, {
				error: err instanceof Error ? err.message : 'Clear failed'
			});
		}
	}
};
