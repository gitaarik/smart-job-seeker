import { describe, expect, it } from 'vitest';
import { applicationQuestionQuery, chatQuery, letterQuery } from '../relevance-queries';

const job = {
	title: 'Frontend Engineer',
	job_description: 'Build the design system in Svelte.',
	skills_required: ['Svelte', 'TypeScript']
};

describe('letterQuery', () => {
	it('ranks a letter against the whole job', () => {
		expect(letterQuery(job)).toEqual({
			text: 'Frontend Engineer\nBuild the design system in Svelte.',
			skills: ['Svelte', 'TypeScript']
		});
	});

	it('leaves out what the job does not have', () => {
		expect(letterQuery({ title: 'Frontend Engineer', job_description: null })).toEqual({
			text: 'Frontend Engineer',
			skills: undefined
		});
	});
});

describe('applicationQuestionQuery', () => {
	it('leads with the question and leaves the job description out', () => {
		const q = applicationQuestionQuery('Why this team?', job);
		expect(q).toEqual({
			text: 'Why this team?\nFrontend Engineer',
			skills: ['Svelte', 'TypeScript']
		});
		expect(q.text).not.toContain('design system');
	});

	it('is the question alone for an application without a job', () => {
		expect(applicationQuestionQuery('Why this team?', null)).toEqual({
			text: 'Why this team?',
			skills: undefined
		});
	});
});

describe('chatQuery', () => {
	it("adds the page's job title and skills to the message", () => {
		expect(chatQuery('What should I lead with?', job)).toEqual({
			text: 'What should I lead with?\nFrontend Engineer',
			skills: ['Svelte', 'TypeScript']
		});
	});

	it('is the message alone off a job page', () => {
		expect(chatQuery('What do you think I charge?', null)).toEqual({
			text: 'What do you think I charge?',
			skills: undefined
		});
	});
});
