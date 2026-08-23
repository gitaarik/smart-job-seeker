/**
 * Local file storage
 *
 * Stores files on the local filesystem under uploads/files/{uuid}.{ext}
 * and tracks metadata in the files table.
 */

import { writeFile, readFile, mkdir, unlink } from 'node:fs/promises';
import { join, extname } from 'node:path';
import { randomUUID } from 'node:crypto';
import { dbDirect as db } from '$lib/server/db';
import { eq } from 'drizzle-orm';
import { files } from '$lib/server/db/schema';

const UPLOADS_DIR = join(process.cwd(), 'uploads', 'files');

interface UploadFileOptions {
	filename: string;
	buffer: Buffer;
	title?: string;
	description?: string;
}

interface UploadedFile {
	id: string;
	filename_disk: string;
	filename_download: string;
	type: string;
	filesize: number;
}

const EXT_TO_MIME: Record<string, string> = {
	'.pdf': 'application/pdf',
	'.doc': 'application/msword',
	'.docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
	'.html': 'text/html',
	'.htm': 'text/html',
	'.json': 'application/json',
	'.txt': 'text/plain',
	'.zip': 'application/zip',
	'.jpg': 'image/jpeg',
	'.jpeg': 'image/jpeg',
	'.png': 'image/png',
	'.webp': 'image/webp',
	'.gif': 'image/gif'
};

function getMimeType(filename: string): string {
	const ext = extname(filename).toLowerCase();
	return EXT_TO_MIME[ext] || 'application/octet-stream';
}

/** The extensions this store can type, as a sentence for a refusal to quote. */
export const SUPPORTED_UPLOAD_EXTENSIONS = Object.keys(EXT_TO_MIME);

/**
 * Whether a filename is one this store recognises.
 *
 * The same list `getMimeType` reads rather than a second one beside it: a door
 * that accepted what the store could not type would write `application/
 * octet-stream` rows that download as unopenable files, and the divergence
 * would only show up in someone's Downloads folder.
 */
export function isSupportedUpload(filename: string): boolean {
	return extname(filename).toLowerCase() in EXT_TO_MIME;
}

export async function uploadFile(options: UploadFileOptions): Promise<UploadedFile> {
	const id = randomUUID();
	const ext = extname(options.filename).toLowerCase();
	const diskName = `${id}${ext}`;
	const filePath = join(UPLOADS_DIR, diskName);
	const mimeType = getMimeType(options.filename);

	await mkdir(UPLOADS_DIR, { recursive: true });
	await writeFile(filePath, options.buffer);

	await db.insert(files).values({
		id,
		storage: 'local',
		filename_disk: diskName,
		filename_download: options.filename,
		title: options.title || options.filename,
		type: mimeType,
		// schema is bigint({ mode: "number" }), so pass the raw byte count.
		filesize: options.buffer.length
	});

	return {
		id,
		filename_disk: diskName,
		filename_download: options.filename,
		type: mimeType,
		filesize: options.buffer.length
	};
}

export async function deleteFile(fileId: string): Promise<void> {
	const file = await db.query.files.findFirst({
		where: eq(files.id, fileId),
		columns: { filename_disk: true }
	});

	if (file?.filename_disk) {
		try {
			await unlink(join(UPLOADS_DIR, file.filename_disk));
		} catch (err) {
			if ((err as NodeJS.ErrnoException).code !== 'ENOENT') throw err;
		}
	}

	await db
		.delete(files)
		.where(eq(files.id, fileId))
		.catch(() => {});
}

export async function getFile(fileId: string): Promise<Buffer> {
	const file = await db.query.files.findFirst({
		where: eq(files.id, fileId),
		columns: { filename_disk: true }
	});

	if (!file?.filename_disk) {
		throw new Error(`File not found: ${fileId}`);
	}

	return readFile(join(UPLOADS_DIR, file.filename_disk));
}
