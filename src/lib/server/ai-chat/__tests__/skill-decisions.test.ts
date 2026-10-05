import { describe, expect, it } from 'vitest';
import { promptTemplates } from '../prompt-templates';
import {
	matchedByProbability,
	SKILL_MATCH_CUTOFF,
	SKILL_MATCH_MODEL,
	SKILL_MATCH_PROMPT,
	SKILL_MATCH_RULES,
	skillDecisionRequest,
	skillProbabilities
} from '../skill-decisions';
import type { SystemOneResponse } from '$lib/server/llm/typesafe';

const answers = (values: Record<string, number>): SystemOneResponse => ({
	model: SKILL_MATCH_MODEL,
	answers: Object.fromEntries(
		Object.entries(values).map(([id, noul]) => [id, { type: 'noul', noul }])
	),
	usage: { input_tokens: 100, output_tokens: 10 }
});

describe('skill decisions', () => {
	it("sends the prompt's rules, without its reply format", () => {
		// The cut is at "Return ONLY". If an edit moves that line, the rules either
		// lose their tail or carry the format instructions, and both change what
		// was measured on the golden set.
		const prompt = promptTemplates[SKILL_MATCH_PROMPT].system_prompt;
		expect(prompt).toContain('\nReturn ONLY');
		expect(SKILL_MATCH_RULES).toContain('a false positive is worse than a false negative');
		expect(SKILL_MATCH_RULES).not.toMatch(/Return ONLY|JSON/);
		expect(prompt.startsWith(SKILL_MATCH_RULES)).toBe(true);
	});

	it('asks one yes/no question per skill, on the pinned model', () => {
		const request = skillDecisionRequest('{"skills":["PostgreSQL"]}', [
			'SQL databases',
			'Kubernetes'
		]);
		expect(request.model).toBe('jev-1.13.0');
		expect(request.state).toEqual({
			matching_rules: SKILL_MATCH_RULES,
			candidate_profile: '{"skills":["PostgreSQL"]}'
		});
		expect(Object.keys(request.questions)).toEqual(['s0', 's1']);
		expect(request.questions.s1).toEqual({
			type: 'noul',
			instructions:
				'Does the candidate demonstrably possess the job skill "Kubernetes"? ' +
				'Judge it by the matching rules.'
		});
	});

	it('matches above the cutoff, in the order asked', () => {
		const skills = ['SQL databases', 'Kubernetes', 'CI/CD'];
		const probabilities = skillProbabilities(answers({ s0: 0.93, s1: 0.05, s2: 0.26 }), skills);
		expect(probabilities).toEqual([0.93, 0.05, 0.26]);
		expect(SKILL_MATCH_CUTOFF).toBe(0.25);
		expect(matchedByProbability(skills, probabilities)).toEqual(['SQL databases', 'CI/CD']);
		// Exactly at the cutoff is not above it.
		expect(matchedByProbability(['x'], [0.25])).toEqual([]);
	});

	it('refuses a response that left a skill unanswered', () => {
		expect(() => skillProbabilities(answers({ s0: 0.9 }), ['SQL databases', 'Kubernetes'])).toThrow(
			'Kubernetes'
		);
	});
});
