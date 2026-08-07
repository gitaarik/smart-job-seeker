/**
 * Tests for POST /api/ai/questions/extract
 *
 * The LLM call itself is mocked (createAndGenerateAiChat) — these cover the
 * endpoint's own branches: auth, input validation, response parsing/validation,
 * and the empty-pair filtering. Real model behaviour is covered by llm:smoke.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';

const mockGetSelectedProfileId = vi.fn();
const mockCreateAndGenerate = vi.fn();

vi.mock('$lib/server/profile/selected-profile', () => ({
	getSelectedProfileId: (...a: any[]) => mockGetSelectedProfileId(...a)
}));

vi.mock('$lib/server/ai-chat/utils', () => ({
	createAndGenerateAiChat: (...a: any[]) => mockCreateAndGenerate(...a)
}));

vi.mock('$lib/server/billing/require-credits', () => ({
	requireCredits: vi.fn().mockResolvedValue(undefined)
}));

import { POST } from '../+server';

function createEvent(body: unknown, opts: { user?: any; rawBody?: string } = {}) {
	return {
		locals: { user: opts.user === undefined ? { id: 'user-1' } : opts.user },
		cookies: {} as any,
		request: new Request('http://localhost/api/ai/questions/extract', {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: opts.rawBody !== undefined ? opts.rawBody : JSON.stringify(body)
		})
	} as any;
}

function aiResponse(pairs: unknown) {
	return { success: true, aiChat: { response: JSON.stringify({ pairs }) } };
}

describe('POST /api/ai/questions/extract', () => {
	beforeEach(() => {
		vi.clearAllMocks();
		mockGetSelectedProfileId.mockResolvedValue(12);
	});

	it('rejects unauthenticated', async () => {
		await expect(POST(createEvent({ text: 'x' }, { user: null }))).rejects.toMatchObject({
			status: 401
		});
	});

	it('returns 400 when no profile is selected', async () => {
		mockGetSelectedProfileId.mockResolvedValueOnce(null);
		const res = await POST(createEvent({ text: 'x' }));
		expect(res.status).toBe(400);
	});

	it('returns 400 on an unparseable JSON body', async () => {
		const res = await POST(createEvent(null, { rawBody: '{not json' }));
		expect(res.status).toBe(400);
		expect(mockCreateAndGenerate).not.toHaveBeenCalled();
	});

	it('returns 400 on empty text', async () => {
		const res = await POST(createEvent({ text: '   ' }));
		expect(res.status).toBe(400);
		expect(mockCreateAndGenerate).not.toHaveBeenCalled();
	});

	it('returns 400 when text exceeds the length cap', async () => {
		const res = await POST(createEvent({ text: 'a'.repeat(20001) }));
		expect(res.status).toBe(400);
		expect(mockCreateAndGenerate).not.toHaveBeenCalled();
	});

	it('returns 422 when generation fails', async () => {
		mockCreateAndGenerate.mockResolvedValueOnce({ success: false, message: 'boom' });
		const res = await POST(createEvent({ text: 'some questions' }));
		expect(res.status).toBe(422);
	});

	it('returns 502 when the AI response is not JSON', async () => {
		mockCreateAndGenerate.mockResolvedValueOnce({
			success: true,
			aiChat: { response: 'not json' }
		});
		const res = await POST(createEvent({ text: 'some questions' }));
		expect(res.status).toBe(502);
	});

	it('returns 502 when the AI response fails schema validation', async () => {
		mockCreateAndGenerate.mockResolvedValueOnce({
			success: true,
			aiChat: { response: JSON.stringify({ pairs: [{ question: 'Q', answer: 'A' }] }) } // missing confidence
		});
		const res = await POST(createEvent({ text: 'some questions' }));
		expect(res.status).toBe(502);
	});

	it('returns parsed pairs and drops fully-empty ones', async () => {
		mockCreateAndGenerate.mockResolvedValueOnce(
			aiResponse([
				{ question: 'Why us?', answer: 'Because...', confidence: 'high' },
				{ question: 'Only a question?', answer: '', confidence: 'high' },
				{ question: '', answer: '', confidence: 'low' } // fully empty → dropped
			])
		);
		const res = await POST(createEvent({ text: 'some questions' }));
		expect(res.status).toBe(200);
		const data = await res.json();
		expect(data.success).toBe(true);
		expect(data.pairs).toHaveLength(2);
		expect(data.pairs[1]).toMatchObject({ question: 'Only a question?', answer: '' });
	});

	it('does not ground on profile data (empty profileDataFields)', async () => {
		mockCreateAndGenerate.mockResolvedValueOnce(
			aiResponse([{ question: 'Q', answer: 'A', confidence: 'high' }])
		);
		await POST(createEvent({ text: 'some questions' }));
		const [, promptKey, vars, , options] = mockCreateAndGenerate.mock.calls[0];
		expect(promptKey).toBe('extract_qa_pairs');
		expect(vars).toMatchObject({ pastedText: 'some questions' });
		expect(options).toMatchObject({ profileDataFields: [] });
	});
});
