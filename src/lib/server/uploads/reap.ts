/**
 * Deleting rows does not delete bytes.
 *
 * Every upload in this product has two halves: a row (in `files`, or a
 * `*_path` string on the owning entity) and the actual bytes under `uploads/`.
 * The FK graph cascades the rows and cannot reach the disk, so until this
 * module existed, deleting a profile left every CV, certificate, logo and
 * banner it owned sitting in `uploads/` — with `filename_download` preserving
 * the real name, so the orphans stay identifiable long after the record that
 * explained them is gone.
 *
 * Two shapes, because the schema has two:
 *
 * - **`files` rows** — a shared table with no owner column, referenced by FK
 *   from nine places. Reachability from a profile is the only ownership signal
 *   there is, and it is not exclusive: nothing stops two rows pointing at one
 *   file. So a file is only deleted once *nothing* references it any more.
 * - **`*_path` columns** — a plain string on the owning row (profile photo,
 *   work-experience and education logos/banners, side-project images). These
 *   are exclusive by construction: the path dies with its row.
 *
 * The order matters and is the caller's job: collect the refs *before* the
 * delete (afterwards there is nothing left to read them from), then reap
 * *after* it (before, and the not-referenced check correctly refuses).
 */

import { sql } from 'drizzle-orm';
import { queryRawDirect } from '$lib/server/db';
import { deleteUpload } from './index';

/** Files reachable from something being deleted, in both storage shapes. */
export interface FileRefs {
	/** `files.id` values — bytes live at `uploads/files/<filename_disk>`. */
	fileIds: string[];
	/** `*_path` values — bytes live at `uploads/<path>`. */
	mediaPaths: string[];
}

export interface ReapResult {
	/** `files` rows deleted (nothing referenced them any more). */
	filesDeleted: number;
	/** `files` rows left alone because something still points at them. */
	filesRetained: number;
	/** Blobs unlinked from `uploads/files/`. */
	blobsUnlinked: number;
	/** `*_path` media unlinked from `uploads/`. */
	mediaUnlinked: number;
	/** Paths that could not be unlinked, with the reason. Never thrown. */
	failures: { path: string; error: string }[];
}

/** A `files` row no foreign key reaches, as reported by findOrphanedFiles. */
export interface OrphanedFile {
	id: string;
	/** Bytes live at `uploads/files/<filename_disk>`; null means row-only. */
	filenameDisk: string | null;
	/** The name the user uploaded it under — often still identifying. */
	filenameDownload: string;
	filesize: number | null;
	createdOn: Date;
}

export interface OrphanScanOptions {
	/** Ignore rows younger than this. See findOrphanedFiles. */
	minAgeDays?: number;
	/** Cap the result set; omitted means every orphan. */
	limit?: number;
}

/** Long enough that no upload flow can still be mid-link. */
export const DEFAULT_ORPHAN_MIN_AGE_DAYS = 7;

export const EMPTY_REFS: FileRefs = { fileIds: [], mediaPaths: [] };

function mergeRefs(...refs: FileRefs[]): FileRefs {
	return {
		fileIds: [...new Set(refs.flatMap((r) => r.fileIds))],
		mediaPaths: [...new Set(refs.flatMap((r) => r.mediaPaths))]
	};
}

/**
 * Every file reachable from one profile.
 *
 * Deliberately *not* including `job_resources`: those hang off `jobs`, which
 * is a table shared between everyone a posting matched and is not deleted with
 * a profile. Reaping them here would delete another user's attachment.
 */
