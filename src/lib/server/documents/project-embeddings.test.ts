import { describe, expect, it } from 'vitest';
import { buildJobQueryText, projectKey } from './project-embeddings';

describe('projectKey', () => {
	it('namespaces by kind so ids from the two tables never collide', () => {
		expect(projectKey('side_project', 5)).toBe('side_project:5');
		expect(projectKey('work_experience_project', 5)).toBe('work_experience_project:5');
		expect(projectKey('side_project', 5)).not.toBe(projectKey('work_experience_project', 5));
	});
});

describe('buildJobQueryText', () => {
	it('joins title, description, and skills into one query string', () => {
		const out = buildJobQueryText({
			title: 'Backend Engineer',
			job_description: 'Build distributed systems.',
			skills_required: ['PostgreSQL', 'Redis']
		});
		expect(out).toBe('Backend Engineer\nBuild distributed systems.\nPostgreSQL, Redis');
	});

	it('omits missing/blank parts without leaving stray separators', () => {
		expect(
			buildJobQueryText({
				title: '  ',
				job_description: 'Only a description.',
				skills_required: null
			})
		).toBe('Only a description.');
	});

	it('returns empty string when the job carries no text', () => {
		expect(
			buildJobQueryText({
				title: null,
				job_description: null,
				skills_required: []
			})
		).toBe('');
	});
});
