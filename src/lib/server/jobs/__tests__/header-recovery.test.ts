/**
 * Tests for the header-only second pass.
 *
 * The grounding itself is covered in extracted-header.test.ts; what this pins
 * is the seam around the model call: what it is asked, that a failure comes
 * back as an all-null header rather than an exception, that an answer is
 * grounded before it is trusted, and that a title suggestion rides along
 * separately from the grounded fields.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';

const mockRunProfileAiChat = vi.hoisted(() => vi.fn());
vi.mock('$lib/server/ai-chat/job-utils', () => ({
	runProfileAiChat: mockRunProfileAiChat
}));

const { recoverPostingHeader } = await import('../header-recovery');

const POSTING =
	'Opdrachtomschrijving\n\nOpdrachten toegekend door het bestuursteam van de Belastingdienst.';
const LONG_POSTING = `${POSTING}\n\n${'Ervaring met programmeren, AI en automatiseringstechnologieën. '.repeat(6)}`;

const NONE = {
	title: null,
	company: null,
	job_poster: null,
	location: null,
	suggested_title: null
};

function respond(response: Record<string, unknown> | null, success = true) {
	mockRunProfileAiChat.mockResolvedValue({
		success,
		message: success ? 'ok' : 'Out of credits',
		response,
		aiChatId: success ? 1 : null
	});
}

beforeEach(() => {
	mockRunProfileAiChat.mockReset();
});

describe('recoverPostingHeader', () => {
	it('asks the header prompt for the prepared posting', async () => {
		respond({});
		await recoverPostingHeader(POSTING, 7);
		expect(mockRunProfileAiChat).toHaveBeenCalledWith(7, 'extract_job_header', {
			posting: POSTING
		});
	});

	it('returns the grounded answer', async () => {
		respond({
			title: null,
			company: {
				value: 'Belastingdienst',
				quote: 'toegekend door het bestuursteam van de Belastingdienst'
			},
			job_poster: { value: 'Tech Recruiters', quote: 'Posted by Tech Recruiters' },
			location: null
		});
		expect(await recoverPostingHeader(POSTING, 7)).toEqual({
			...NONE,
			company: 'Belastingdienst'
			// job_poster's quote is not in the posting — the value goes with it.
		});
	});

	it('carries a title suggestion for a substantial posting', async () => {
		respond({ title: null, suggested_title: 'Developer AI & procesautomatisering (BZB)' });
		expect(await recoverPostingHeader(LONG_POSTING, 7)).toEqual({
			...NONE,
			suggested_title: 'Developer AI & procesautomatisering (BZB)'
		});
	});

	it('drops the suggestion for a short posting', async () => {
		respond({ title: null, suggested_title: 'Developer' });
		expect(await recoverPostingHeader(POSTING, 7)).toEqual(NONE);
	});

	it('is all-null when the model call fails', async () => {
		respond(null, false);
		expect(await recoverPostingHeader(POSTING, 7)).toEqual(NONE);
	});
});
