import type { PageServerLoad } from './$types';
import { dbDirect as db } from '$lib/server/db';
import { eq, and, like, inArray, desc, count, exists, type SQL } from 'drizzle-orm';
import { notReferencedCondition } from '$lib/server/uploads/reap';
import { sql } from 'drizzle-orm';
import {
	files,
	profiles,
	application_records,
	user_feedback_files,
	profile_exports,
	import_logs
} from '$lib/server/db/schema';

export const load: PageServerLoad = async ({ url }) => {
	const typeFilter = url.searchParams.get('type') || '';
	const usageFilter = url.searchParams.get('usage') || '';
	const page = Math.max(1, parseInt(url.searchParams.get('page') || '1'));
	const pageSize = 50;

	const conditions: SQL[] = [];

	if (typeFilter === 'pdf') {
		conditions.push(like(files.type, '%pdf%'));
	} else if (typeFilter === 'image') {
		conditions.push(like(files.type, 'image/%'));
	} else if (typeFilter === 'document') {
		conditions.push(
			inArray(files.type, [
				'application/msword',
				'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
				'text/html',
				'text/plain'
			])
		);
	} else if (typeFilter === 'json') {
		conditions.push(eq(files.type, 'application/json'));
	}

	if (usageFilter === 'cv') {
		// "Source CVs" asked `profile_picture_id` until 2026-09-06, so it listed
		// profile photos under a CV label and the actual source CVs -- the only
		// thing the filter is named for -- were unreachable from this page.
		conditions.push(
			exists(
				db
					.select({ v: sql`1` })
					.from(profiles)
					.where(eq(profiles.source_cv, files.id))
			)
		);
	} else if (usageFilter === 'application') {
		conditions.push(
			exists(
				db
					.select({ v: sql`1` })
					.from(application_records)
					.where(eq(application_records.file_id, files.id))
			)
		);
	} else if (usageFilter === 'feedback') {
		conditions.push(
			exists(
				db
					.select({ v: sql`1` })
					.from(user_feedback_files)
					.where(eq(user_feedback_files.file_id, files.id))
			)
		);
	} else if (usageFilter === 'export') {
		conditions.push(
			exists(
				db
					.select({ v: sql`1` })
					.from(profile_exports)
					.where(eq(profile_exports.file_id, files.id))
			)
		);
	} else if (usageFilter === 'orphan') {
		// The same question the sweep asks, from the same place: every foreign key
		// the catalog reports plus the references it cannot see. A second list here
		// drifted before — it named five of the nine FKs and no jsonb — so this
		// page showed as "orphan" files the sweep would (rightly or wrongly) delete.
		conditions.push(await notReferencedCondition());
	}

	const whereCondition = conditions.length > 0 ? and(...conditions) : undefined;

	const [fileResults, [{ total }]] = await Promise.all([
		db.query.files.findMany({
			where: whereCondition,
			orderBy: desc(files.created_on),
			offset: (page - 1) * pageSize,
			limit: pageSize,
			with: {
				profiles: { columns: { id: true, name: true } },
				application_records: {
					columns: { id: true },
					with: {
						application: {
							columns: { id: true },
							with: { job: { columns: { title: true, company: true } } }
						}
					}
				},
				user_feedback_files: {
					with: { user_feedback: { columns: { id: true, category: true } } }
				},
				profile_exports: { columns: { id: true } }
			}
		}),
		db.select({ total: count() }).from(files).where(whereCondition)
	]);

	// Get import log entries for files that have them
	const fileIds = fileResults.map((f) => f.id);
	const importLogResults = fileIds.length
		? await db.query.import_logs.findMany({
				where: inArray(import_logs.file_id, fileIds),
				columns: {
					file_id: true,
					event: true,
					date_created: true,
					file_format: true,
					error: true,
					sections: true,
					user_email: true
				},
				orderBy: desc(import_logs.date_created)
			})
		: [];

	const importLogMap = new Map<string, typeof importLogResults>();
	for (const log of importLogResults) {
		if (!log.file_id) continue;
		const existing = importLogMap.get(log.file_id) || [];
		existing.push(log);
		importLogMap.set(log.file_id, existing);
	}

	return {
		files: fileResults.map((f) => ({
			...f,
			filesize: f.filesize ? Number(f.filesize) : null,
			importLogs: importLogMap.get(f.id) || []
		})),
		total,
		page,
		pageSize,
		totalPages: Math.ceil(total / pageSize),
		typeFilter,
		usageFilter
	};
};
