/**
 * The recommendation word is read off the score, on the edges of the bands the
 * matcher's prompt scores by. The last test is the one that keeps the two
 * together: if the prompt's bands move, the words have to move with them.
 */
import { describe, expect, it } from 'vitest';
import {
	RECOMMENDATION_FLOORS,
	recommendationOf,
	recommendationWord
} from '../match-recommendation';
import { promptTemplates } from '../server/ai-chat/prompt-templates';

describe('recommendationWord', () => {
	it('gives each score the word of the highest floor it reaches', () => {
		const words = [0, 39, 40, 59, 60, 74, 75, 100].map(recommendationWord);
		expect(words).toEqual([
			'not_recommended',
			'not_recommended',
			'consider',
			'consider',
			'recommend',
			'recommend',
			'highly_recommend',
			'highly_recommend'
		]);
	});
});

describe('recommendationOf', () => {
	it('shows why a skipped match has no score rather than the word for 0', () => {
		expect(recommendationOf({ score: 0, skip_reason: 'ineligible' })).toBe('ineligible');
		expect(recommendationOf({ score: 0, skip_reason: 'filtered_out' })).toBe('filtered_out');
		expect(recommendationOf({ score: 0, skip_reason: null })).toBe('not_recommended');
		expect(recommendationOf({ score: 81, skip_reason: null })).toBe('highly_recommend');
	});
});

describe("the words and score_job_match's scoring guide", () => {
	it('puts every floor on the edge of one of the bands the model scores by', () => {
		const guide = promptTemplates.score_job_match.system_prompt;
		const bandStarts = [...guide.matchAll(/^- (\d+)-(\d+): /gm)].map((m) => Number(m[1]));
		expect(bandStarts).toEqual([90, 75, 60, 40, 20, 0]);
		for (const floor of Object.values(RECOMMENDATION_FLOORS)) {
			expect(bandStarts).toContain(floor);
		}
	});
});
