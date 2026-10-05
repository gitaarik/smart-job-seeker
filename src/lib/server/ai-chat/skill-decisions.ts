/**
 * The matcher's skill pass as decisions instead of a prompt: which of a job's
 * leftover skills the profile shows, asked of TypeSafe's Jev as one yes/no
 * question per skill (llm/typesafe.ts). The call that sends it and records it
 * is decideMatchedSkills in job-utils.ts; this is the part that is pure.
 *
 * The input is the same as `extract_matched_skills`: that prompt's own rules,
 * and the profile without NON_SKILL_FIELDS. Each skill comes back as a
 * probability and counts as matched above SKILL_MATCH_CUTOFF.
 *
 * Measured on the skills golden set on 2026-10-05 (cloud
 * scripts/golden/skills/jev.ts, 50 jobs x 3 repeats): F0.5 85.7%, precision
 * 88.2%, recall 77.0%, against 80.0 / 81.6 / 74.0 for the prompt on
 * gpt-oss-120b, at half the cost. It also gave every skill the same verdict in
 * every job that asked for it (the prompt changed its mind between jobs on 10
 * of 57), because each question is judged on its own rather than as part of a
 * list.
 */
import { promptTemplates } from './prompt-templates.js';
import type { NoulQuestion, SystemOneRequest, SystemOneResponse } from '$lib/server/llm/typesafe';

export const SKILL_MATCH_PROMPT = 'extract_matched_skills';

/**
 * Pinned, never `jev-latest`: SKILL_MATCH_CUTOFF was learned against this
 * version's probabilities, and an alias that moved would change what it means
 * without anything failing.
 */
export const SKILL_MATCH_MODEL = 'jev-1.13.0';

/**
 * Where a probability becomes a match. Not 0.5: Jev's probabilities lean
 * towards no on this question. Skills it put at 0.2-0.3 were labelled `has`
 * 69% of the time, and 0.4-0.5 86%, so 0.5 matched barely half of what the
 * profile shows (recall 48%). Picked on four fifths of the golden set's jobs
 * and scored on the fifth, every fold chose 0.25, and anywhere from 0.2 to 0.3
 * beat the prompt's F0.5. Learn it again from the golden set whenever the
 * model or the rules change.
 */
export const SKILL_MATCH_CUTOFF = 0.25;

/**
 * The prompt's rules without its instructions for the reply's format, which
 * mean nothing to a model that answers each skill with a probability. Cut at
 * "Return ONLY"; a test fails if that line moves.
 */
export const SKILL_MATCH_RULES = promptTemplates[SKILL_MATCH_PROMPT].system_prompt
	.split('\nReturn ONLY')[0]
	.trim();

/**
 * The request for one job: the rules and the rendered profile as the state, and
 * one question per skill, keyed by its position in `skills`.
 */
export function skillDecisionRequest(profile: string, skills: readonly string[]): SystemOneRequest {
	return {
		model: SKILL_MATCH_MODEL,
		state: { matching_rules: SKILL_MATCH_RULES, candidate_profile: profile },
		questions: Object.fromEntries(
			skills.map((skill, i): [string, NoulQuestion] => [
				`s${i}`,
				{
					type: 'noul',
					instructions:
						`Does the candidate demonstrably possess the job skill "${skill}"? ` +
						'Judge it by the matching rules.'
				}
			])
		)
	};
}

/** Each skill's probability of yes, in the order asked. Throws on a missing answer. */
export function skillProbabilities(
	response: SystemOneResponse,
	skills: readonly string[]
): number[] {
	return skills.map((skill, i) => {
		const p = response.answers[`s${i}`]?.noul;
		if (typeof p !== 'number') throw new Error(`Jev returned no answer for "${skill}"`);
		return p;
	});
}

/** The skills whose probability clears the cutoff, in the order asked. */
export function matchedByProbability(
	skills: readonly string[],
	probabilities: readonly number[],
	cutoff = SKILL_MATCH_CUTOFF
): string[] {
	return skills.filter((_, i) => probabilities[i] > cutoff);
}
