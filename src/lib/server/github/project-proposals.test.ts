import { describe, expect, it, vi } from 'vitest';

const h = vi.hoisted(() => ({ run: vi.fn() }));
vi.mock('$lib/server/ai-chat/job-utils', () => ({ runProfileAiChat: h.run }));

import { achievementFromAnswer, proposeFromCode } from './project-proposals';

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
		ok({ summary: 'New summary', technologies: [], questions: [] });
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
		ok({ summary: 's', technologies: [], questions: [] });
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
		ok({ summary: '', technologies: ['node.js', 'TYPESCRIPT', 'grammY', 'grammy'], questions: [] });
		const result = await proposeFromCode(1, files, context);
		expect(result?.technologies).toEqual(['grammY']);
	});

	it('keeps a question whose evidence the model omitted', async () => {
		ok({
			summary: '',
			technologies: [],
			questions: [{ question: 'Why the watchdog?' }, { question: '  ' }, { evidence: 'orphan' }]
		});
		const result = await proposeFromCode(1, files, context);
		expect(result?.questions).toEqual([{ question: 'Why the watchdog?', evidence: '' }]);
	});

	it('returns null when there is nothing to show or the call failed', async () => {
		ok({ summary: '', technologies: [], questions: [] });
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
