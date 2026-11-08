import type { PageServerLoad } from './$types';
import { redirect } from '@sveltejs/kit';
import { dbDirect as db } from '$lib/server/db';
import { eq, and } from 'drizzle-orm';
import { education } from '$lib/server/db/schema';
import { getEducationBannerUrl, getEducationLogoUrl } from '$lib/utils/entity-media-url';

export const load: PageServerLoad = async ({ params, parent }) => {
	const layoutData = await parent();

	if (!layoutData.selectedProfile) {
		redirect(302, '/home');
	}

	const id = parseInt(params.id);
	if (isNaN(id)) {
		redirect(302, '/profile/education');
	}

	const entry = await db.query.education.findFirst({
		where: and(eq(education.id, id), eq(education.profile_id, layoutData.selectedProfile.id))
	});

	if (!entry) {
		redirect(302, '/profile/education');
	}

	const logoUrl = getEducationLogoUrl(entry);
	const bannerUrl = getEducationBannerUrl(entry);

	return { education: entry, logoUrl, bannerUrl };
};
