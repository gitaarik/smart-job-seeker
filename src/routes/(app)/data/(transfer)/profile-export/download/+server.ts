import type { RequestHandler } from './$types';
import { error } from '@sveltejs/kit';
import { dbDirect as db } from '$lib/server/db';
import { eq, and } from 'drizzle-orm';
import { profile_exports } from '$lib/server/db/schema';
import { requireAuth } from '$lib/server/utils/api-helpers';
import { getSelectedProfileId } from '../../../../profile/utils';
import { getFile } from '$lib/server/files';

export const GET: RequestHandler = async ({ url, locals, cookies }) => {
	const user = requireAuth(locals);

	const profileId = await getSelectedProfileId(cookies, user.id);
	if (!profileId) {
		error(400, 'No profile selected');
	}

	const exportId = url.searchParams.get('id');
	if (!exportId) {
		error(400, 'Missing export ID');
	}

	const exp = await db.query.profile_exports.findFirst({
		where: and(
			eq(profile_exports.id, parseInt(exportId, 10)),
			eq(profile_exports.profile_id, profileId)
		),
		with: {
			file: true
		}
	});

	if (!exp) {
		error(404, 'Export not found');
	}

	const fileBuffer = await getFile(exp.file_id);
	const filename = exp.file?.filename_download || `export-${exp.id}.${exp.file_type}`;

	// Determine content type based on file type
	let contentType: string;
	switch (exp.file_type) {
		case 'zip':
			contentType = 'application/zip';
			break;
		case 'json':
			contentType = 'application/json';
			break;
		case 'pdf':
			contentType = 'application/pdf';
			break;
		default:
			contentType = 'application/octet-stream';
	}

	return new Response(new Uint8Array(fileBuffer), {
		headers: {
			'Content-Type': contentType,
			'Content-Disposition': `attachment; filename="${filename}"`
		}
	});
};
