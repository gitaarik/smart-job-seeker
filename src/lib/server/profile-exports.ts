import { dbDirect as db } from "$lib/db";
import {
	uploadFileToDirectus,
	deleteFileFromDirectus,
} from "./directus-files";
import type { Buffer } from "buffer";

interface CreateExportOptions {
	profileId: number;
	fileBuffer: Buffer;
	filename: string;
	fileType: "pdf" | "html" | "json" | "txt" | "docx";
	exportType: "resume" | "cv" | "structured_data";
	exportFormat?: string;
	description?: string;
}

export async function createProfileExport(
	options: CreateExportOptions,
): Promise<number> {
	let uploadedFile;

	try {
		// Upload file to Directus
		uploadedFile = await uploadFileToDirectus({
			filename: options.filename,
			buffer: options.fileBuffer,
			title: options.filename,
			description: options.description,
		});

		// Create database record
		const exportRecord = await db.profile_exports.create({
			data: {
				profile: options.profileId,
				file: uploadedFile.id,
				file_type: options.fileType,
				export_type: options.exportType,
				export_format: options.exportFormat,
				description: options.description,
				date_created: new Date(),
				date_updated: new Date(),
			},
		});

		return exportRecord.id;
	} catch (error) {
		// Cleanup: delete uploaded file if database insert fails
		if (uploadedFile?.id) {
			await deleteFileFromDirectus(uploadedFile.id).catch(() => {});
		}
		throw error;
	}
}
