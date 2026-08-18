import { describe, expect, it, vi } from 'vitest';

const h = vi.hoisted(() => ({ run: vi.fn() }));
vi.mock('$lib/server/ai-chat/job-utils', () => ({ runProfileAiChat: h.run }));

import { achievementFromAnswer, proposeFromCode, toFirstPerson } from './project-proposals';

const files = [{ path: 'README.md', text: 'A bot that does things.' }];
const context = {
	name: 'TeleCoder',
	summary: 'Existing summary',
	technologies: ['TypeScript', 'Node.js'],
	achievements: ['Shipped it']
};

const ok = (response: unknown) => h.run.mockResolvedValue({ success: true, response });

describe('proposeFromCode', () => {
	it('passes the project context into the prompt so it proposes deltas', async () => {
		ok({ description: 'New description', technologies: [], questions: [] });
		await proposeFromCode(1, files, context);
		const [profileId, key, vars] = h.run.mock.calls.at(-1)!;
		expect(profileId).toBe(1);
		expect(key).toBe('propose_project_from_code');
		expect(vars.projectName).toBe('TeleCoder');
		expect(vars.existingTechnologies).toBe('TypeScript, Node.js');
		expect(vars.existingAchievements).toBe('- Shipped it');
		expect(vars.document).toContain('A bot that does things.');
	});

	it('says "(none yet)" rather than sending blanks the model must interpret', async () => {
		ok({ description: 'd', technologies: [], questions: [] });
		await proposeFromCode(1, files, { name: '', summary: '', technologies: [], achievements: [] });
		const vars = h.run.mock.calls.at(-1)![2];
		expect(vars.projectName).toBe('Untitled project');
		expect(vars.existingSummary).toBe('(none yet)');
		expect(vars.existingTechnologies).toBe('(none yet)');
		expect(vars.existingAchievements).toBe('(none yet)');
	});

	it('drops technologies the project already lists, however they are written', async () => {
		// The prompt is asked to skip these; this is the guarantee, by the matching
		// pipeline's rule — so "node.js" cannot slip past an existing "Node.js".
		ok({
			description: '',
			technologies: ['node.js', 'TYPESCRIPT', 'grammY', 'grammy'],
			questions: []
		});
		const result = await proposeFromCode(1, files, context);
		expect(result?.technologies).toEqual(['grammY']);
	});

	it('keeps a question whose evidence the model omitted', async () => {
		ok({
			description: '',
			technologies: [],
			questions: [{ question: 'Why the watchdog?' }, { question: '  ' }, { evidence: 'orphan' }]
		});
		const result = await proposeFromCode(1, files, context);
		expect(result?.questions).toEqual([{ question: 'Why the watchdog?', evidence: '' }]);
	});

	it('keeps an outcome the files asserted, and tolerates its absence', async () => {
		// The one impact claim this prompt may make: a result stated in the
		// supplied documents (an acceptance email, a changelog) rather than
		// inferred from code. Absent is the normal case, not a failure.
		ok({ description: 'd', outcome: 'Passed the test and was placed on the bench', questions: [] });
		expect((await proposeFromCode(1, files, context))?.outcome).toBe(
			'Passed the test and was placed on the bench'
		);
		ok({ description: 'd', technologies: [], questions: [] });
		expect((await proposeFromCode(1, files, context))?.outcome).toBe('');
	});

	it('returns null when there is nothing to show or the call failed', async () => {
		ok({ description: '', outcome: '', technologies: [], questions: [] });
		expect(await proposeFromCode(1, files, context)).toBeNull();

		h.run.mockResolvedValue({ success: false });
		expect(await proposeFromCode(1, files, context)).toBeNull();

		// No files means no document; the model is never called.
		h.run.mockClear();
		expect(await proposeFromCode(1, [], context)).toBeNull();
		expect(h.run).not.toHaveBeenCalled();
	});
});

describe('achievementFromAnswer', () => {
	const input = {
		projectName: 'Acme CLI',
		question: 'What problem did the retry queue solve?',
		evidence: 'src/queue.ts uses p-queue',
		answer: 'Jobs kept failing and someone reran them by hand.'
	};

	it('never calls the model without an answer to build from', async () => {
		h.run.mockClear();
		expect(await achievementFromAnswer(1, { ...input, answer: '   ' })).toBeNull();
		expect(h.run).not.toHaveBeenCalled();
	});

	it('sends the question, its evidence and the answer', async () => {
		ok({ achievement: 'Built a retry queue', usedFromAnswer: 'reran them by hand' });
		const result = await achievementFromAnswer(1, input);
		const [, key, vars] = h.run.mock.calls.at(-1)!;
		expect(key).toBe('write_achievement_from_answer');
		expect(vars.question).toBe(input.question);
		expect(vars.evidence).toBe('src/queue.ts uses p-queue');
		expect(vars.answer).toBe(input.answer);
		expect(result).toEqual({
			achievement: 'Built a retry queue',
			usedFromAnswer: 'reran them by hand'
		});
	});

	it('keeps a draft whose answer supported no outcome', async () => {
		// usedFromAnswer == "" is the model reporting it found nothing to claim.
		// That is a correct, useful bullet — dropping it would push the user back
		// to inventing one themselves.
		ok({ achievement: 'Built a retry queue with exponential backoff' });
		const result = await achievementFromAnswer(1, input);
		expect(result).toEqual({
			achievement: 'Built a retry queue with exponential backoff',
			usedFromAnswer: ''
		});
	});

	it('substitutes a placeholder rather than sending an empty evidence slot', async () => {
		ok({ achievement: 'Did the thing', usedFromAnswer: '' });
		await achievementFromAnswer(1, { ...input, evidence: '', projectName: '' });
		const vars = h.run.mock.calls.at(-1)![2];
		expect(vars.evidence).toBe('(none recorded)');
		expect(vars.projectName).toBe('Untitled project');
	});

	it('returns null when the model gives back no line', async () => {
		ok({ achievement: '   ', usedFromAnswer: 'x' });
		expect(await achievementFromAnswer(1, input)).toBeNull();
		h.run.mockResolvedValue({ success: false });
		expect(await achievementFromAnswer(1, input)).toBeNull();
	});
});

describe('toFirstPerson', () => {
	// gpt-oss writes "the applicant" despite being told twice not to, so this is
	// the guarantee rather than the request.
	it('rewrites a third-person subject at the start', () => {
		expect(toFirstPerson('The applicant passed the test.')).toBe('I passed the test.');
		expect(toFirstPerson('the candidate built a parser')).toBe('I built a parser');
		expect(toFirstPerson('Applicant led the migration')).toBe('I led the migration');
	});

	it('rewrites it after a sentence break too', () => {
		expect(toFirstPerson('It shipped. The applicant then wrote docs.')).toBe(
			'It shipped. I then wrote docs.'
		);
	});

	it('handles the possessive, including a curly apostrophe', () => {
		expect(toFirstPerson("The applicant's tests caught it")).toBe('My tests caught it');
		expect(toFirstPerson('The author’s notes explain why')).toBe('My notes explain why');
	});

	it('leaves mid-sentence occurrences alone rather than mangling grammar', () => {
		// Turning this into "me"/"my" correctly needs grammar we cannot see, and a
		// broken sentence is worse than a phrase the user can edit.
		const mid = 'The tests were written by the applicant during review';
		expect(toFirstPerson(mid)).toBe(mid);
	});

	it('does not touch text that was already first person', () => {
		const good = 'I rebuilt the deploy system. It cut releases from 40 minutes to 10.';
		expect(toFirstPerson(good)).toBe(good);
	});
});
