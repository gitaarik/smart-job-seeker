/**
 * The module that deletes rows and unlinks bytes.
 *
 * Everything here is one question asked twice: *is anything still pointing at
 * this file?* `files` has no owner column, so reachability is the only
 * ownership signal there is, and it is not exclusive — two records may point
 * at one blob. Get the answer wrong in one direction and a deleted account
 * leaves its CVs on disk under their real filenames; wrong in the other and
 * reaping one profile deletes a file another user is still showing.
 *
 * The queries are the logic, so the queries are what these tests read: what
 * the SQL binds, what it guards on, and which tables it refuses to touch.
 * Whether Postgres agrees with any of it is a different question, and one a
 * mock cannot answer — `scripts/verify-orphan-reap.ts` asks it against a real
 * database, and found the parameter-binding bug that test 'binds each id as
 * its own parameter' now pins.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { PgDialect } from 'drizzle-orm/pg-core';
import type { SQL } from 'drizzle-orm';

const mockQuery = vi.fn();
const mockDeleteUpload = vi.fn();

vi.mock('$lib/server/db', () => ({
	queryRawDirect: (q: SQL) => mockQuery(q)
}));
vi.mock('../index', () => ({
	deleteUpload: (p: string) => mockDeleteUpload(p)
}));

import {
	collectProfileFileRefs,
	collectUserFileRefs,
	DEFAULT_ORPHAN_MIN_AGE_DAYS,
	EMPTY_REFS,
	findOrphanedFiles,
	reapFileRefs
} from '../reap';

const dialect = new PgDialect();

/** The SQL a call actually sent, as text and bound parameters. */
function queryAt(index: number): { sql: string; params: unknown[] } {
	const q = mockQuery.mock.calls[index]?.[0] as SQL;
	expect(q, `no query at index ${index}`).toBeTruthy();
	const { sql, params } = dialect.sqlToQuery(q);
	return { sql, params };
}

/** What `referencingColumns()` reads out of the catalog. */
const FK_ROWS = [
	{ tbl: 'applications', col: 'cv_file_sent_id' },
	{ tbl: 'profile_exports', col: 'file_id' }
];

beforeEach(() => {
	vi.clearAllMocks();
	mockDeleteUpload.mockResolvedValue(undefined);
});

