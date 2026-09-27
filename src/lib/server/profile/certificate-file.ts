/**
 * The certificate itself: one uploaded file per certificate, private to its
 * profile.
 *
 * Kept as the applicant sent it and never read. The fields beside it already
 * say what it says, and its value is being the document an employer asks to
 * see. So it takes the media half of `documents/` (a stored `files` row and no
 * extracted text) and none of the rest, and it has a door of its own,
 * `/api/certificates/[id]/file`, because `uploads/files/` is never served
 * publicly.
 *
 * `certificates.file_id` is written here and nowhere else. It is not a
 * declared field, so the section writes, the assistant, MCP and both imports
 * all leave it alone: a caller able to set a file id could point their own
 * certificate at anybody's file and read it back through that door.
 */

import { and, asc, eq, isNotNull, isNull } from 'drizzle-orm';
import { dbDirect as db } from '$lib/server/db';
import { certificates } from '$lib/server/db/schema';
import { uploadFile } from '$lib/server/files';
import { reapFileRefs } from '$lib/server/uploads/reap';
import { sniffUploadKind } from '$lib/server/documents/sniff';
import { normalizeImage } from '$lib/server/documents/media';
import { MAX_CERTIFICATE_FILE_BYTES } from '$lib/certificate-files';

/** What the page shows about a stored file. */
export interface CertificateFileInfo {
	name: string;
	type: string;
	size: number;
}

export interface PreparedCertificateFile {
	filename: string;
	bytes: Buffer;
}

/** A refusal worth showing the uploader, with the status it goes out as. */
export class CertificateFileError extends Error {
	constructor(
		message: string,
		readonly status: 413 | 415 | 422
	) {
		super(message);
		this.name = 'CertificateFileError';
	}
}

function basename(name: string): string {
	return name.split(/[\\/]/).pop()?.trim() ?? '';
}

/**
 * Check an upload by its bytes and shape it for storage.
 *
 * A PDF is kept as sent, under a name ending in `.pdf`, since the store types a
 * file by its extension and `sniffUploadKind` accepts a PDF that has none. An
 * image is re-encoded to WebP by `normalizeImage`, which is also what strips
 * its EXIF: a phone photo of a certificate carries the GPS position of the room
 * it was taken in. Anything else is refused, including a file whose extension
 * claims a type its bytes are not.
 */
export async function prepareCertificateFile(
	filename: string,
	bytes: Uint8Array
): Promise<PreparedCertificateFile> {
	if (bytes.length > MAX_CERTIFICATE_FILE_BYTES) {
		throw new CertificateFileError(
			`The file is larger than ${MAX_CERTIFICATE_FILE_BYTES / (1024 * 1024)} MB.`,
			413
		);
	}

	const kind = sniffUploadKind(bytes, filename);
	if (kind === 'pdf') {
		const name = basename(filename) || 'certificate';
		return {
			filename: name.toLowerCase().endsWith('.pdf') ? name : `${name}.pdf`,
			bytes: Buffer.from(bytes)
		};
	}
	if (kind === 'media') {
		try {
			const image = await normalizeImage({ filename: basename(filename) || 'certificate', bytes });
			return { filename: image.filename, bytes: image.bytes };
		} catch {
			throw new CertificateFileError(
				'That image could not be read. Try a PNG or a JPEG, or a PDF.',
				422
			);
		}
	}
	throw new CertificateFileError('Upload the certificate as a PDF or an image.', 415);
}

/** Files that just lost their certificate, gone unless something else still uses them. */
async function reapQuietly(fileIds: string[]): Promise<void> {
	if (fileIds.length === 0) return;
	try {
		const { failures } = await reapFileRefs({ fileIds, mediaPaths: [] });
		for (const failure of failures) {
			console.warn(`[certificate-file] could not unlink ${failure.path}: ${failure.error}`);
		}
	} catch (err) {
		// The orphan sweep collects whatever this leaves behind.
		console.warn('[certificate-file] could not reap replaced files:', err);
	}
}

/** For a caller that deleted certificates by some other road than `deleteRow`. */
export async function reapCertificateFiles(fileIds: (string | null)[]): Promise<void> {
	await reapQuietly(fileIds.filter((id): id is string => !!id));
}

/**
 * Store a prepared file as this certificate's, replacing any it had.
 *
 * The blob and its row land before the certificate names them, so a failure in
 * between leaves an unreferenced `files` row for the orphan sweep rather than a
 * certificate pointing at nothing. The file it replaces is reaped afterwards,
 * once nothing points at it. Null when the certificate is not this profile's.
 */
