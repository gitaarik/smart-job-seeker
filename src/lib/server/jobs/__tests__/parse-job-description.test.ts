/**
 * Tests for the parser's two seams: what the model is given, and what is made
 * of its answer.
 *
 * The first is the one that failed silently for months. A paste was stripped
 * as though it were HTML, which fused its lines, and nothing downstream could
 * tell — the model simply answered null (or a fused title) and the form showed
 * empty boxes. So the assertions here are about the text that reaches the
 * prompt, not only about the shape of the result.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';

const mockRunProfileAiChat = vi.hoisted(() => vi.fn());
vi.mock('$lib/server/ai-chat/job-utils', () => ({
	runProfileAiChat: mockRunProfileAiChat
}));

const { parseJobDescription } = await import('../parse-job-description');

/** The `html` variable the prompt was interpolated with on the last call. */
function promptText(): string {
	const call = mockRunProfileAiChat.mock.calls.at(-1);
	return (call?.[2] as { html: string }).html;
}

function respond(response: Record<string, unknown> | null, success = true) {
	mockRunProfileAiChat.mockResolvedValue({
		success,
		message: success ? 'ok' : 'provider down',
		response,
		aiChatId: 42
	});
}

const PASTE = `Senior FS for supplier intelligence products
Full-stack Web Developer | Senior

Standplaats: Mannheim`;

beforeEach(() => {
	mockRunProfileAiChat.mockReset();
});

describe('parseJobDescription — what the model is given', () => {
	it('hands a paste over with its lines intact', async () => {
		respond({ title: 'Senior FS for supplier intelligence products' });
		await parseJobDescription(PASTE, { profileId: 1 });

		expect(mockRunProfileAiChat).toHaveBeenCalledWith(1, 'extract_job_data', {
			html: PASTE,
			searchContextHint: ''
		});
		expect(promptText()).not.toContain('<body>');
	});

	it('strips a captured page, including its newlines', async () => {
		respond({ title: 'Engineer' });
		await parseJobDescription(
			'<html><body>\n<script>track()</script>\n<h1>Engineer</h1>\n<p>Remote</p>\n</body></html>',
			{ profileId: 1 }
		);

		const text = promptText();
		expect(text).toContain('<h1>Engineer</h1>');
		expect(text).not.toContain('track()');
		expect(text).not.toContain('\n');
	});

	it('stores the prepared text as the parse input for a later re-parse', async () => {
		respond({});
		const parsed = await parseJobDescription('Title  \r\n\r\n\r\nCompany', { profileId: 1 });
		expect(parsed?.source_html_stripped).toBe('Title\n\nCompany');
	});

	it('passes the search-context hint through when the scraper supplies one', async () => {
		respond({});
		await parseJobDescription('<div><h1>A</h1><p>B</p><p>C</p></div>', {
			profileId: 1,
			searchContext: { title: 'Engineer', company: 'Acme' }
		});
		expect(mockRunProfileAiChat.mock.calls[0][2]).toMatchObject({
			searchContextHint: expect.stringContaining('title: "Engineer", company: "Acme"')
		});
	});
});

describe('parseJobDescription — what is made of the answer', () => {
	it('cleans the header fields', async () => {
		respond({
			title: 'Functietitel: Senior Python Developer at TSC',
			company: 'TSC',
			job_poster: 'TSC',
			location: 'Work City: Amsterdam'
		});
		const parsed = await parseJobDescription(PASTE, { profileId: 1 });
		expect(parsed).toMatchObject({
			title: 'Senior Python Developer',
			company: 'TSC',
			job_poster: null,
			location: 'Amsterdam'
		});
	});

	it('nulls a section heading the model returned as the title', async () => {
		respond({ title: 'Opdrachtomschrijving', company: 'Belastingdienst' });
		const parsed = await parseJobDescription('Opdrachtomschrijving\n\nWerk.', { profileId: 1 });
		expect(parsed).toMatchObject({ title: null, company: 'Belastingdienst' });
	});

	it('leaves the other fields as the model gave them', async () => {
		respond({
			title: 'Engineer',
			skills_required: ['Python'],
			salary_min: 50000,
			remote: 'hybrid',
			source_url: 'https://jobs.example/1'
		});
		const parsed = await parseJobDescription(PASTE, { profileId: 1 });
		expect(parsed).toMatchObject({
			skills_required: ['Python'],
			salary_min: 50000,
			remote: 'hybrid',
			source_url: 'https://jobs.example/1',
			ai_chat_extraction: 42
		});
	});

	it('returns null when extraction fails', async () => {
		respond(null, false);
		expect(await parseJobDescription(PASTE, { profileId: 1 })).toBeNull();
	});
});

