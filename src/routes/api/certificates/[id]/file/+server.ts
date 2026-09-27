/**
 * The document behind one certificate.
 *
 *   GET    /api/certificates/[id]/file           save it
 *   GET    /api/certificates/[id]/file?inline=1  show an image in place
 *   POST   /api/certificates/[id]/file           upload it, or replace the one there (`file`)
 *   DELETE /api/certificates/[id]/file           take it off
 *
 * **This is the only door to these bytes.** They live under `uploads/files/`,
 * which the public `/uploads/[...path]` route refuses and `/assets/[id]` does
 * not know, so every read passes the ownership check below, the same one the
 * certificate's own writes pass. The row is found by certificate id scoped to
 * the caller's profile, never by a file id the caller hands over.
 */

import { error, json } from '@sveltejs/kit';
import { and, eq } from 'drizzle-orm';
import type { RequestHandler } from './$types';
import { dbDirect as db } from '$lib/server/db';
import { certificates } from '$lib/server/db/schema';
import { contentDisposition, getFile } from '$lib/server/files';
import { parseIntParam, requireAuth } from '$lib/server/utils/api-helpers';
import { requireRowActor } from '$lib/server/profile/write-http';
import {
	attachCertificateFile,
	CertificateFileError,
	detachCertificateFile,
	prepareCertificateFile
} from '$lib/server/profile/certificate-file';

/**
 * Types that may render in place: raster images, which only an image decoder
 * reads and none of which can become a document. A PDF downloads instead, as
 * it does from the project attachments' door, for the reason given there.
 */
const INLINE_TYPES = new Set(['image/png', 'image/jpeg', 'image/webp', 'image/gif', 'image/avif']);

export const GET: RequestHandler = async ({ params, url, locals }) => {
	const user = requireAuth(locals);
	const id = parseIntParam(params.id, 'certificate');
	const { profileId } = await requireRowActor('certificate', id, user.id);

	const certificate = await db.query.certificates.findFirst({
		where: and(eq(certificates.id, id), eq(certificates.profile_id, profileId)),
		columns: { file_id: true },
		with: { file: { columns: { filename_download: true, type: true } } }
	});
	if (!certificate?.file_id || !certificate.file) error(404, 'This certificate has no file');

	const contentType = certificate.file.type || 'application/octet-stream';
	const inline = url.searchParams.get('inline') === '1' && INLINE_TYPES.has(contentType);

	let buffer: Buffer;
	try {
		buffer = await getFile(certificate.file_id);
	} catch {
		// The row outlived its bytes; nothing the caller does will fix that.
		error(404, 'The stored file is missing');
	}

	return new Response(new Uint8Array(buffer), {
		headers: {
			'Content-Type': contentType,
			'Content-Disposition': contentDisposition(certificate.file.filename_download, inline),
			// Served as what it claims to be, so the list above is the decision.
			'X-Content-Type-Options': 'nosniff',
			// Private to this profile: a shared cache would hand it to the next caller.
			'Cache-Control': 'private, max-age=3600'
		}
	});
};

export const POST: RequestHandler = async ({ params, request, locals }) => {
	const user = requireAuth(locals);
	const id = parseIntParam(params.id, 'certificate');
	const { profileId } = await requireRowActor('certificate', id, user.id);

	const form = await request.formData().catch(() => null);
	const upload = form?.get('file');
	if (!(upload instanceof File) || upload.size === 0) error(400, 'Choose a file to upload');

	let prepared;
	try {
		prepared = await prepareCertificateFile(
			upload.name,
			new Uint8Array(await upload.arrayBuffer())
		);
	} catch (err) {
		if (err instanceof CertificateFileError) error(err.status, err.message);
		throw err;
	}

	const file = await attachCertificateFile(profileId, id, prepared);
	if (!file) error(404, 'Certificate not found');
	return json({ success: true, file }, { status: 201 });
};

export const DELETE: RequestHandler = async ({ params, locals }) => {
	const user = requireAuth(locals);
	const id = parseIntParam(params.id, 'certificate');
	const { profileId } = await requireRowActor('certificate', id, user.id);

	if (!(await detachCertificateFile(profileId, id))) error(404, 'Certificate not found');
	return json({ success: true });
};
