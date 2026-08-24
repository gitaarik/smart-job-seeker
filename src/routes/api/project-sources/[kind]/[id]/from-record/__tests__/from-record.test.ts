/**
 * POST /api/project-sources/[kind]/[id]/from-record
 *
 * What matters here is not visible in the UI: the entry is copied into a
 * project the caller owns, and only an entry of the caller's own application —
 * the project id comes from the URL and the entry id from the body, and each
 * is checked against the profile behind the session. Beyond that: a second
 * copy is answered with the first, an unread file is read before it is copied,
 * and the copy goes through the upload route's guards.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';

const mockRecordFindFirst = vi.fn();
const mockDocumentsFindMany = vi.fn();
const mockRequireRowActor = vi.fn();
const mockRequireCredits = vi.fn();
const mockRequireQuota = vi.fn();
const mockSave = vi.fn();
const mockSetSummary = vi.fn();
const mockSummarize = vi.fn();
const mockExtractRecordFile = vi.fn();

vi.mock('$lib/server/db', () => ({
	dbDirect: {
		query: {
			application_records: { findFirst: (...a: unknown[]) => mockRecordFindFirst(...a) },
			profile_document_projects: { findMany: (...a: unknown[]) => mockDocumentsFindMany(...a) }
		}
	}
}));

vi.mock('drizzle-orm', () => ({
	eq: vi.fn((_c: unknown, v: unknown) => v),
	desc: vi.fn((c: unknown) => c)
}));

vi.mock('$lib/server/db/schema', () => ({
	application_records: { id: 'ar.id' },
	profile_document_projects: {
		side_project_id: 'pdp.side_project_id',
		work_experience_project_id: 'pdp.work_experience_project_id',
		date_created: 'pdp.date_created'
	}
}));

vi.mock('$lib/server/profile/write-http', () => ({
	requireRowActor: (...a: unknown[]) => mockRequireRowActor(...a)
}));
vi.mock('$lib/server/billing/require-credits', () => ({
	requireCredits: (...a: unknown[]) => mockRequireCredits(...a)
}));
vi.mock('$lib/server/billing/require-document-quota', () => ({
	requireDocumentQuota: (...a: unknown[]) => mockRequireQuota(...a)
}));
vi.mock('$lib/server/documents/store', () => ({
	saveExtractedProject: (...a: unknown[]) => mockSave(...a),
	setProjectSummary: (...a: unknown[]) => mockSetSummary(...a)
}));
vi.mock('$lib/server/documents/summarize', () => ({
	summarizeProject: (...a: unknown[]) => mockSummarize(...a)
}));
vi.mock('$lib/server/ai-chat/application-activity', () => ({
	extractRecordFile: (...a: unknown[]) => mockExtractRecordFile(...a)
}));
vi.mock('$lib/server/documents/project-corpus', () => ({
	parseProjectKind: (v: string) =>
		v === 'side_project' || v === 'work_experience_project' ? v : null
}));

import { POST } from '../+server';

const record = {
	id: 7,
	title: 'You passed our annotation test',
	record_type: 'message',
	content: 'Hi Rik, you passed - welcome to the bench.',
	event_date: '2026-05-21',
	extraction_status: 'none',
	application: { id: 25, profile_id: 1, job: { title: 'Senior Code Reviewer', company: 'G2i' } },
	file: null
};

function event(opts: { user?: unknown; kind?: string; id?: string; body?: unknown } = {}) {
	const user = opts.user === undefined ? { id: 'user-1' } : opts.user;
	return {
		params: { kind: opts.kind ?? 'side_project', id: opts.id ?? '36' },
		locals: { user, session: null },
		request: new Request('http://localhost/api/project-sources/side_project/36/from-record', {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify(opts.body ?? { record_id: 7 })
		})
	} as unknown as Parameters<typeof POST>[0];
}

beforeEach(() => {
	vi.clearAllMocks();
	mockRequireRowActor.mockResolvedValue({ profileId: 1, source: 'ui' });
	mockRecordFindFirst.mockResolvedValue(record);
	mockDocumentsFindMany.mockResolvedValue([]);
	mockRequireCredits.mockResolvedValue(undefined);
	mockRequireQuota.mockResolvedValue(undefined);
	mockSave.mockResolvedValue({ id: 99, status: 'extracted', kind: 'file', title: record.title });
	mockSetSummary.mockResolvedValue(undefined);
	mockSummarize.mockResolvedValue({ summary: 'Passed the test.', keywords: ['code review'] });
});

describe('POST /api/project-sources/[kind]/[id]/from-record', () => {
	it('rejects unauthenticated', async () => {
		await expect(POST(event({ user: null }))).rejects.toMatchObject({ status: 401 });
	});

	it('rejects an unknown project kind before touching the database', async () => {
		await expect(POST(event({ kind: 'portfolio' }))).rejects.toMatchObject({ status: 400 });
		expect(mockRequireRowActor).not.toHaveBeenCalled();
	});

	it('fails closed on a project the caller does not own', async () => {
		mockRequireRowActor.mockRejectedValueOnce(Object.assign(new Error('denied'), { status: 403 }));
		await expect(POST(event())).rejects.toMatchObject({ status: 403 });
		expect(mockRecordFindFirst).not.toHaveBeenCalled();
	});

	it('requires a numeric record id', async () => {
		await expect(POST(event({ body: {} }))).rejects.toMatchObject({ status: 400 });
		await expect(POST(event({ body: { record_id: '7' } }))).rejects.toMatchObject({ status: 400 });
		expect(mockRecordFindFirst).not.toHaveBeenCalled();
	});

	it('gives a missing entry and another applicant’s entry the same answer', async () => {
		mockRecordFindFirst.mockResolvedValueOnce(null);
		await expect(POST(event())).rejects.toMatchObject({ status: 404 });

		mockRecordFindFirst.mockResolvedValueOnce({
			...record,
			application: { ...record.application, profile_id: 2 }
		});
		await expect(POST(event())).rejects.toMatchObject({ status: 404 });
		expect(mockSave).not.toHaveBeenCalled();
	});

	it('answers a second copy with the first instead of writing another', async () => {
		mockDocumentsFindMany.mockResolvedValueOnce([
			{ id: 5, title: 'Something else', source: { type: 'upload', filename: 'x.pdf' } },
			{
				id: 12,
				title: record.title,
				source: { type: 'application_record', application_id: 25, record_id: 7 }
			}
		]);
		const res = await POST(event());
		expect(await res.json()).toEqual({
			success: true,
			unchanged: true,
			document: { id: 12, title: record.title }
		});
		expect(mockRequireCredits).not.toHaveBeenCalled();
		expect(mockSave).not.toHaveBeenCalled();
	});

	it('scopes the duplicate check to the target project of the target kind', async () => {
		await POST(event({ kind: 'work_experience_project', id: '270' }));
		expect(mockDocumentsFindMany).toHaveBeenCalledWith(expect.objectContaining({ where: 270 }));
		expect(mockSave.mock.calls[0][0]).toMatchObject({
			sideProjectId: null,
			workExperienceProjectId: 270
		});
	});

	it('refuses an entry with no text', async () => {
		mockRecordFindFirst.mockResolvedValueOnce({ ...record, content: '   ' });
		await expect(POST(event())).rejects.toMatchObject({ status: 400 });
		expect(mockRequireCredits).not.toHaveBeenCalled();
	});

	it('reads an unread file first, and copies what it read', async () => {
		mockRecordFindFirst.mockResolvedValueOnce({
			...record,
			content: null,
			extraction_status: 'pending',
			file: { filename_download: 'brief.pdf' }
		});
		mockExtractRecordFile.mockResolvedValueOnce('The brief, extracted.');

		await POST(event());

		expect(mockExtractRecordFile).toHaveBeenCalledWith(7);
		const [input, extracted] = mockSave.mock.calls[0];
		expect(input.filename).toBe('brief.pdf');
		expect(extracted.files[0].path).toBe('application/you-passed-our-annotation-test.pdf');
		expect(extracted.files[0].text).toContain('The brief, extracted.');
	});

	it('does not read a file that has already been read or skipped', async () => {
		mockRecordFindFirst.mockResolvedValueOnce({ ...record, extraction_status: 'extracted' });
		await POST(event());
		expect(mockExtractRecordFile).not.toHaveBeenCalled();
	});

	it('copies the entry as a file on the project, through the upload guards', async () => {
		const res = await POST(event());
		const body = await res.json();

		expect(mockRequireCredits).toHaveBeenCalledWith('user-1', 3);
		const [input, extracted] = mockSave.mock.calls[0];
		expect(mockRequireQuota).toHaveBeenCalledWith('user-1', extracted.totalBytes, 1);
		expect(input).toMatchObject({
			profileId: 1,
			sideProjectId: 36,
			workExperienceProjectId: null,
			kind: 'file',
			title: record.title,
			filename: null,
			source: { type: 'application_record', application_id: 25, record_id: 7 }
		});
		expect(extracted.files[0].text.split('\n')[0]).toContain('for Senior Code Reviewer at G2i');
		expect(mockSetSummary).toHaveBeenCalledWith(99, 'Passed the test.', ['code review']);
		expect(body).toMatchObject({
			success: true,
			unchanged: false,
			document: { id: 99, summary: 'Passed the test.', keywords: ['code review'] }
		});
	});

	it('still copies when the summarizer fails', async () => {
		mockSummarize.mockRejectedValueOnce(new Error('LLM down'));
		const res = await POST(event());
		const body = await res.json();
		expect(mockSave).toHaveBeenCalledTimes(1);
		expect(mockSetSummary).not.toHaveBeenCalled();
		expect(body.document).toMatchObject({ id: 99, summary: null, keywords: null });
	});
});
