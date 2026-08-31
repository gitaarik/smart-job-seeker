import type { Actions, PageServerLoad } from './$types';
import { fail, redirect } from '@sveltejs/kit';
import { dbDirect as db } from '$lib/server/db';
import { eq, sql } from 'drizzle-orm';
import { job_platform_changes, job_platforms } from '$lib/server/db/schema';

export const load: PageServerLoad = async () => {
	const [platforms, changeCounts] = await Promise.all([
		db
			.select({
				id: job_platforms.id,
				key: job_platforms.key,
				name: job_platforms.name,
				url: job_platforms.url,
				type: job_platforms.type,
				status: job_platforms.status,
				login_page_url: job_platforms.login_page_url,
				search_page_url: job_platforms.search_page_url,
				success_count: job_platforms.success_count,
				failure_count: job_platforms.failure_count,
				last_success_at: job_platforms.last_success_at,
				last_failure_at: job_platforms.last_failure_at,
				unsupported_filters: job_platforms.unsupported_filters,
				unsupported_filters_at: job_platforms.unsupported_filters_at,
				date_created: job_platforms.date_created,
				date_updated: job_platforms.date_updated
			})
			.from(job_platforms)
			.orderBy(job_platforms.name),
		db
			.select({
				platform_id: job_platform_changes.platform_id,
				count: sql<number>`count(*)::int`
			})
			.from(job_platform_changes)
			.groupBy(job_platform_changes.platform_id)
	]);

	const changeByPlatform = new Map(changeCounts.map((r) => [r.platform_id, r.count]));

	return {
		platforms: platforms.map((p) => ({
			...p,
			change_count: changeByPlatform.get(p.id) ?? 0
		}))
	};
};

function parseNullableString(raw: FormDataEntryValue | null): string | null {
	if (raw === null) return null;
	const trimmed = String(raw).trim();
	return trimmed.length === 0 ? null : trimmed;
}

/** The create form's fields, echoed back on every failure so the inputs keep
 *  what was typed when JS is off. Every `fail` below carries this same shape —
 *  a union of differing payloads makes `form.values` unnarrowable in the page. */
type CreateValues = {
	name: string;
	key: string;
	url: string;
	status: string;
	type: string | null;
	login_page_url: string | null;
	search_page_url: string | null;
};

const EMPTY_VALUES: CreateValues = {
	name: '',
	key: '',
	url: '',
	status: 'draft',
	type: null,
	login_page_url: null,
	search_page_url: null
};

export const actions: Actions = {
	/**
	 * Add a platform. Only the columns the detail page can edit are settable
	 * here — signals and `unsupported_filters` are written by the scraper, and
	 * search presets are managed per-platform once the row exists.
	 *
	 * `key` is the stable identifier: settings export/import resolves platform
	 * FKs by key rather than id, so a task exported from one instance only
	 * lands on another if the keys match. Hence the slug shape check — a key
	 * with spaces or capitals in it works locally and fails to match anywhere
	 * else, silently, as a skipped task.
	 */
	create: async ({ request, locals }) => {
		const user = locals.user;
		if (!user) return fail(401, { error: 'Not authenticated', values: EMPTY_VALUES });

		const formData = await request.formData();
		const values: CreateValues = {
			name: String(formData.get('name') ?? '').trim(),
			key: String(formData.get('key') ?? '').trim(),
			url: String(formData.get('url') ?? '').trim(),
			status: String(formData.get('status') ?? '').trim() || 'draft',
			type: parseNullableString(formData.get('type')),
			login_page_url: parseNullableString(formData.get('login_page_url')),
			search_page_url: parseNullableString(formData.get('search_page_url'))
		};

		if (!values.name) return fail(400, { error: 'Name is required', values });
		if (!values.key) return fail(400, { error: 'Key is required', values });
		if (!values.url) return fail(400, { error: 'Base URL is required', values });
		if (!/^[a-z0-9]+(-[a-z0-9]+)*$/.test(values.key)) {
			return fail(400, {
				error: 'Key must be a slug: lowercase letters and digits, separated by single hyphens.',
				values
			});
		}

		const clash = await db.query.job_platforms.findFirst({
			where: eq(job_platforms.key, values.key),
			columns: { id: true, name: true }
		});
		if (clash) {
			return fail(409, {
				error: `Key "${values.key}" is already used by ${clash.name} (platform ${clash.id}).`,
				values
			});
		}

		let platformId: number;
		try {
			const now = new Date();
			platformId = await db.transaction(async (tx) => {
				const [created] = await tx
					.insert(job_platforms)
					.values({ ...values, date_created: now, date_updated: now })
					.returning({ id: job_platforms.id });

				// The platform's history starts where the platform does —
				// job_platforms has no created_by column, so this row is the only
				// record of who added it. `date_created` only says when.
				await tx.insert(job_platform_changes).values({
					platform_id: created.id,
					field: 'created',
					old_value: null,
					new_value: values.key,
					changed_by_user_id: user.id
				});

				return created.id;
			});
		} catch (err) {
			return fail(500, {
				error: err instanceof Error ? err.message : 'Create failed',
				values
			});
		}

		// Straight to the detail page — presets, discovery and credentials all
		// live there, and a new platform needs at least one of them.
		redirect(303, `/admin/job-platforms/${platformId}`);
	}
};