describe('parseJobDescription — the header pass', () => {
	const BZB = `Opdrachtomschrijving

Het programma BZB werkt aan opdrachten toegekend door het bestuursteam van de Belastingdienst.`;

	/** Main pass answers `main`; the header pass answers `header`. */
	function respondByPrompt(main: Record<string, unknown>, header: Record<string, unknown>) {
		mockRunProfileAiChat.mockImplementation(async (_profileId: number, key: string) => ({
			success: true,
			message: 'ok',
			response: key === 'extract_job_header' ? header : main,
			aiChatId: key === 'extract_job_header' ? 43 : 42
		}));
	}

	const keys = () => mockRunProfileAiChat.mock.calls.map((c) => c[1]);

	it('fills only the fields the first pass left empty, from grounded quotes', async () => {
		respondByPrompt(
			{ title: 'AI Engineer', company: null, location: null },
			{
				title: { value: 'Automation Developer', quote: 'Het programma BZB werkt aan opdrachten' },
				company: {
					value: 'Belastingdienst',
					quote: 'toegekend door het bestuursteam van de Belastingdienst'
				},
				location: { value: 'Apeldoorn', quote: 'Standplaats: Apeldoorn' }
			}
		);
		const parsed = await parseJobDescription(BZB, { profileId: 1, recoverHeader: true });

		expect(keys()).toEqual(['extract_job_data', 'extract_job_header']);
		expect(mockRunProfileAiChat.mock.calls[1][2]).toEqual({ posting: BZB });
		expect(parsed).toMatchObject({
			// What the first pass found stands, even against a grounded alternative.
			title: 'AI Engineer',
			company: 'Belastingdienst',
			// A quote the posting does not contain grounds nothing.
			location: null,
			// The job row keeps the main pass as its extraction record.
			ai_chat_extraction: 42
		});
	});

	it('does not run when the first pass filled the header', async () => {
		respondByPrompt(
			{
				title: 'AI Engineer',
				company: 'Belastingdienst',
				job_poster: 'Citrus-IT',
				location: 'Apeldoorn'
			},
			{}
		);
		await parseJobDescription(BZB, { profileId: 1, recoverHeader: true });
		expect(keys()).toEqual(['extract_job_data']);
	});

	it('does not run unless asked for', async () => {
		respondByPrompt({ title: null, company: null }, {});
		await parseJobDescription(BZB, { profileId: 1 });
		expect(keys()).toEqual(['extract_job_data']);
	});

	it('sanitizes what the header pass adds', async () => {
		respondByPrompt(
			{ title: null, company: 'Belastingdienst' },
			{
				title: { value: 'Opdrachtomschrijving', quote: 'Opdrachtomschrijving' },
				job_poster: { value: 'Belastingdienst', quote: 'bestuursteam van de Belastingdienst' }
			}
		);
		const parsed = await parseJobDescription(BZB, { profileId: 1, recoverHeader: true });
		// A heading is still not a title, and the company is still not its own recruiter.
		expect(parsed).toMatchObject({ title: null, company: 'Belastingdienst', job_poster: null });
	});

	const LONG_BZB = `${BZB}\n\n${'Ervaring met programmeren, AI en automatiseringstechnologieën. '.repeat(6)}`;

	it('offers a suggested title only when no title could be found', async () => {
		respondByPrompt(
			{ title: null, company: 'Belastingdienst' },
			{ title: null, suggested_title: 'Developer AI & procesautomatisering (BZB)' }
		);
		const parsed = await parseJobDescription(LONG_BZB, { profileId: 1, recoverHeader: true });
		// The extraction stays honest: title null, the suggestion beside it.
		expect(parsed).toMatchObject({
			title: null,
			suggested_title: 'Developer AI & procesautomatisering (BZB)'
		});
	});

	it('drops the suggestion once a grounded title exists', async () => {
		respondByPrompt(
			{ title: null },
			{
				title: { value: 'BZB', quote: 'Het programma BZB werkt aan opdrachten' },
				suggested_title: 'Developer BZB'
			}
		);
		const parsed = await parseJobDescription(LONG_BZB, { profileId: 1, recoverHeader: true });
		expect(parsed).toMatchObject({ title: 'BZB', suggested_title: null });
	});

	it('never suggests without the header pass', async () => {
		respondByPrompt({ title: null }, { suggested_title: 'Developer BZB' });
		const parsed = await parseJobDescription(LONG_BZB, { profileId: 1 });
		expect(parsed).toMatchObject({ title: null, suggested_title: null });
	});

	it('keeps the first pass when the header pass fails', async () => {
		mockRunProfileAiChat.mockImplementation(async (_profileId: number, key: string) =>
			key === 'extract_job_header'
				? { success: false, message: 'provider down', response: null, aiChatId: null }
				: { success: true, message: 'ok', response: { title: 'AI Engineer' }, aiChatId: 42 }
		);
		const parsed = await parseJobDescription(BZB, { profileId: 1, recoverHeader: true });
		expect(parsed).toMatchObject({ title: 'AI Engineer', company: null });
	});
});
