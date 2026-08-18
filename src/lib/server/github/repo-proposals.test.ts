import { describe, expect, it, vi } from 'vitest';

const h = vi.hoisted(() => ({ run: vi.fn() }));
vi.mock('$lib/server/ai-chat/job-utils', () => ({ runProfileAiChat: h.run }));

import { proposeFromRepo } from './repo-proposals';

const files = [{ path: 'README.md', text: 'A bot that does things.' }];
const context = {
	name: 'TeleCoder',
	summary: 'Existing summary',
	technologies: ['TypeScript', 'Node.js'],
	achievements: ['Shipped it']
};

const ok = (response: unknown) => h.run.mockResolvedValue({ success: true, response });

describe('proposeFromRepo', () => {
	it('passes the project context into the prompt so it proposes deltas', async () => {
		ok({ summary: 'New summary', technologies: [], questions: [] });
		await proposeFromRepo(1, files, context);
		const [profileId, key, vars] = h.run.mock.calls.at(-1)!;
		expect(profileId).toBe(1);
		expect(key).toBe('propose_project_from_repo');
		expect(vars.projectName).toBe('TeleCoder');
		expect(vars.existingTechnologies).toBe('TypeScript, Node.js');
		expect(vars.existingAchievements).toBe('- Shipped it');
		expect(vars.document).toContain('A bot that does things.');
	});

	it('says "(none yet)" rather than sending blanks the model must interpret', async () => {
		ok({ summary: 's', technologies: [], questions: [] });
		await proposeFromRepo(1, files, { name: '', summary: '', technologies: [], achievements: [] });
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
		const result = await proposeFromRepo(1, files, context);
		expect(result?.technologies).toEqual(['grammY']);
	});

	it('keeps a question whose evidence the model omitted', async () => {
		ok({
			summary: '',
			technologies: [],
			questions: [{ question: 'Why the watchdog?' }, { question: '  ' }, { evidence: 'orphan' }]
		});
		const result = await proposeFromRepo(1, files, context);
		expect(result?.questions).toEqual([{ question: 'Why the watchdog?', evidence: '' }]);
	});

	it('returns null when there is nothing to show or the call failed', async () => {
		ok({ summary: '', technologies: [], questions: [] });
		expect(await proposeFromRepo(1, files, context)).toBeNull();

		h.run.mockResolvedValue({ success: false });
		expect(await proposeFromRepo(1, files, context)).toBeNull();

		// No files means no document; the model is never called.
		h.run.mockClear();
		expect(await proposeFromRepo(1, [], context)).toBeNull();
		expect(h.run).not.toHaveBeenCalled();
	});
});