describe('reapFileRefs', () => {
	it('does not go near the database when there is nothing to reap', async () => {
		const result = await reapFileRefs(EMPTY_REFS);

		expect(mockQuery).not.toHaveBeenCalled();
		expect(mockDeleteUpload).not.toHaveBeenCalled();
		expect(result).toEqual({
			filesDeleted: 0,
			filesRetained: 0,
			blobsUnlinked: 0,
			mediaUnlinked: 0,
			failures: []
		});
	});

	it('counts what it deleted and what something still points at', async () => {
		mockQuery
			.mockResolvedValueOnce(FK_ROWS)
			// Two of the three ids came back from the DELETE; the third is still
			// referenced, so the guard in the WHERE left it alone.
			.mockResolvedValueOnce([{ filename_disk: 'a.pdf' }, { filename_disk: 'b.png' }]);

		const result = await reapFileRefs({ fileIds: ['id-a', 'id-b', 'id-c'], mediaPaths: [] });

		expect(result.filesDeleted).toBe(2);
		expect(result.filesRetained).toBe(1);
		expect(result.blobsUnlinked).toBe(2);
		expect(mockDeleteUpload).toHaveBeenCalledWith('files/a.pdf');
		expect(mockDeleteUpload).toHaveBeenCalledWith('files/b.png');
	});

	it('deletes a row that names no blob without trying to unlink one', async () => {
		mockQuery
			.mockResolvedValueOnce(FK_ROWS)
			.mockResolvedValueOnce([{ filename_disk: null }, { filename_disk: 'b.png' }]);

		const result = await reapFileRefs({ fileIds: ['id-a', 'id-b'], mediaPaths: [] });

		expect(result.filesDeleted).toBe(2);
		expect(result.blobsUnlinked).toBe(1);
		expect(mockDeleteUpload).toHaveBeenCalledTimes(1);
		expect(mockDeleteUpload).toHaveBeenCalledWith('files/b.png');
	});

	it('unlinks the media that hangs off a row rather than a files id', async () => {
		const result = await reapFileRefs({
			fileIds: [],
			mediaPaths: ['profiles/photo.jpg', 'work/logo.png']
		});

		expect(result.mediaUnlinked).toBe(2);
		expect(mockDeleteUpload).toHaveBeenCalledWith('profiles/photo.jpg');
		expect(mockDeleteUpload).toHaveBeenCalledWith('work/logo.png');
	});

	// An erasure that throws halfway leaves an account both deleted and not.
	it('collects an unlink failure instead of throwing it, and carries on', async () => {
		mockQuery.mockResolvedValueOnce(FK_ROWS).mockResolvedValueOnce([{ filename_disk: 'a.pdf' }]);
		mockDeleteUpload
			.mockRejectedValueOnce(new Error('EACCES: permission denied'))
			.mockResolvedValueOnce(undefined);

		const result = await reapFileRefs({
			fileIds: ['id-a'],
			mediaPaths: ['profiles/photo.jpg']
		});

		expect(result.failures).toEqual([{ path: 'files/a.pdf', error: 'EACCES: permission denied' }]);
		// The row is gone either way — that is what filesDeleted counts — but the
		// blob is not, and the caller is told which one.
		expect(result.filesDeleted).toBe(1);
		expect(result.blobsUnlinked).toBe(0);
		// The failure did not stop the media that came after it.
		expect(result.mediaUnlinked).toBe(1);
	});

	it('reports a thrown non-Error as a string rather than losing it', async () => {
		const result = await reapFileRefs({ fileIds: [], mediaPaths: ['profiles/photo.jpg'] });
		expect(result.failures).toEqual([]);

		mockDeleteUpload.mockRejectedValueOnce('disk went away');
		const second = await reapFileRefs({ fileIds: [], mediaPaths: ['profiles/photo.jpg'] });
		expect(second.failures).toEqual([{ path: 'profiles/photo.jpg', error: 'disk went away' }]);
	});

	// The array-shaped version of this query (`= ANY($1::uuid[])`) is tidier and
	// fails at runtime: the driver hands Postgres a value it will not read as an
	// array literal, and `22P02: Array value must start with "{"` names neither
	// this query nor the array.
	it('binds each id as its own parameter, cast to uuid', async () => {
		mockQuery.mockResolvedValueOnce(FK_ROWS).mockResolvedValueOnce([]);

		await reapFileRefs({ fileIds: ['id-a', 'id-b', 'id-c'], mediaPaths: [] });

		const { sql, params } = queryAt(1);
		expect(params).toEqual(['id-a', 'id-b', 'id-c']);
		expect(sql).toContain('$1::uuid');
		expect(sql).toContain('$3::uuid');
		expect(sql).not.toContain('ANY(');
	});

	it('guards the delete with one NOT EXISTS per foreign key the catalog reports', async () => {
		mockQuery.mockResolvedValueOnce(FK_ROWS).mockResolvedValueOnce([]);

		await reapFileRefs({ fileIds: ['id-a'], mediaPaths: [] });

		const { sql } = queryAt(1);
		expect(sql).toContain(
			'NOT EXISTS (SELECT 1 FROM applications WHERE cv_file_sent_id = files.id)'
		);
		expect(sql).toContain('NOT EXISTS (SELECT 1 FROM profile_exports WHERE file_id = files.id)');
	});

	// The list comes from pg_constraint, so a tenth reference added to `files`
	// is accounted for without anyone remembering to come back here.
	it('reads the reference list from the catalog, not from a list in the code', async () => {
		mockQuery.mockResolvedValueOnce(FK_ROWS).mockResolvedValueOnce([]);

		await reapFileRefs({ fileIds: ['id-a'], mediaPaths: [] });

		const { sql } = queryAt(0);
		expect(sql).toContain('pg_constraint');
		expect(sql).toContain("contype = 'f'");
		expect(sql).toContain("confrelid = 'files'::regclass");
	});

	it('still deletes when the catalog reports no references at all', async () => {
		// Only reachable if `files` genuinely has no FK pointing at it. The ids
		// were resolved by the caller from the rows being deleted, so this is the
		// intended set either way — but the references the catalog cannot see
		// are still guarded.
		mockQuery.mockResolvedValueOnce([]).mockResolvedValueOnce([{ filename_disk: 'a.pdf' }]);

		const result = await reapFileRefs({ fileIds: ['id-a'], mediaPaths: [] });

		const { sql } = queryAt(1);
		expect(sql).not.toContain('AND true');
		expect(sql).toContain('NOT EXISTS (SELECT 1 FROM profiles WHERE source_cv = files.id)');
		expect(result.filesDeleted).toBe(1);
	});

	// The catalog knows every foreign key and nothing else. `profiles.source_cv`
	// and `import_logs.file_id` never got a constraint, and the 2026-08-23 sweep
	// deleted files through exactly that gap.
	it('also guards the references no foreign key declares', async () => {
		mockQuery.mockResolvedValueOnce(FK_ROWS).mockResolvedValueOnce([]);

		await reapFileRefs({ fileIds: ['id-a'], mediaPaths: [] });

		const { sql } = queryAt(1);
		expect(sql).toContain('NOT EXISTS (SELECT 1 FROM profiles WHERE source_cv = files.id)');
		expect(sql).toContain('NOT EXISTS (SELECT 1 FROM import_logs WHERE file_id = files.id::text)');
	});

	// Template artwork was the third of these until 2026-08-31, guarded by an
	// ILIKE over `resume_templates.config` because the ids sat in jsonb. It is
	// `resume_template_assets` now, with a foreign key, so the catalog reports
	// it and the hand-written guard is gone. Asserted as an absence because
	// that is the whole benefit: a guard that no longer has to be maintained.
	it('no longer hand-guards template artwork, which the catalog now reports', async () => {
		mockQuery.mockResolvedValueOnce(FK_ROWS).mockResolvedValueOnce([]);

		await reapFileRefs({ fileIds: ['id-a'], mediaPaths: [] });

		const { sql } = queryAt(1);
		expect(sql).not.toContain('resume_templates');
		expect(sql).not.toContain('config::text');
	});
});

