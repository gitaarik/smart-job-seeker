import type { Actions, PageServerLoad } from './$types';
import { sectionActions } from '../section-actions';
import { PROFILE_RESOURCES } from '$lib/server/profile/resources';
import { redirect } from '@sveltejs/kit';
import { dbDirect as db } from '$lib/server/db';
import { asc, eq } from 'drizzle-orm';
import { certificate_skills, certificates } from '$lib/server/db/schema';
import { CERTIFICATES_DEP } from './certificates-dep';

export const load: PageServerLoad = async ({ parent, depends }) => {
	// Invalidated by each skill chip's save, which fires while the user is still
	// typing: re-running the whole dashboard layout for that would be waste.
	depends(CERTIFICATES_DEP);
	const layoutData = await parent();

	if (!layoutData.selectedProfile) {
		redirect(302, '/home');
	}

	const certs = await db.query.certificates.findMany({
		where: eq(certificates.profile_id, layoutData.selectedProfile.id),
		// The list order is declared with the section itself, so the page and
		// the write layer's append placement cannot disagree about it.
		orderBy: PROFILE_RESOURCES.certificate.orderBy,
		with: {
			certificate_skills: {
				columns: { id: true, name: true },
				orderBy: asc(certificate_skills.sort)
			},
			file: { columns: { filename_download: true, type: true, filesize: true } }
		}
	});

	return { certificates: certs, profileId: layoutData.selectedProfile.id };
};

export const actions: Actions = sectionActions('certificate', {
	include: ['create', 'update', 'delete']
});
