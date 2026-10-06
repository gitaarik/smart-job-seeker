import type { Actions, PageServerLoad } from './$types';
import { fail, redirect, type Cookies } from '@sveltejs/kit';
import { dbDirect as db } from '$lib/server/db';
import { eq } from 'drizzle-orm';
import { match_config, profiles } from '$lib/server/db/schema';
import { getSelectedProfileId } from '../../profile/utils';
import { getFxRates } from '$lib/server/salary/fx';
import { buildNormalizeMap, JOB_TYPES } from '$lib/data/job-taxonomy';
import {
	normalizeAdjustments,
	normalizeEmployed,
	normalizeFreelance,
	storedEmployed,
	storedFreelance,
	wantedModes
} from '$lib/salary/settings';

const jobTypeNormalize = buildNormalizeMap(JOB_TYPES);

export const load: PageServerLoad = async ({ parent }) => {
	const layoutData = await parent();

	if (!layoutData.selectedProfile) {
		redirect(302, '/home');
	}
	const profileId = layoutData.selectedProfile.id;

	const [profile, configs, fxRates] = await Promise.all([
		db.query.profiles.findFirst({
			where: eq(profiles.id, profileId),
			columns: { salary_employed: true, salary_freelance: true, salary_adjustments: true }
		}),
		db.query.match_config.findMany({
			where: eq(match_config.profile_id, profileId),
			columns: { job_types: true }
		}),
		getFxRates()
	]);

	// Which kinds of work they match on decides which asks the page opens with.
	// Match Config stores labels ("Full-time", "Freelance"), so normalize them.
	const jobTypes = configs.flatMap((c) =>
		Array.isArray(c.job_types)
			? (c.job_types as unknown[]).flatMap((t) => {
					const canonical =
						typeof t === 'string' ? jobTypeNormalize.get(t.trim().toLowerCase()) : undefined;
					return canonical ? [canonical] : [];
				})
			: []
	);

	return {
		employed: storedEmployed(profile?.salary_employed),
		freelance: storedFreelance(profile?.salary_freelance),
		adjustments: normalizeAdjustments(profile?.salary_adjustments),
		wanted: wantedModes(jobTypes),
		fxRates
	};
};

/** The posted JSON: `null` stops the ask, anything else is read through `normalize`. */
async function readSettings<T>(
	request: Request,
	normalize: (raw: unknown) => T
): Promise<{ ok: true; value: T | null } | { ok: false }> {
	const formData = await request.formData();
	try {
		const raw = JSON.parse(String(formData.get('settings') ?? 'null'));
		return { ok: true, value: raw === null ? null : normalize(raw) };
	} catch {
		return { ok: false };
	}
}

async function profileFor(locals: App.Locals, cookies: Cookies) {
	if (!locals.user) return null;
	return getSelectedProfileId(cookies, locals.user.id);
}

export const actions: Actions = {
	saveEmployed: async ({ request, locals, cookies }) => {
		const profileId = await profileFor(locals, cookies);
		if (!profileId) return fail(401, { error: 'Not signed in to a profile' });

		const settings = await readSettings(request, normalizeEmployed);
		if (!settings.ok) return fail(400, { error: 'Invalid salary settings' });

		await db
			.update(profiles)
			.set({ salary_employed: settings.value, date_updated: new Date() })
			.where(eq(profiles.id, profileId));
		return { success: true };
	},

	saveFreelance: async ({ request, locals, cookies }) => {
		const profileId = await profileFor(locals, cookies);
		if (!profileId) return fail(401, { error: 'Not signed in to a profile' });

		const settings = await readSettings(request, normalizeFreelance);
		if (!settings.ok) return fail(400, { error: 'Invalid freelance settings' });

		await db
			.update(profiles)
			.set({ salary_freelance: settings.value, date_updated: new Date() })
			.where(eq(profiles.id, profileId));
		return { success: true };
	},

	saveAdjustments: async ({ request, locals, cookies }) => {
		const profileId = await profileFor(locals, cookies);
		if (!profileId) return fail(401, { error: 'Not signed in to a profile' });

		const settings = await readSettings(request, normalizeAdjustments);
		if (!settings.ok) return fail(400, { error: 'Invalid adjustments' });

		await db
			.update(profiles)
			.set({ salary_adjustments: settings.value ?? {}, date_updated: new Date() })
			.where(eq(profiles.id, profileId));
		return { success: true };
	}
};