describe('findOrphanedFiles', () => {
	beforeEach(() => {
		vi.useFakeTimers();
		vi.setSystemTime(new Date('2026-08-24T12:00:00.000Z'));
	});

	afterEach(() => {
		vi.useRealTimers();
	});

	/** The cutoff the scan bound, whatever else it bound. */
	function cutoffOf(): Date {
		const cutoff = queryAt(1).params.find((p) => p instanceof Date);
		expect(cutoff).toBeInstanceOf(Date);
		return cutoff as Date;
	}

	// `uploadFile()` inserts the row and *then* hands the id to its caller to
	// store, so an unreferenced row seconds old is an upload in flight, not
	// litter. Without this cutoff the sweep races every upload in the product.
	it('ignores rows younger than a week by default', async () => {
		mockQuery.mockResolvedValueOnce(FK_ROWS).mockResolvedValueOnce([]);

		await findOrphanedFiles();

		expect(DEFAULT_ORPHAN_MIN_AGE_DAYS).toBe(7);
		expect(cutoffOf().toISOString()).toBe('2026-08-17T12:00:00.000Z');
	});

	it('takes a stricter cutoff when asked for one', async () => {
		mockQuery.mockResolvedValueOnce(FK_ROWS).mockResolvedValueOnce([]);

		await findOrphanedFiles({ minAgeDays: 30 });

		expect(cutoffOf().toISOString()).toBe('2026-07-25T12:00:00.000Z');
	});

	it('lists only rows no foreign key reaches', async () => {
		mockQuery.mockResolvedValueOnce(FK_ROWS).mockResolvedValueOnce([]);

		await findOrphanedFiles();

		const { sql } = queryAt(1);
		expect(sql).toContain(
			'NOT EXISTS (SELECT 1 FROM applications WHERE cv_file_sent_id = files.id)'
		);
		expect(sql).toContain('NOT EXISTS (SELECT 1 FROM profile_exports WHERE file_id = files.id)');
	});

	// The scan asks the same question the reap does, so it carries the same
	// guards for the references no constraint declares.
	it('keeps a file only an unconstrained column names', async () => {
		mockQuery.mockResolvedValueOnce(FK_ROWS).mockResolvedValueOnce([]);

		await findOrphanedFiles();

		const { sql } = queryAt(1);
		expect(sql).toContain('NOT EXISTS (SELECT 1 FROM profiles WHERE source_cv = files.id)');
		expect(sql).toContain('NOT EXISTS (SELECT 1 FROM import_logs WHERE file_id = files.id::text)');
	});

	// The driver hands raw SQL back untyped: bigint arrives as a string and so
	// does the timestamp, on which `.toISOString()` throws.
	it('coerces what the driver returns untyped', async () => {
		mockQuery.mockResolvedValueOnce(FK_ROWS).mockResolvedValueOnce([
			{
				id: 'id-a',
				filename_disk: 'a.pdf',
				filename_download: 'Rik CV.pdf',
				filesize: '1048576',
				created_on: '2026-01-02T03:04:05.000Z'
			},
			{
				id: 'id-b',
				filename_disk: null,
				filename_download: 'gone.png',
				filesize: null,
				created_on: new Date('2026-01-02T03:04:05.000Z')
			}
		]);

		const [a, b] = await findOrphanedFiles();

		expect(a.filesize).toBe(1048576);
		expect(a.createdOn).toBeInstanceOf(Date);
		expect(a.createdOn.toISOString()).toBe('2026-01-02T03:04:05.000Z');
		expect(a.filenameDisk).toBe('a.pdf');
		expect(a.filenameDownload).toBe('Rik CV.pdf');
		expect(b.filesize).toBeNull();
		expect(b.filenameDisk).toBeNull();
		expect(b.createdOn).toBeInstanceOf(Date);
	});

	it('caps the result set only when asked to', async () => {
		mockQuery.mockResolvedValueOnce(FK_ROWS).mockResolvedValueOnce([]);
		await findOrphanedFiles();
		expect(queryAt(1).sql).not.toContain('LIMIT');

		mockQuery.mockReset();
		mockQuery.mockResolvedValueOnce(FK_ROWS).mockResolvedValueOnce([]);
		await findOrphanedFiles({ limit: 50 });
		const { sql, params } = queryAt(1);
		expect(sql).toContain('LIMIT');
		expect(params).toContain(50);
	});
});

