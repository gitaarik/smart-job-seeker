/**
 * Tests for attaching a file to an activity entry.
 *
 * Two things carry the weight here:
 *
 *  - the claim is a conditional UPDATE, so a replayed grant and a race lose the
 *    same way — the invariant is decided by the database rather than by a check
 *    that ran a statement earlier;
 *  - nothing derives or summarises until there is text to read, because a
 *    file-backed entry has no content of its own and derivation would otherwise
 *    title every attachment after its filename and never correct it.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';

const claimed = vi.hoisted(() => ({ rows: [{ id: 73 }] as Array<{ id: number }> }));
const calls = vi.hoisted(() => ({ order: [] as string[] }));

const mockUpdateWhere = vi.hoisted(() => vi.fn());
vi.mock('$lib/server/db', () => ({
	db: {
		update: () => ({
			set: (values: unknown) => ({
				where: (predicate: unknown) => {
					mockUpdateWhere(values, predicate);
					return { returning: () => Promise.resolve(claimed.rows) };
				}
			})
		})
	},
	dbDirect: {}
}));

const mockUpload = vi.hoisted(() =>
	vi.fn().mockResolvedValue({ id: 'file-uuid-1', filename_download: 'contract.pdf' })
);
vi.mock('$lib/server/files', () => ({ uploadFile: mockUpload }));

const mockExtract = vi.hoisted(() => vi.fn());
vi.mock('$lib/server/ai-chat/application-activity', () => ({
	extractRecordFile: (...a: unknown[]) => {
		calls.order.push('extract');
		return mockExtract(...a);
	}
}));

const mockDerive = vi.hoisted(() => vi.fn().mockResolvedValue(undefined));
vi.mock('$lib/server/ai-chat/record-derivation', () => ({
	deriveRecordMetadata: (...a: unknown[]) => {
		calls.order.push('derive');
		return mockDerive(...a);
	}
}));

const mockSummarize = vi.hoisted(() => vi.fn().mockResolvedValue(undefined));
vi.mock('$lib/server/ai-chat/application-summary', () => ({
	summarizeApplication: (...a: unknown[]) => {
		calls.order.push('summarise');
		return mockSummarize(...a);
	}
}));

const { attachFileToRecord } = await import('../record-files');

const INPUT = {
	recordId: 73,
	applicationId: 57,
	profileId: 1,
	filename: 'contract.pdf',
	buffer: Buffer.from('%PDF-1.7 pretend')
};

beforeEach(() => {
	claimed.rows = [{ id: 73 }];
	calls.order.length = 0;
	mockUpload.mockClear();
	mockUpdateWhere.mockClear();
	mockExtract.mockReset().mockResolvedValue('the contract text');
	mockDerive.mockClear();
	mockSummarize.mockClear();
});

describe('attachFileToRecord', () => {
	it('stores the file, claims the slot, then reads it', async () => {
		const result = await attachFileToRecord(INPUT);

		expect(mockUpload).toHaveBeenCalledWith({
			filename: 'contract.pdf',
			buffer: INPUT.buffer,
			title: 'contract.pdf'
		});
		expect(mockUpdateWhere).toHaveBeenCalledWith(
			{ file_id: 'file-uuid-1', extraction_status: 'pending' },
			expect.anything()
		);
		expect(result).toEqual({ fileId: 'file-uuid-1', extracted: true });
	});

	it('extracts before deriving, and derives before summarising', async () => {
		// The summariser reads what derivation produced, and derivation reads what
		// extraction produced. Any other order digests placeholders.
		await attachFileToRecord(INPUT);

		expect(calls.order).toEqual(['extract', 'derive', 'summarise']);
	});

	it('refuses an entry whose slot is already filled', async () => {
		// What a replayed grant gets, and what the loser of a race gets.
		claimed.rows = [];

		const result = await attachFileToRecord(INPUT);

		expect(result).toMatchObject({ error: expect.stringContaining('already has a file') });
		// Nothing downstream ran: no text was read, nothing was re-summarised.
		expect(calls.order).toEqual([]);
	});

	it('keeps a file that yielded no text, and leaves the entry alone', async () => {
		// A scan with no text layer — exactly the contract PDF this was built for.
		mockExtract.mockResolvedValue(null);

		const result = await attachFileToRecord(INPUT);

		expect(result).toEqual({ fileId: 'file-uuid-1', extracted: false });
		// Attached and downloadable, but nothing to derive from and nothing to
		// re-digest, so the entry keeps whatever it already said.
		expect(calls.order).toEqual(['extract']);
		expect(mockDerive).not.toHaveBeenCalled();
		expect(mockSummarize).not.toHaveBeenCalled();
	});
});
