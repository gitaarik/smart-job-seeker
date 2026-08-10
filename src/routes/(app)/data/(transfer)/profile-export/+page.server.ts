import type { Actions, PageServerLoad } from './$types';
import { fail, redirect } from '@sveltejs/kit';
import { dbDirect as db } from '$lib/server/db';
import { eq, and, count, desc, isNotNull, sum } from 'drizzle-orm';
import {
	education,
	profile_document_projects,
	profile_exports,
	profiles,
	side_projects,
	work_experiences
} from '$lib/server/db/schema';
import { getSelectedProfileId } from '../../../profile/utils';
import { createProfileExport } from '$lib/server/profile/exports';
import { buildExportUrl } from '$lib/server/utils/export-url-builder';
import {
	buildProfileExport,
	buildFullExport,
	createExportZip,
	getProfileName,
	type ExportScope
} from '$lib/server/export';

/**
 * What the archive will actually contain, so the page can say so before the
 * user clicks. An absent category is invisible otherwise — which is how
 * uploaded documents went unnoticed as a gap in the export for so long.
 */
async function summarizeExportContents(profileId: number) {
	const [profile, workLogos, educationLogos, sideProjectImages, documents] = await Promise.all([
		db.query.profiles.findFirst({
			where: eq(profiles.id, profileId),
			columns: { profile_photo_path: true }
		}),
		db
			.select({ value: count() })
			.from(work_experiences)
			.where(
				and(eq(work_experiences.profile_id, profileId), isNotNull(work_experiences.logo_path))
			),
		db
			.select({ value: count() })
			.from(education)
			.where(and(eq(education.profile_id, profileId), isNotNull(education.logo_path))),
		db
			.select({ value: count() })
			.from(side_projects)
			.where(and(eq(side_projects.profile_id, profileId), isNotNull(side_projects.image_path))),
		db
			.select({ value: count(), bytes: sum(profile_document_projects.total_bytes) })
			.from(profile_document_projects)
			.where(eq(profile_document_projects.profile_id, profileId))
	]);

	return {
		mediaCount:
			(profile?.profile_photo_path ? 1 : 0) +
			(workLogos[0]?.value ?? 0) +
			(educationLogos[0]?.value ?? 0) +
			(sideProjectImages[0]?.value ?? 0),
		documentCount: documents[0]?.value ?? 0,
		// Extracted text bytes — the uncompressed size documents add to the ZIP.
		documentBytes: Number(documents[0]?.bytes ?? 0)
	};
}

export const load: PageServerLoad = async ({ parent }) => {
	const layoutData = await parent();

	if (!layoutData.selectedProfile) {
		redirect(302, '/home');
	}

	const [exports, contents] = await Promise.all([
		db.query.profile_exports.findMany({
			where: and(
				eq(profile_exports.profile_id, layoutData.selectedProfile.id),
				eq(profile_exports.export_type, 'structured_data')
			),
			with: {
				file: true
			},
			orderBy: desc(profile_exports.date_created)
		}),
		summarizeExportContents(layoutData.selectedProfile.id)
	]);

	return {
		exports,
		contents,
		profileId: layoutData.selectedProfile.id,
		profileName: layoutData.selectedProfile.name
	};
};

export const actions: Actions = {
	export: async ({ request, locals, cookies }) => {
		const user = locals.user;
		if (!user) {
			return fail(401, { error: 'Not authenticated' });
		}

		const profileId = await getSelectedProfileId(cookies, user.id);
		if (!profileId) {
			return fail(400, { error: 'No profile selected' });
		}

		const formData = await request.formData();
		const scope = (formData.get('scope') as ExportScope) || 'profile';
		// ZIP is the complete export and the default; JSON is the opt-in
		// structured-data-only variant.
		const format = formData.get('format') === 'json' ? 'json' : 'zip';
		// Documents can be large, so they are the one thing worth opting out of.
		const includeDocuments = format === 'zip' && formData.get('includeDocuments') !== 'false';

		try {
			// Build export data
			const options = { includeMedia: format === 'zip', includeDocuments };
			const {
				data: exportData,
				mediaFiles,
				documentFiles
			} = scope === 'full'
				? await buildFullExport(profileId, options)
				: await buildProfileExport(profileId, options);

			const profileName = await getProfileName(profileId);

			let buffer: Buffer;
			let filename: string;
			let fileType: 'zip' | 'json';

			if (format === 'zip') {
				buffer = await createExportZip(exportData, mediaFiles, documentFiles);
				filename = `${profileName}-${scope}.zip`;
				fileType = 'zip';
			} else {
				const jsonString = JSON.stringify(exportData, null, 2);
				buffer = Buffer.from(jsonString, 'utf-8');
				filename = `${profileName}-${scope}-data-only.json`;
				fileType = 'json';
			}

			const sourceUrl = buildExportUrl({
				route: `api/profile/${profileId}/export`
			});

			const scopeLabel = scope === 'full' ? 'Full account' : 'Profile';
			const contentsLabel =
				format === 'json'
					? ' (data only)'
					: ` (${mediaFiles.length} media, ${exportData.documents?.length ?? 0} documents)`;

			await createProfileExport({
				profileId,
				fileBuffer: buffer,
				filename,
				fileType,
				exportType: 'structured_data',
				exportFormat: `${scope}_${fileType}`,
				description: `${scopeLabel} export${contentsLabel} for ${profileName}`,
				sourceUrl
			});

			return { success: true };
		} catch (error) {
			console.error('Export failed:', error);
			return fail(500, {
				error: error instanceof Error ? error.message : 'Export failed'
			});
		}
	}
};
