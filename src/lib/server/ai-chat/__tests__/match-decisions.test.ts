import { describe, expect, it } from 'vitest';
import { promptTemplates } from '../prompt-templates';
import {
	combineFactors,
	factorAnswers,
	factorVerdicts,
	MATCH_DESCRIPTION_CUT,
	MATCH_FACTOR_KEYS,
	MATCH_FACTORS,
	MATCH_PROFILE_LEAVES_OUT,
	MATCH_SCORE_MODEL,
	MATCH_SCORE_PROMPT,
	matchDecisionFingerprint,
	matchDecisionRequest,
	matchDecisionState,
	matchModelScore,
	type ScoreFactors
} from '../match-decisions';
import { skillDecisionFingerprint } from '../skill-decisions';
import type { SystemOneResponse } from '$lib/server/llm/typesafe';

const VALUES: Record<string, string> = {
	data: '{"title":"Senior engineer"}',
	supportingEvidence: '## Supporting evidence',
	'preferences.job_types': '["Full-time"]',
	'preferences.experience_levels': '["Senior"]',
	'preferences.work_location': '["Remote"]',
	'preferences.locations': 'Any',
	'job.title': 'Backend Engineer',
	'job.job_poster': 'Acme',
	'job.office_location': 'Amsterdam',
	'job.job_types': '["full_time"]',
	'job.experience_levels': '["senior"]',
	'job.work_location': '["remote"]',
	'job.skills_required': '["Python"]',
	'job.skills_preferred': '[]',
	'job.job_description': 'x'.repeat(MATCH_DESCRIPTION_CUT + 500),
	'job.company_description': 'Acme makes things.'
};

/** A response answering each factor at `levels[key]`. */
const answering = (levels: Record<string, number>): SystemOneResponse => ({
	model: MATCH_SCORE_MODEL,
	answers: Object.fromEntries(
		Object.entries(levels).map(([key, score]) => [key, { type: 'score', score }])
	),
	usage: { input_tokens: 100, output_tokens: 0 }
});

const best = Object.fromEntries(
	MATCH_FACTOR_KEYS.map((key) => [key, MATCH_FACTORS[key].question.criteria.length - 1])
);
const worst = Object.fromEntries(MATCH_FACTOR_KEYS.map((key) => [key, 0]));

describe('match decisions', () => {
	it("weighs the prompt's factors as the prompt does", () => {
		// The weights are the prompt's own. If its text moves them, these must
		// move with it, and the golden set must be run again.
		const guide = promptTemplates[MATCH_SCORE_PROMPT].system_prompt;
		const weightOf = (label: string) =>
			Number(new RegExp(`${label}[^(]*\\((\\d+)% weight\\)`).exec(guide)?.[1]) / 100;
		expect(MATCH_FACTORS.skills.weight).toBe(weightOf('Technical skills alignment'));
		expect(MATCH_FACTORS.experience.weight).toBe(weightOf('Experience level fit'));
		expect(MATCH_FACTORS.preferences.weight).toBe(weightOf('Work preferences match'));
		expect(MATCH_FACTORS.career.weight).toBe(weightOf('Career progression alignment'));
		expect(MATCH_FACTORS.domain.weight).toBe(weightOf('Domain/industry experience'));
		const total = MATCH_FACTOR_KEYS.reduce((sum, key) => sum + MATCH_FACTORS[key].weight, 0);
		expect(total).toBeCloseTo(1);
	});

	it("sends the prompt's inputs as the state, and one score question per factor", () => {
		const request = matchDecisionRequest(VALUES);
		expect(request.model).toBe('jev-1.13.0');
		expect(Object.keys(request.questions)).toEqual([
			'skills',
			'experience',
			'preferences',
			'career',
			'domain'
		]);
		expect(request.questions.skills).toEqual(MATCH_FACTORS.skills.question);

		const state = matchDecisionState(VALUES);
		expect(state.scoring_guide).toBe(promptTemplates[MATCH_SCORE_PROMPT].system_prompt);
		expect(state.candidate_profile).toBe(VALUES.data);
		expect(state.supporting_evidence).toBe('## Supporting evidence');
		expect(state.candidate_preferences.work_location).toBe('["Remote"]');
		// The prompt calls the poster the company.
		expect(state.job.company).toBe('Acme');
		expect(state.job.description).toHaveLength(MATCH_DESCRIPTION_CUT + 500);
	});

	it('cuts only the posting when asked to', () => {
		const cut = matchDecisionState(VALUES, true);
		expect(cut.job.description).toHaveLength(MATCH_DESCRIPTION_CUT);
		expect(cut.candidate_profile).toBe(VALUES.data);
		expect(cut.job.company_description).toBe('Acme makes things.');
	});

	it('leaves the cheat sheets out of the profile', () => {
		expect(MATCH_PROFILE_LEAVES_OUT).toEqual(['cheat_sheets']);
	});

	it("combines the factors and maps them onto the prompt's scale", () => {
		expect(combineFactors(factorAnswers(answering(best)))).toBeCloseTo(100);
		expect(combineFactors(factorAnswers(answering(worst)))).toBeCloseTo(0);
		// Skills alone at the top: its weight.
		expect(combineFactors(factorAnswers(answering({ ...worst, skills: 4 })))).toBeCloseTo(35);

		// The line runs past both ends; the score the blend takes does not.
		expect(matchModelScore(0)).toBe(0);
		expect(matchModelScore(100)).toBe(100);
		expect(matchModelScore(50)).toBe(61);
		expect(Number.isInteger(matchModelScore(43.21))).toBe(true);
	});

	it('refuses a response that left a factor unanswered', () => {
		const { domain: _domain, ...rest } = best;
		expect(() => factorAnswers(answering(rest))).toThrow('domain');
	});

	it('says each factor in words, by its nearest level', () => {
		const stored: ScoreFactors = {
			model: MATCH_SCORE_MODEL,
			combined: 60,
			factors: factorAnswers(answering({ ...best, skills: 2.6, career: 0.4 }))
		};
		const verdicts = factorVerdicts(stored);
		expect(verdicts).toHaveLength(5);
		expect(verdicts[0]).toEqual({
			name: 'Technical skills',
			verdict: "Most of the job's skills, including the core ones"
		});
		expect(verdicts[3].verdict).toBe('A step back, or into work the candidate has moved away from');

		// A factor stored under a question with another number of levels would
		// point at the wrong words, so it is left out.
		stored.factors.domain = { level: 1, levels: 5 };
		expect(factorVerdicts(stored).map((v) => v.name)).not.toContain('Domain');
	});

	it('names each version of a decision with 16 hex characters', () => {
		expect(matchDecisionFingerprint()).toMatch(/^[0-9a-f]{16}$/);
		expect(matchDecisionFingerprint()).toBe(matchDecisionFingerprint());
		expect(skillDecisionFingerprint()).toMatch(/^[0-9a-f]{16}$/);
		expect(skillDecisionFingerprint()).not.toBe(matchDecisionFingerprint());
	});
});
