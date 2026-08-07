/**
 * Create ZIP export with media files
 */

import JSZip from 'jszip';
import { readUpload } from '$lib/server/uploads';
import type { ExportData, MediaFile } from './types';

/**
 * Create a ZIP file containing export data and media files
 */
export async function createExportZip(data: ExportData, mediaFiles: MediaFile[]): Promise<Buffer> {
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
export async function parseExportZip(
	zipBuffer: Buffer
): Promise<{ data: ExportData; mediaFiles: Map<string, Buffer> }> {
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

	return { data, mediaFiles };
}
