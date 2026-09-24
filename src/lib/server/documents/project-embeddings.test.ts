import { describe, expect, it } from 'vitest';
import { buildJobQueryText, maxPoolProjectScores, projectKey, unitKey } from './project-embeddings';

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

describe('maxPoolProjectScores', () => {
	const unit = (projectId: number, attachmentId: number) => ({
		projectKind: 'side_project' as const,
		projectId,
		attachmentId
	});

	it('scores a project by its best unit, so one strong upload carries it', () => {
		const units = [unit(1, 0), unit(1, 9), unit(2, 0)];
		const vectors = new Map([
			[unitKey(units[0]), [0, 1]],
			[unitKey(units[1]), [1, 0]],
			[unitKey(units[2]), [1, 1]]
		]);
		const scores = maxPoolProjectScores([1, 0], units, vectors, 2);
		expect(scores.get('side_project:1')).toBeCloseTo(1, 12);
		expect(scores.get('side_project:2')).toBeCloseTo(Math.SQRT1_2, 12);
	});

	it('compares only the working dimensions', () => {
		// Identical in the first two numbers, opposite after: at 2 dims they match.
		const units = [unit(1, 0)];
		const vectors = new Map([[unitKey(units[0]), [1, 0, -5, -5]]]);
		expect(maxPoolProjectScores([1, 0, 5, 5], units, vectors, 2).get('side_project:1')).toBeCloseTo(
			1,
			12
		);
	});

	it('leaves out a project none of whose units has a vector', () => {
		const units = [unit(1, 0), unit(2, 0)];
		const vectors = new Map([[unitKey(units[0]), [1, 0]]]);
		const scores = maxPoolProjectScores([1, 0], units, vectors, 2);
		expect([...scores.keys()]).toEqual(['side_project:1']);
	});
});
