import type { PageServerLoad } from './$types';
import { redirect } from '@sveltejs/kit';
import { dbDirect as db } from '$lib/server/db';
import { eq, count } from 'drizzle-orm';
import { search_tasks, match_config, salary_expectations } from '$lib/server/db/schema';

export const load: PageServerLoad = async ({ parent }) => {
	const layoutData = await parent();

	if (!layoutData.selectedProfile) {
		redirect(302, '/home');
	}

	const profileId = layoutData.selectedProfile.id;

	const [taskCountResult, matchConfigRow, salaryCountResult] = await Promise.all([
		db.select({ value: count() }).from(search_tasks).where(eq(search_tasks.profile_id, profileId)),
		db.query.match_config.findFirst({
			where: eq(match_config.profile_id, profileId),
			columns: { id: true }
		}),
		db
			.select({ value: count() })
			.from(salary_expectations)
			.where(eq(salary_expectations.profile_id, profileId))
	]);

	return {
		profileId,
		profileName: layoutData.selectedProfile.name,
		taskCount: taskCountResult[0]?.value ?? 0,
		hasMatchConfig: !!matchConfigRow,
		salaryExpectationCount: salaryCountResult[0]?.value ?? 0
	};
};
