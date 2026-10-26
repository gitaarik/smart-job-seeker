import type { PageServerLoad } from './$types';
import { redirect } from '@sveltejs/kit';
import { eq } from 'drizzle-orm';
import { dbDirect as db } from '$lib/server/db';
import { profiles } from '$lib/server/db/schema';

/**
 * The business columns only. Basic Info loads the whole profile with its
 * relations; this page edits seven scalar columns and has no use for the rest.
 */
export const load: PageServerLoad = async ({ parent }) => {
	const layoutData = await parent();

	if (!layoutData.selectedProfile) {
		redirect(302, '/home');
	}

	const profile = await db.query.profiles.findFirst({
		where: eq(profiles.id, layoutData.selectedProfile.id),
		columns: {
			id: true,
			company_name: true,
			kvk_number: true,
			vat_id: true,
			business_activities: true,
			street_address: true,
			postal_code: true,
			city: true
		}
	});

	if (!profile) {
		redirect(302, '/home');
	}

	return { profile };
};
