/**
 * File download for an application's attached files.
 *
 * Deliberately on its own route rather than alongside +page.svelte: where a
 * page and an endpoint share a route, SvelteKit prefers the page for any
 * request that accepts text/html — which is every browser navigation, so a
 * plain download link rendered the page instead of serving the file.
 */
import type { RequestHandler } from './$types';
import { error } from '@sveltejs/kit';
import { dbDirect as db } from '$lib/server/db';
import { and, eq } from 'drizzle-orm';
import { application_records, applications, files } from '$lib/server/db/schema';
import { getFile } from '$lib/server/files';
import { getSelectedProfileId } from '../../../../profile/utils';

export const GET: RequestHandler = async ({ url, locals, cookies, params }) => {
	const user = locals.user;
	if (!user) error(401, 'Not authenticated');

	const profileId = await getSelectedProfileId(cookies, user.id);
	if (!profileId) error(400, 'No profile selected');

	const appId = parseInt(params.id);
	if (isNaN(appId)) error(400, 'Invalid application ID');

	const application = await db.query.applications.findFirst({
		where: and(eq(applications.id, appId), eq(applications.profile_id, profileId))
	});
	if (!application) error(404, 'Application not found');

	const fileId = url.searchParams.get('fileId');
	if (!fileId) error(400, 'File ID required');

	// Verify the file belongs to this application, as an Activity entry's
	// attachment or as the CV that was sent.
	const onRecord = await db.query.application_records.findFirst({
		where: and(
			eq(application_records.application_id, appId),
			eq(application_records.file_id, fileId)
		),
		columns: { id: true }
	});
	const isCvFile = application.cv_file_sent_id === fileId;
	if (!onRecord && !isCvFile) {
		error(403, 'File not associated with this application');
	}

	const fileMeta = await db.query.files.findFirst({
		where: eq(files.id, fileId),
		columns: { filename_download: true, type: true }
	});

	const buffer = await getFile(fileId);

	return new Response(new Uint8Array(buffer), {
		headers: {
			'Content-Type': fileMeta?.type || 'application/octet-stream',
			'Content-Disposition': `attachment; filename="${fileMeta?.filename_download || 'file'}"`
		}
	});
};