export async function attachCertificateFile(
	profileId: number,
	certificateId: number,
	prepared: PreparedCertificateFile
): Promise<CertificateFileInfo | null> {
	const owned = and(eq(certificates.id, certificateId), eq(certificates.profile_id, profileId));
	const [current] = await db
		.select({ fileId: certificates.file_id })
		.from(certificates)
		.where(owned)
		.limit(1);
	if (!current) return null;

	const stored = await uploadFile({ filename: prepared.filename, buffer: prepared.bytes });
	const [updated] = await db
		.update(certificates)
		.set({ file_id: stored.id, date_updated: new Date() })
		.where(owned)
		.returning({ id: certificates.id });

	if (!updated) {
		// Deleted while the bytes were being written.
		await reapQuietly([stored.id]);
		return null;
	}
	if (current.fileId && current.fileId !== stored.id) await reapQuietly([current.fileId]);

	return { name: stored.filename_download, type: stored.type, size: stored.filesize };
}

/** Take the file off a certificate and reap it. False when the certificate is not this profile's. */
export async function detachCertificateFile(
	profileId: number,
	certificateId: number
): Promise<boolean> {
	const owned = and(eq(certificates.id, certificateId), eq(certificates.profile_id, profileId));
	const [current] = await db
		.select({ fileId: certificates.file_id })
		.from(certificates)
		.where(owned)
		.limit(1);
	if (!current) return false;
	if (!current.fileId) return true;

	await db.update(certificates).set({ file_id: null, date_updated: new Date() }).where(owned);
	await reapQuietly([current.fileId]);
	return true;
}

/** How an import names a certificate for matching, the way the resume diff does. */
function nameKey(name: string | null): string {
	return (name ?? '').trim().toLowerCase();
}

/**
 * This profile's certificate files by certificate name, read before an
 * overwrite import deletes the rows.
 *
 * An import's payload carries no files: an export of a profile holds what its
 * certificates say, not the documents behind them. So an overwrite would drop
 * every one, which is the loss `import-overwrite-deletes.test.ts` exists to
 * forbid. `restoreCertificateFiles` puts them back.
 */
export async function certificateFilesByName(profileId: number): Promise<Map<string, string[]>> {
	const rows = await db
		.select({ name: certificates.name, fileId: certificates.file_id })
		.from(certificates)
		.where(and(eq(certificates.profile_id, profileId), isNotNull(certificates.file_id)))
		.orderBy(asc(certificates.sort), asc(certificates.id));

	const byName = new Map<string, string[]>();
	for (const { name, fileId } of rows) {
		if (!fileId) continue;
		const key = nameKey(name);
		byName.set(key, [...(byName.get(key) ?? []), fileId]);
	}
	return byName;
}

/**
 * Which imported certificate takes which kept file: the first unclaimed file
 * of the same name, in list order. Files no certificate claims come back as
 * `leftover`. Pure, so the matching can be tested without a database.
 */
export function matchFilesByName(
	rows: { id: number; name: string | null }[],
	byName: Map<string, string[]>
): { assignments: { id: number; fileId: string }[]; leftover: string[] } {
	const queues = new Map([...byName].map(([name, ids]) => [name, [...ids]]));
	const assignments: { id: number; fileId: string }[] = [];
	for (const row of rows) {
		const fileId = queues.get(nameKey(row.name))?.shift();
		if (fileId) assignments.push({ id: row.id, fileId });
	}
	return { assignments, leftover: [...queues.values()].flat() };
}

/**
 * Give each kept file to the imported certificate with the same name, and reap
 * the ones no certificate claims.
 *
 * By name because the imported rows have new ids, and the name is how the
 * resume diff matches a certificate too. The ids come from this profile's own
 * rows, read before the delete, so nothing here can hand a certificate a file
 * the profile did not already have.
 */
export async function restoreCertificateFiles(
	profileId: number,
	byName: Map<string, string[]>
): Promise<void> {
	if (byName.size === 0) return;

	const rows = await db
		.select({ id: certificates.id, name: certificates.name })
		.from(certificates)
		.where(and(eq(certificates.profile_id, profileId), isNull(certificates.file_id)))
		.orderBy(asc(certificates.sort), asc(certificates.id));

	const { assignments, leftover } = matchFilesByName(rows, byName);
	for (const { id, fileId } of assignments) {
		await db.update(certificates).set({ file_id: fileId }).where(eq(certificates.id, id));
	}
	await reapQuietly(leftover);
}