export async function collectProfileFileRefs(profileId: number): Promise<FileRefs> {
	const rows = await queryRawDirect<{ file_id: string | null; media_path: string | null }>(sql`
		SELECT profile_picture_id AS file_id, profile_photo_path AS media_path
		  FROM profiles WHERE id = ${profileId}
		UNION ALL
		SELECT logo_id, logo_path FROM work_experiences WHERE profile_id = ${profileId}
		UNION ALL
		SELECT NULL, banner_path FROM work_experiences WHERE profile_id = ${profileId}
		UNION ALL
		SELECT logo_id, logo_path FROM education WHERE profile_id = ${profileId}
		UNION ALL
		SELECT NULL, banner_path FROM education WHERE profile_id = ${profileId}
		UNION ALL
		SELECT NULL, image_path FROM side_projects WHERE profile_id = ${profileId}
		UNION ALL
		SELECT NULL, banner_path FROM side_projects WHERE profile_id = ${profileId}
		UNION ALL
		SELECT cv_file_sent_id, NULL FROM applications WHERE profile_id = ${profileId}
		UNION ALL
		SELECT r.file_id, NULL
		  FROM application_records r
		  JOIN applications a ON a.id = r.application_id
		 WHERE a.profile_id = ${profileId}
		UNION ALL
		SELECT file_id, NULL FROM profile_exports WHERE profile_id = ${profileId}
		UNION ALL
		SELECT file_id, NULL FROM profile_document_projects WHERE profile_id = ${profileId}
	`);

	const fileIds = new Set<string>();
	const mediaPaths = new Set<string>();
	for (const r of rows) {
		if (r.file_id) fileIds.add(r.file_id);
		if (r.media_path) mediaPaths.add(r.media_path);
	}
	return { fileIds: [...fileIds], mediaPaths: [...mediaPaths] };
}

/**
 * Every file reachable from one user: the union over their profiles, plus the
 * user-scoped attachments that hang off the account rather than a profile.
 */
export async function collectUserFileRefs(userId: string): Promise<FileRefs> {
	const profileRows = await queryRawDirect<{ id: number }>(
		sql`SELECT id FROM profiles WHERE user_id = ${userId}`
	);
	const perProfile: FileRefs[] = [];
	for (const p of profileRows) {
		perProfile.push(await collectProfileFileRefs(p.id));
	}

	const feedback = await queryRawDirect<{ file_id: string | null }>(sql`
		SELECT f.file_id
		  FROM user_feedback_files f
		  JOIN user_feedback uf ON uf.id = f.user_feedback_id
		 WHERE uf.user_id = ${userId}
	`);
	const feedbackRefs: FileRefs = {
		fileIds: feedback.map((r) => r.file_id).filter((id): id is string => !!id),
		mediaPaths: []
	};

	return mergeRefs(...perProfile, feedbackRefs);
}

/**
 * The tables holding an FK to `files`, read from the catalog rather than
 * written down.
 *
 * A hand-maintained list is exactly the thing that goes stale: the tenth
 * reference added to `files` would silently make this delete other people's
 * blobs, and nothing would fail. Postgres already knows the answer, so ask it.
 */
async function referencingColumns(): Promise<{ table: string; column: string }[]> {
	const rows = await queryRawDirect<{ tbl: string; col: string }>(sql`
		SELECT c.conrelid::regclass::text AS tbl, a.attname AS col
		  FROM pg_constraint c
		  JOIN LATERAL unnest(c.conkey) AS k(attnum) ON true
		  JOIN pg_attribute a ON a.attrelid = c.conrelid AND a.attnum = k.attnum
		 WHERE c.contype = 'f' AND c.confrelid = 'files'::regclass
	`);
	return rows.map((r) => ({ table: r.tbl, column: r.col }));
}

/**
 * `files` rows nothing points at any more.
 *
 * This is the backlog side of the same question `reapFileRefs` asks about one
 * profile: reachability is the only ownership signal `files` has, so a row no
 * FK reaches is a row no user can ever see again. Every deletion that happened
 * before this module existed left some — 334 of dev's 1,145 rows, measured
 * 2026-08-22.
 *
 * **`minAgeDays` is not a nicety.** `uploadFile()` inserts the `files` row and
 * *then* returns the id for the caller to store, so a row that is seconds old
 * and unreferenced is an upload in flight, not litter. Anything sweeping this
 * list must therefore ignore recent rows, and the default here is deliberately
 * far longer than any upload flow takes.
 */
