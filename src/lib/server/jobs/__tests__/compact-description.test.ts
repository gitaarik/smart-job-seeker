/**
 * Tests for the shortened-posting cache.
 *
 * Two things matter here and neither is the summary itself (that is what the
 * `compact-job-description` llm:smoke case is for): WHEN the model is called,
 * and what happens when its answer is unusable. Both failure modes are silent —
 * one spends an LLM call on every generation for a posting that will never
 * compact, the other substitutes a one-line refusal for the job an applicant is
 * writing about.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';

const mockGenerate = vi.hoisted(() => vi.fn());
vi.mock('$lib/server/ai-chat/utils', () => ({ createAndGenerateAiChat: mockGenerate }));

const mockWhere = vi.hoisted(() => vi.fn().mockResolvedValue(undefined));
// Typed on the way in: the assertions below read what `.set()` was called with,
// and an untyped vi.fn() records a zero-length tuple that cannot be indexed.
const mockSet = vi.hoisted(() =>
	vi.fn<(values: Record<string, unknown>) => { where: typeof mockWhere }>(() => ({
		where: mockWhere
	}))
);
const mockUpdate = vi.hoisted(() => vi.fn(() => ({ set: mockSet })));
vi.mock('$lib/server/db', () => ({ dbDirect: { update: mockUpdate } }));
vi.mock('drizzle-orm', () => ({ eq: (c: unknown, v: unknown) => ({ eq: [c, v] }) }));
vi.mock('$lib/server/db/schema', () => ({ jobs: { id: 'jobs.id' } }));

const { COMPACT_THRESHOLD_CHARS, promptJobDescription } = await import('../compact-description');

/** Longer than the threshold, and made of real words so nothing reads as binary. */
const longPosting = ('We are hiring a backend engineer. ' as string).repeat(400);
const shortPosting = 'We are hiring a backend engineer. Python, 5 years.';

const job = (over: Partial<Parameters<typeof promptJobDescription>[0]> = {}) => ({
	id: 7,
	job_description: longPosting,
	description_compact: null,
	description_compact_hash: null,
	description_compact_status: null,
	...over
});

/** What the last update wrote, if any. */
const written = () => mockSet.mock.calls.at(-1)?.[0] as Record<string, unknown> | undefined;

const answered = (text: string | null) =>
	mockGenerate.mockResolvedValue({ success: true, aiChat: { response: text } });

beforeEach(() => {
	mockGenerate.mockReset();
	mockUpdate.mockClear();
	mockSet.mockClear();
	mockWhere.mockClear();
});

describe('promptJobDescription', () => {
	it('leaves a short posting alone and never calls the model', async () => {
		// 97% of postings on dev. Paying an LLM call for these is the version of
		// this feature that does not pay for itself.
		expect(shortPosting.length).toBeLessThan(COMPACT_THRESHOLD_CHARS);
		const res = await promptJobDescription(job({ job_description: shortPosting }), 1);
		expect(res).toEqual({ text: shortPosting, compacted: false });
		expect(mockGenerate).not.toHaveBeenCalled();
	});

	it('records a short posting as skipped once, not on every generation', async () => {
		await promptJobDescription(job({ job_description: shortPosting }), 1);
		expect(written()).toEqual({ description_compact_status: 'skipped' });

		mockSet.mockClear();
		await promptJobDescription(
			job({ job_description: shortPosting, description_compact_status: 'skipped' }),
			1
		);
		expect(mockSet).not.toHaveBeenCalled();
	});

	it('shortens a long posting and stores it against the text it was made from', async () => {
		answered('SHORT VERSION. '.repeat(200));
		const res = await promptJobDescription(job(), 1);

		expect(res.compacted).toBe(true);
		expect(res.text).toContain('SHORT VERSION');
		const stored = written()!;
		expect(stored.description_compact_status).toBe('done');
		expect(stored.description_compact_hash).toMatch(/^[0-9a-f]{64}$/);
	});

	it('reuses the cache without calling the model again', async () => {
		answered('SHORT VERSION. '.repeat(200));
		const hash = (written: Record<string, unknown>) => written.description_compact_hash as string;
		await promptJobDescription(job(), 1);
		const cached = {
			description_compact: 'CACHED',
			description_compact_hash: hash(written()!),
			description_compact_status: 'done'
		};

		mockGenerate.mockClear();
		const res = await promptJobDescription(job(cached), 1);
		expect(res).toEqual({ text: 'CACHED', compacted: true });
		expect(mockGenerate).not.toHaveBeenCalled();
	});

	it('regenerates when the posting has been edited since', async () => {
		// The hash is the whole point of storing one: without it an edited posting
		// keeps serving a summary of text that no longer exists.
		answered('SHORT VERSION. '.repeat(200));
		const res = await promptJobDescription(
			job({
				description_compact: 'STALE',
				description_compact_hash: 'a'.repeat(64),
				description_compact_status: 'done'
			}),
			1
		);
		expect(mockGenerate).toHaveBeenCalledOnce();
		expect(res.text).not.toBe('STALE');
	});

	it('does not retry a posting that already failed on this exact text', async () => {
		answered('SHORT VERSION. '.repeat(200));
		await promptJobDescription(job(), 1);
		const hash = written()!.description_compact_hash as string;

		mockGenerate.mockClear();
		const res = await promptJobDescription(
			job({ description_compact_hash: hash, description_compact_status: 'failed' }),
			1
		);
		expect(res).toEqual({ text: longPosting, compacted: false });
		expect(mockGenerate).not.toHaveBeenCalled();
	});

	it('rejects an answer that did not actually shorten anything', async () => {
		answered(longPosting + ' and more');
		const res = await promptJobDescription(job(), 1);
		expect(res).toEqual({ text: longPosting, compacted: false });
		expect(written()!.description_compact_status).toBe('failed');
	});

	it('rejects a collapsed answer rather than substituting it for the job', async () => {
		// A refusal, a preamble, or a single line. Well-formed, and it would erase
		// the posting from every letter written for this job.
		answered('Sure! Here is the shortened posting.');
		const res = await promptJobDescription(job(), 1);
		expect(res).toEqual({ text: longPosting, compacted: false });
		expect(written()!.description_compact_status).toBe('failed');
	});

	it('falls back to the full posting when the call throws', async () => {
		mockGenerate.mockRejectedValue(new Error('provider down'));
		const res = await promptJobDescription(job(), 1);
		expect(res).toEqual({ text: longPosting, compacted: false });
		expect(written()!.description_compact_status).toBe('failed');
	});

	it('survives a failed write, because context is never a reason to fail', async () => {
		answered('SHORT VERSION. '.repeat(200));
		mockWhere.mockRejectedValueOnce(new Error('db down'));
		await expect(promptJobDescription(job(), 1)).resolves.toMatchObject({ compacted: true });
	});

	it('has nothing to do for a job with no description', async () => {
		const res = await promptJobDescription(job({ job_description: null }), 1);
		expect(res).toEqual({ text: null, compacted: false });
		expect(mockGenerate).not.toHaveBeenCalled();
		expect(mockSet).not.toHaveBeenCalled();
	});
});
