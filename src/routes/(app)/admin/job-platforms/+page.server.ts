import type { PageServerLoad } from './$types';
import { dbDirect as db } from '$lib/server/db';
import { sql } from 'drizzle-orm';
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
