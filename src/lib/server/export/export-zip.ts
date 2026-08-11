/**
 * Create ZIP export with media files and uploaded documents
 */

import JSZip from 'jszip';
import { readUpload } from '$lib/server/uploads';
import type { DocumentFilePayload, ExportData, MediaFile, TemplateAssetPayload } from './types';

/**
 * Ceiling on decompressed document text accepted from an import ZIP.
 *
 * Text compresses hard, so without a cap a small upload can expand into
 * gigabytes of heap. Ingest allows 25 MB per source file and 500 MB per
 * archive; this is well above any real profile and far below trouble. Checked
 * per file as we decompress, so overshoot is bounded by one file.
 */
const MAX_IMPORT_DOCUMENT_BYTES = 100 * 1024 * 1024;

/**
 * Create a ZIP file containing export data, media files and document text
 */
export async function createExportZip(
	data: ExportData,
	mediaFiles: MediaFile[],
	documentFiles: DocumentFilePayload[] = [],
	templateAssets: TemplateAssetPayload[] = []
): Promise<Buffer> {
	const zip = new JSZip();

	// Add JSON data
	zip.file('data.json', JSON.stringify(data, null, 2));

	// Add media files
	for (const mediaFile of mediaFiles) {
		try {
			const fileData = await readUpload(mediaFile.path);
			if (fileData) {
				zip.file(mediaFile.archivePath, fileData.buffer);
			}
		} catch (error) {
			console.warn(`Failed to read media file ${mediaFile.path}:`, error);
			// Continue with other files
		}
	}

	// Add extracted document text. Already in memory — no I/O to fail on.
	for (const documentFile of documentFiles) {
		zip.file(documentFile.archivePath, documentFile.text);
	}

	// Add CV template assets
	for (const asset of templateAssets) {
		zip.file(asset.archivePath, asset.buffer);
	}

	// Generate ZIP buffer
	const buffer = await zip.generateAsync({
		type: 'nodebuffer',
		compression: 'DEFLATE',
		compressionOptions: { level: 6 }
	});

	return buffer;
}

/**
 * Parse a ZIP export file
 */
export async function parseExportZip(zipBuffer: Buffer): Promise<{
	data: ExportData;
	mediaFiles: Map<string, Buffer>;
	documentTexts: Map<string, string>;
	templateAssets: Map<string, Buffer>;
}> {
	const zip = await JSZip.loadAsync(zipBuffer);

	// Read JSON data
	const dataFile = zip.file('data.json');
	if (!dataFile) {
		throw new Error('Invalid export ZIP: missing data.json');
	}

	const dataJson = await dataFile.async('string');
	const data = JSON.parse(dataJson) as ExportData;

	// Read media files
	const mediaFiles = new Map<string, Buffer>();

	if (data.has_media && data.media_files) {
		for (const mediaFile of data.media_files) {
			const file = zip.file(mediaFile.archivePath);
			if (file) {
				const buffer = await file.async('nodebuffer');
				mediaFiles.set(mediaFile.path, buffer);
			}
		}
	}

	// Read document text, keyed by archive path so the importer can look each
	// file up from the manifest it is already walking.
	const documentTexts = new Map<string, string>();

	if (data.has_documents && data.documents) {
		let totalBytes = 0;

		for (const document of data.documents) {
			for (const documentFile of document.files ?? []) {
				const file = zip.file(documentFile.archivePath);
				if (!file) continue;

				const text = await file.async('string');
				totalBytes += Buffer.byteLength(text, 'utf-8');

				if (totalBytes > MAX_IMPORT_DOCUMENT_BYTES) {
					throw new Error(
						`Export contains more than ${Math.round(MAX_IMPORT_DOCUMENT_BYTES / (1024 * 1024))} MB of document text`
					);
				}

				documentTexts.set(documentFile.archivePath, text);
			}
		}
	}

	// Read CV template assets, keyed by archive path like the document text is.
	const templateAssets = new Map<string, Buffer>();

	for (const template of data.resume_templates ?? []) {
		for (const asset of template.assets ?? []) {
			const file = zip.file(asset.archivePath);
			if (file) {
				templateAssets.set(asset.archivePath, await file.async('nodebuffer'));
			}
		}
	}

	return { data, mediaFiles, documentTexts, templateAssets };
}
