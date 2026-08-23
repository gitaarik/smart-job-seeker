/**
 * Reading an attached file into its entry.
 *
 * Both cases here are bugs that were live, found by attaching a real scanned
 * contract through the MCP upload door:
 *
 *  - `pdf-parse` emits a `-- 1 of 6 --` marker for every page whether or not
 *    the page had text on it, so a scan with no text layer came back as six
 *    markers rather than empty. A truthiness test called that success, and the
 *    entry ended up "extracted" with page numbers for content.
 *  - the write was an unconditional overwrite, which was harmless only while
 *    the composer was the only door. It attaches a file as the entry is
 *    created, so there was nothing to lose; an entry that already said
 *    something lost it. Measured on a real one: 2,400 characters of summary
 *    replaced by 92 characters of markers.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';

const state = vi.hoisted(() => ({
	row: null as Record<string, unknown> | null,
	written: null as Record<string, unknown> | null,
	extractedText: ''
}));

vi.mock('$lib/server/db', () => ({
	db: {
		query: { application_records: { findFirst: () => Promise.resolve(state.row) } },
		update: () => ({
			set: (values: Record<string, unknown>) => ({
				where: () => {
					state.written = values;
					return Promise.resolve(undefined);
				}
			})
		})
	},
	dbDirect: {}
}));

vi.mock('$lib/server/files', () => ({
	getFile: vi.fn().mockResolvedValue(Buffer.from('pretend bytes'))
}));

vi.mock('$lib/server/documents/extract', () => ({
	extractUpload: vi.fn(() => Promise.resolve({ files: [{ text: state.extractedText }] }))
}));

const { extractRecordFile } = await import('../application-activity');

/** Six pages of a scan with no text layer, exactly as pdf-parse returns it. */
const PAGE_MARKERS_ONLY = Array.from({ length: 6 }, (_, i) => `-- ${i + 1} of 6 --`).join(
	'\n\n\n\n'
);

const SUMMARY = 'Signed an arbeidsovereenkomst with Citrus Flex B.V. on 6 July 2026.';

beforeEach(() => {
	state.row = {
		id: 73,
		file_id: 'file-uuid-1',
		extraction_status: 'pending',
		content: null,
		file: { filename_download: 'contract.pdf', title: 'contract.pdf' }
	};
	state.written = null;
	state.extractedText = 'The real text of the contract.';
});

describe('extractRecordFile', () => {
	it('reads a file with text into an entry that had none', async () => {
		const text = await extractRecordFile(73);

		expect(text).toBe('The real text of the contract.');
		expect(state.written).toMatchObject({
			content: 'The real text of the contract.',
			extraction_status: 'extracted'
		});
	});

	it('treats page markers with nothing between them as no text', async () => {
		state.extractedText = PAGE_MARKERS_ONLY;

		const text = await extractRecordFile(73);

		expect(text).toBeNull();
		expect(state.written).toMatchObject({
			extraction_status: 'skipped',
			extraction_error: 'no extractable text'
		});
		// And crucially, no content was written at all.
		expect(state.written).not.toHaveProperty('content');
	});

	it('keeps what the entry already said, and adds the file underneath', async () => {
		state.row!.content = SUMMARY;

		const text = await extractRecordFile(73);

		expect(text).toContain(SUMMARY);
		expect(text).toContain('The real text of the contract.');
		expect(String(state.written?.content).indexOf(SUMMARY)).toBe(0);
	});

	it('does not destroy a note when the file turns out to be unreadable', async () => {
		// The combination that actually happened: an entry with a written summary,
		// and a scan with nothing in it.
		state.row!.content = SUMMARY;
		state.extractedText = PAGE_MARKERS_ONLY;

		await extractRecordFile(73);

		expect(state.written).not.toHaveProperty('content');
		expect(state.written).toMatchObject({ extraction_status: 'skipped' });
	});

	it('does not duplicate the text when the entry already holds the extraction', async () => {
		// A re-extraction of an entry whose content IS the previous extraction.
		state.row!.content = 'The real text of the contract.';

		await extractRecordFile(73);

		expect(state.written?.content).toBe('The real text of the contract.');
	});
});
