/**
 * Uploaded documents in the profile export.
 *
 * The load-bearing property is the positional join: the export carries no
 * database ids, so a document finds its project again only if the index it
 * recorded still points at the same entity after import.
 */

import { beforeEach, describe, expect, it, vi } from 'vitest';

const findMany = vi.fn();

vi.mock('$lib/server/db', () => ({
	dbDirect: {
		query: {
			profile_document_projects: {
				findMany: (...args: unknown[]) => findMany(...args)
			}
		}
	}
}));

import {
	buildDocumentExport,
	documentArchiveDir,
	sanitizeArchivePath,
	type ProjectIndexMaps
} from '../export-documents';
import { resolveParentIds, type CreatedProjectIds } from '../import-documents';
import type { ExportedDocument } from '../types';

function maps(overrides: Partial<ProjectIndexMaps> = {}): ProjectIndexMaps {
	return {
		workExperienceIndexById: new Map(),
		workExperienceProjectIndexById: new Map(),
		sideProjectIndexById: new Map(),
		...overrides
	};
}

function documentRow(overrides: Record<string, unknown> = {}) {
	return {
		id: 1,
		kind: 'archive',
		title: 'Payments Service',
		original_filename: 'payments.zip',
		source: { type: 'archive', filename: 'payments.zip' },
		summary: 'A payments service',
		keywords: ['go', 'postgres'],
		status: 'extracted',
		skipped: null,
		file_count: 1,
		total_chars: 12,
		total_bytes: 12,
		sort: 0,
		work_experience_id: null,
		work_experience_project_id: null,
		side_project_id: null,
		profile_document_files: [
			{ path: 'src/main.go', ext: 'go', extracted_text: 'package main', chars: 12, sort: 0 }
		],
		...overrides
	};
}

describe('sanitizeArchivePath', () => {
	it('strips traversal segments from a crafted manifest', () => {
		expect(sanitizeArchivePath('../../etc/passwd', 0)).toBe('etc/passwd');
		expect(sanitizeArchivePath('/absolute/path.ts', 0)).toBe('absolute/path.ts');
		expect(sanitizeArchivePath('a/./b/../c.ts', 0)).toBe('a/b/c.ts');
	});

	it('normalizes windows separators', () => {
		expect(sanitizeArchivePath('src\\lib\\foo.ts', 0)).toBe('src/lib/foo.ts');
	});

	it('falls back to a positional name when the path is empty', () => {
		expect(sanitizeArchivePath(null, 2)).toBe('file-3.txt');
		expect(sanitizeArchivePath('   ', 0)).toBe('file-1.txt');
	});
});

describe('documentArchiveDir', () => {
	it('keeps same-titled attachments apart', () => {
		expect(documentArchiveDir(0, 'My Project')).toBe('documents/01-my-project');
		expect(documentArchiveDir(1, 'My Project')).toBe('documents/02-my-project');
	});

	it('survives a title with nothing sluggable in it', () => {
		expect(documentArchiveDir(0, '///')).toBe('documents/01-document');
		expect(documentArchiveDir(0, null)).toBe('documents/01-document');
	});
});

describe('buildDocumentExport', () => {
	beforeEach(() => {
		vi.clearAllMocks();
	});

	it('keeps extracted text out of the manifest and in the payload', async () => {
		findMany.mockResolvedValueOnce([documentRow()]);

		const { documents, documentFiles } = await buildDocumentExport(1, maps());

		// The whole point of the file-per-document layout: an attachment may hold
		// hundreds of MB, which must never be inlined into data.json.
		expect(JSON.stringify(documents)).not.toContain('package main');
		expect(documentFiles).toEqual([
			{ archivePath: 'documents/01-payments-service/src/main.go', text: 'package main' }
		]);
		expect(documents[0].files[0].archivePath).toBe('documents/01-payments-service/src/main.go');
	});

	it('carries the summary and keywords the AI features depend on', async () => {
		findMany.mockResolvedValueOnce([documentRow()]);

		const { documents } = await buildDocumentExport(1, maps());

		expect(documents[0].summary).toBe('A payments service');
		expect(documents[0].keywords).toEqual(['go', 'postgres']);
	});

	it('references a work-experience project by position', async () => {
		findMany.mockResolvedValueOnce([documentRow({ work_experience_project_id: 77 })]);

		const { documents } = await buildDocumentExport(
			1,
			maps({
				workExperienceProjectIndexById: new Map([
					[77, { work_experience_index: 2, project_index: 1 }]
				])
			})
		);

		expect(documents[0].attached_to).toEqual({
			kind: 'work_experience_project',
			work_experience_index: 2,
			project_index: 1
		});
	});

	it('references a side project by position', async () => {
		findMany.mockResolvedValueOnce([documentRow({ side_project_id: 5 })]);

		const { documents } = await buildDocumentExport(
			1,
			maps({ sideProjectIndexById: new Map([[5, 3]]) })
		);

		expect(documents[0].attached_to).toEqual({ kind: 'side_project', side_project_index: 3 });
	});

	it('exports an orphaned attachment loose rather than dropping it', async () => {
		// work_experience_id is ON DELETE SET NULL, so a row can outlive its parent.
		findMany.mockResolvedValueOnce([documentRow({ work_experience_id: 999 })]);

		const { documents, documentFiles } = await buildDocumentExport(1, maps());

		expect(documents[0].attached_to).toEqual({ kind: 'unattached' });
		expect(documentFiles).toHaveLength(1);
	});
});

describe('export/import round trip', () => {
	function created(overrides: Partial<CreatedProjectIds> = {}): CreatedProjectIds {
		return {
			workExperienceIdByIndex: [],
			workExperienceProjectIdByIndex: new Map(),
			sideProjectIdByIndex: [],
			...overrides
		};
	}

	it('reattaches a work-experience project to its new ids', async () => {
		findMany.mockResolvedValueOnce([documentRow({ work_experience_project_id: 77 })]);

		const { documents } = await buildDocumentExport(
			1,
			maps({
				workExperienceIndexById: new Map([[10, 2]]),
				workExperienceProjectIndexById: new Map([
					[77, { work_experience_index: 2, project_index: 1 }]
				])
			})
		);

		// Import assigns entirely different ids; only the positions carry over.
		const ids = created({
			workExperienceIdByIndex: [500, 501, 502],
			workExperienceProjectIdByIndex: new Map([['2:1', 900]])
		});

		// Only the project id is set — matching what the upload API writes, so an
		// imported profile is shaped like a native one.
		expect(resolveParentIds(documents[0], ids)).toEqual({
			work_experience_id: null,
			work_experience_project_id: 900,
			side_project_id: null
		});
	});

	it('reattaches a side project to its new id', async () => {
		findMany.mockResolvedValueOnce([documentRow({ side_project_id: 5 })]);

		const { documents } = await buildDocumentExport(
			1,
			maps({ sideProjectIndexById: new Map([[5, 1]]) })
		);

		expect(resolveParentIds(documents[0], created({ sideProjectIdByIndex: [300, 301] }))).toEqual({
			work_experience_id: null,
			work_experience_project_id: null,
			side_project_id: 301
		});
	});

	it('imports loose when the position no longer resolves', () => {
		const document = {
			attached_to: { kind: 'side_project', side_project_index: 9 }
		} as ExportedDocument;

		expect(resolveParentIds(document, created({ sideProjectIdByIndex: [300] }))).toEqual({
			work_experience_id: null,
			work_experience_project_id: null,
			side_project_id: null
		});
	});
});