export async function findOrphanedFiles(opts: OrphanScanOptions = {}): Promise<OrphanedFile[]> {
	const minAgeDays = opts.minAgeDays ?? DEFAULT_ORPHAN_MIN_AGE_DAYS;
	const cutoff = new Date(Date.now() - minAgeDays * 24 * 60 * 60 * 1000);

	const cols = await referencingColumns();
	const guards = cols.map(
		(r) => sql`NOT EXISTS (SELECT 1 FROM ${sql.raw(r.table)} WHERE ${sql.raw(r.column)} = files.id)`
	);
	const notReferenced = guards.length ? sql.join(guards, sql` AND `) : sql`true`;
	const limit = opts.limit ? sql` LIMIT ${opts.limit}` : sql``;

	const rows = await queryRawDirect<{
		id: string;
		filename_disk: string | null;
		filename_download: string;
		filesize: string | number | null;
		created_on: string | Date;
	}>(sql`
		SELECT id::text AS id, filename_disk, filename_download, filesize, created_on
		  FROM files
		 WHERE created_on < ${cutoff}
		   AND ${notReferenced}
		 ORDER BY created_on${limit}
	`);

	return rows.map((r) => ({
		id: r.id,
		filenameDisk: r.filename_disk,
		filenameDownload: r.filename_download,
		// The driver hands raw SQL back untyped: bigint arrives as a string, and
		// so does the timestamp — `.toISOString()` on it throws.
		filesize: r.filesize === null ? null : Number(r.filesize),
		createdOn: new Date(r.created_on)
	}));
}

/**
 * Delete the rows and unlink the bytes.
 *
 * Call this **after** the owning rows are gone. A `files` row is deleted only
 * when no FK anywhere still points at it, so a blob shared by two records
 * survives until the second one goes — and a caller who reaps too early gets
 * a no-op rather than someone else's missing file.
 *
 * Unlink failures are collected, never thrown: a file that is already gone,
 * or one the process cannot write, must not abort an erasure half-done.
 */
export async function reapFileRefs(refs: FileRefs): Promise<ReapResult> {
	const result: ReapResult = {
		filesDeleted: 0,
		filesRetained: 0,
		blobsUnlinked: 0,
		mediaUnlinked: 0,
		failures: []
	};

	if (refs.fileIds.length > 0) {
		const refs_ = await referencingColumns();
		const guards = refs_.map(
			(r) =>
				sql`NOT EXISTS (SELECT 1 FROM ${sql.raw(r.table)} WHERE ${sql.raw(r.column)} = files.id)`
		);
		const notReferenced = guards.length ? sql.join(guards, sql` AND `) : sql`true`;

		// Each id binds as its own parameter. Passing the JS array straight to
		// `ANY($1::uuid[])` looks tidier and fails at runtime — the driver hands
		// Postgres a value it will not read as an array literal, and the error
		// (`22P02: Array value must start with "{"`) names neither this query nor
		// the array. Found by the end-to-end test, invisible to the mocked ones.
		const idList = sql.join(
			refs.fileIds.map((id) => sql`${id}::uuid`),
			sql`, `
		);
		const rows = await queryRawDirect<{ filename_disk: string | null }>(sql`
			DELETE FROM files
			 WHERE id IN (${idList})
			   AND ${notReferenced}
			RETURNING filename_disk
		`);
		result.filesDeleted = rows.length;
		result.filesRetained = refs.fileIds.length - rows.length;

		for (const row of rows) {
			if (!row.filename_disk) continue;
			try {
				await deleteUpload(`files/${row.filename_disk}`);
				result.blobsUnlinked++;
			} catch (err) {
				result.failures.push({
					path: `files/${row.filename_disk}`,
					error: err instanceof Error ? err.message : String(err)
				});
			}
		}
	}

	for (const path of refs.mediaPaths) {
		try {
			await deleteUpload(path);
			result.mediaUnlinked++;
		} catch (err) {
			result.failures.push({
				path,
				error: err instanceof Error ? err.message : String(err)
			});
		}
	}

	return result;
}
