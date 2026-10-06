import type { Actions, PageServerLoad } from './$types';
import { fail } from '@sveltejs/kit';
import { dbDirect as db } from '$lib/server/db';
import { eq, and } from 'drizzle-orm';
import { profiles, applications } from '$lib/server/db/schema';
import { getSelectedProfileId } from '../../../profile/utils';
import { getFxRates } from '$lib/server/salary/fx';
import { normalizeAdjustments, storedEmployed, storedFreelance } from '$lib/salary/settings';

export const load: PageServerLoad = async ({ parent }) => {
	const layoutData = await parent();
	const profileId = layoutData.profileId;

	const [profile, fxRates] = await Promise.all([
		db.query.profiles.findFirst({
			where: eq(profiles.id, profileId),
			columns: { salary_employed: true, salary_freelance: true, salary_adjustments: true }
		}),
		getFxRates()
	]);

	return {
		employed: storedEmployed(profile?.salary_employed),
		freelance: storedFreelance(profile?.salary_freelance),
		adjustments: normalizeAdjustments(profile?.salary_adjustments),
		fxRates
	};
};

export const actions: Actions = {
	updateSalary: async ({ request, locals, cookies, params }) => {
		const user = locals.user;
		if (!user) return fail(401, { error: 'Not authenticated' });

		const profileId = await getSelectedProfileId(cookies, user.id);
		if (!profileId) return fail(400, { error: 'No profile selected' });

		const appId = parseInt(params.id);
		if (isNaN(appId)) return fail(400, { error: 'Invalid application ID' });

		const existing = await db.query.applications.findFirst({
			where: and(eq(applications.id, appId), eq(applications.profile_id, profileId))
		});
		if (!existing) return fail(404, { error: 'Application not found' });

		const formData = await request.formData();
		const salary_expectation = formData.get('salary_expectation') as string;
		const salary_currency = formData.get('salary_currency') as string;
		const salary_period = formData.get('salary_period') as string;

		if (!salary_expectation || !salary_currency || !salary_period) {
			return fail(400, { error: 'All salary fields are required' });
		}

		const amount = parseFloat(salary_expectation);
		if (isNaN(amount) || amount < 0) {
			return fail(400, { error: 'Invalid salary amount' });
		}

		await db
			.update(applications)
			.set({
				salary_expectation: String(amount),
				salary_currency,
				salary_period,
				date_updated: new Date()
			})
			.where(eq(applications.id, appId));

		return { success: true };
	}
};