describe('collectProfileFileRefs', () => {
	it('dedupes both shapes and drops the empty halves', async () => {
		mockQuery.mockResolvedValueOnce([
			{ file_id: 'id-a', media_path: 'profiles/photo.jpg' },
			{ file_id: 'id-a', media_path: null },
			{ file_id: null, media_path: 'profiles/photo.jpg' },
			{ file_id: 'id-b', media_path: 'work/logo.png' },
			{ file_id: null, media_path: null }
		]);

		const refs = await collectProfileFileRefs(7);

		expect(refs.fileIds).toEqual(['id-a', 'id-b']);
		expect(refs.mediaPaths).toEqual(['profiles/photo.jpg', 'work/logo.png']);
	});

	it('asks only about the profile it was given', async () => {
		mockQuery.mockResolvedValueOnce([]);

		await collectProfileFileRefs(7);

		const { params } = queryAt(0);
		expect(params.length).toBeGreaterThan(0);
		expect(new Set(params)).toEqual(new Set([7]));
	});

	// `job_resources` hangs off `jobs`, which is shared between everyone a
	// posting matched and is not deleted with a profile. Reaching it here would
	// delete another user's attachment, and nothing would report it.
	it('never reaches the attachments that belong to a shared job', async () => {
		mockQuery.mockResolvedValueOnce([]);

		await collectProfileFileRefs(7);

		expect(queryAt(0).sql).not.toContain('job_resources');
	});

	it('covers the tables that hold a profile-owned file', async () => {
		mockQuery.mockResolvedValueOnce([]);

		await collectProfileFileRefs(7);

		const { sql } = queryAt(0);
		for (const table of [
			'profiles',
			'work_experiences',
			'education',
			'side_projects',
			'applications',
			'application_records',
			'profile_exports',
			'profile_document_projects',
			'resume_templates',
			'import_logs'
		]) {
			expect(sql, `${table} is not collected`).toContain(table);
		}
	});

	// What the reap refuses to delete for a living profile is exactly what it
	// must collect for a dying one, or the blobs outlive the row — the failure
	// this module exists to close.
	it('collects the references no foreign key declares', async () => {
		mockQuery.mockResolvedValueOnce([]);

		await collectProfileFileRefs(7);

		const { sql, params } = queryAt(0);
		expect(sql).toContain('SELECT source_cv, NULL FROM profiles WHERE id = $');
		expect(sql).toContain('FROM import_logs');
		// Template artwork is collected by an ordinary join now, not by fishing
		// uuid-shaped strings out of the config with `regexp_matches`.
		expect(sql).toContain('FROM resume_template_assets a');
		expect(sql).not.toContain('regexp_matches');
		// The UUID pattern is inlined, not bound: the only parameter is the profile.
		expect(new Set(params)).toEqual(new Set([7]));
	});
});

describe('collectUserFileRefs', () => {
	it('unions every profile the user has, plus what hangs off the account', async () => {
		mockQuery
			// profiles of the user
			.mockResolvedValueOnce([{ id: 1 }, { id: 2 }])
			// profile 1
			.mockResolvedValueOnce([{ file_id: 'id-a', media_path: 'profiles/one.jpg' }])
			// profile 2 — sharing a blob with profile 1
			.mockResolvedValueOnce([{ file_id: 'id-a', media_path: 'profiles/two.jpg' }])
			// user_feedback_files
			.mockResolvedValueOnce([{ file_id: 'id-c' }, { file_id: null }])
			// import_logs — the uploads kept for re-parsing hang off the user
			.mockResolvedValueOnce([{ file_id: 'id-d' }]);

		const refs = await collectUserFileRefs('user-1');

		expect(refs.fileIds).toEqual(['id-a', 'id-c', 'id-d']);
		expect(refs.mediaPaths).toEqual(['profiles/one.jpg', 'profiles/two.jpg']);
	});

	it('still collects the account-scoped files of a user with no profile', async () => {
		mockQuery
			.mockResolvedValueOnce([])
			.mockResolvedValueOnce([{ file_id: 'id-c' }])
			.mockResolvedValueOnce([]);

		const refs = await collectUserFileRefs('user-1');

		expect(refs).toEqual({ fileIds: ['id-c'], mediaPaths: [] });
	});

	// `account/delete.ts` removes `import_logs` by user id before it reaps, so
	// their files have to be collected here or they outlive the account.
	it('asks import_logs about the user, not a profile', async () => {
		mockQuery.mockResolvedValueOnce([]).mockResolvedValueOnce([]).mockResolvedValueOnce([]);

		await collectUserFileRefs('user-1');

		const { sql, params } = queryAt(2);
		expect(sql).toContain('FROM import_logs');
		expect(sql).toContain('user_id = $');
		expect(params).toEqual(['user-1']);
	});
});
