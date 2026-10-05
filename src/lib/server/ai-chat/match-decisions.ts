/**
 * The matcher's score as decisions instead of a prompt: how well a job fits a
 * profile, asked of TypeSafe's Jev (llm/typesafe.ts) as one score question per
 * factor the `score_job_match` prompt weighs, and combined in code with that
 * prompt's weights. The call that sends it and records it is decideMatchScore
 * in job-utils.ts; this is the part that is pure.
 *
 * The state is what the prompt is given: its system prompt as the scoring
 * guide, the profile without NON_FIT_FIELDS (and without the cheat sheets, see
 * MATCH_PROFILE_LEAVES_OUT), the job preferences, the supporting evidence and
 * the posting. Jev writes no text, so a match it scored has no summary,
 * strengths or gaps until someone opens the job and `explain_job_match` writes
 * them (match-explanation.ts).
 *
 * Measured on the matcher golden set on 2026-10-05 (cloud
 * scripts/golden/matcher/jev.ts, 80 jobs x 3 repeats), blended with the skill
 * match as the prompt's score is: concordance with the labels 97.9%, against
 * 95.8% for the prompt on gpt-oss-120b, and 97.8 to 97.9% from a single call
 * (what production makes) against 95.0 to 95.9%. A bootstrap over the jobs put
 * the difference at -0.7 to +4.6 points: at least as good, not proven better.
 * A job's score moved by 0.8 points between repeats on average, against 5.7,
 * and its recommendation word changed on 4 of the 80 jobs, against 20. Dutch
 * postings ranked as well as English ones. A call took 0.36 s at the median
 * and cost a third of the prompt's: $0.19 for the 240, against $0.65.
 */
import { createHash } from 'node:crypto';
import { promptTemplates } from './prompt-templates.js';
import type { ScoreQuestion, SystemOneRequest, SystemOneResponse } from '$lib/server/llm/typesafe';
import type { ExportedProfileKey } from '$lib/server/profile/export';

export const MATCH_SCORE_PROMPT = 'score_job_match';

/**
 * Pinned, never `jev-latest`: MATCH_SCORE_LINE was fitted to this version's
 * answers, and an alias that moved would change what a score means without
 * anything failing.
 */
export const MATCH_SCORE_MODEL = 'jev-1.13.0';

export interface MatchFactor {
	/** What the explanation calls it. */
	name: string;
	/** Its share of the combined score: the prompt's own weight for it. */
	weight: number;
	question: ScoreQuestion;
}

/**
 * The prompt's five factors, in its order and with its weights. Each level
 * describes a situation rather than a degree, worst first, because that is
 * what Jev places a state against (docs.typesafe.ai/primitives/score).
 *
 * On their own, skills (91.0%), career (89.7%) and domain (85.4%) rank the
 * golden set well. Experience (66.8%) is the one Jev is least sure of (mean
 * confidence 0.39): its first two levels each hold two directions. Preferences
 * (63.3%) ranks it worst, as it should: the labels ignored location and
 * arrangement, which the eligibility check had already ruled on. Change a
 * question only with a new golden run: the words are what was measured.
 */
export const MATCH_FACTORS = {
	skills: {
		name: 'Technical skills',
		weight: 0.35,
		question: {
			type: 'score',
			instructions:
				"Technical skills: how many of the job's required and preferred skills does the " +
				'candidate demonstrably have? Count only skills the profile shows, not skills they ' +
				'could learn or that are adjacent to what they know.',
			criteria: [
				"Almost none of the job's skills",
				"A few of the job's skills, but most of the core ones are missing",
				'Some of the core skills and some of the rest, with clear gaps',
				"Most of the job's skills, including the core ones",
				"Nearly all of the job's required and preferred skills"
			]
		}
	},
	experience: {
		name: 'Experience level',
		weight: 0.25,
		question: {
			type: 'score',
			instructions:
				"Experience level: does the candidate's seniority fit the level this job is for?",
			criteria: [
				'Far apart: the job is much more junior than the candidate, or a much more senior ' +
					'role than any they have held',
				'A step apart: somewhat more junior than the candidate, or a step up from what they ' +
					'have done',
				'Close: the level fits, with a small difference in seniority or years',
				"The job's level matches the candidate's seniority and experience"
			]
		}
	},
	preferences: {
		name: 'Work preferences',
		weight: 0.2,
		question: {
			type: 'score',
			instructions:
				"Work preferences: do the job's type, work arrangement (remote, hybrid or on-site) " +
				"and location fit the candidate's stated job preferences?",
			criteria: [
				'It conflicts with a stated preference: a job type, arrangement or location the ' +
					'candidate did not list',
				'Partly: the posting leaves it unclear, or fits some preferences and not others',
				"Its type, arrangement and location all fit the candidate's preferences"
			]
		}
	},
	career: {
		name: 'Career progression',
		weight: 0.1,
		question: {
			type: 'score',
			instructions:
				"Career progression: would this job move the candidate's career forward, given " +
				'where it has been heading?',
			criteria: [
				'A step back, or into work the candidate has moved away from',
				'Sideways: much like what they already do',
				'A step forward that builds on their trajectory'
			]
		}
	},
	domain: {
		name: 'Domain',
		weight: 0.1,
		question: {
			type: 'score',
			instructions: "Domain: does the candidate have background in the job's industry or domain?",
			criteria: [
				"No background in the job's industry or domain",
				'Related or transferable background, in an adjacent industry or domain',
				"Direct experience in the job's industry or domain"
			]
		}
	}
} as const satisfies Record<string, MatchFactor>;

export type MatchFactorKey = keyof typeof MATCH_FACTORS;
export const MATCH_FACTOR_KEYS = Object.keys(MATCH_FACTORS) as MatchFactorKey[];

/**
 * From the combined factors (0 to 100) to the scale the prompt scored on, which
 * the blend, the 75/60/40 recommendation words and every stored score assume:
 * a straight line fitted to the prompt's own scores on the golden set, never to
 * the labels. The factors combined to 11 to 85 there, where the prompt gave 10
 * to 98. A line changes no ranking; it decides where the words fall, and with
 * it the golden set's mean shown score per label came out at 78.3, 60.2 and
 * 32.0 (apply, maybe, no) against the prompt's 79.9, 64.4 and 29.8. Fit it
 * again whenever the model, a question or the state changes.
 */
export const MATCH_SCORE_LINE = { intercept: -4.27, slope: 1.31 } as const;

/**
 * Profile fields the state leaves out on top of NON_FIT_FIELDS.
 *
 * The cheat sheets are interview preparation: answers rehearsed for questions,
 * written to be said rather than to describe the applicant. On the profile the
 * golden set holds they were a third of the state (about 10k tokens), and
 * without them the set ranked the same (97.9% against 98.1%, within what a
 * repeat moves). With them, a long profile left little room under Jev's 32k
 * limit: the set's profile as it stood on 2026-10-05 would have gone over it on
 * up to 12 of the 80 jobs, and profiles only grow.
 */
export const MATCH_PROFILE_LEAVES_OUT: ExportedProfileKey[] = ['cheat_sheets'];

/**
 * How much of a posting's description is kept when the whole state is over
 * Jev's limit (32k tokens for the state plus the longest question). 6,000
 * characters is where the app starts compacting a description for other
 * prompts. A state still over the limit after the cut fails, and the matcher
 * falls back to the prompt.
 */
export const MATCH_DESCRIPTION_CUT = 6_000;

/**
 * The state for one job: `values` are the prompt's own variables, as the matcher
 * fills them for `score_job_match`, with the rendered profile as `data`.
 * `cut` keeps only the first MATCH_DESCRIPTION_CUT characters of the posting.
 *
 * The keys and their order are what the golden set measured.
 */
export function matchDecisionState(values: Record<string, string>, cut = false) {
	const description = values['job.job_description'] ?? '';
	return {
		scoring_guide: promptTemplates[MATCH_SCORE_PROMPT].system_prompt,
		candidate_profile: values.data ?? '',
		candidate_preferences: {
			job_types: values['preferences.job_types'],
			experience_levels: values['preferences.experience_levels'],
			work_location: values['preferences.work_location'],
			locations: values['preferences.locations']
		},
		supporting_evidence: values.supportingEvidence ?? '',
		job: {
			title: values['job.title'],
			company: values['job.company'],
			office_location: values['job.office_location'],
			job_types: values['job.job_types'],
			experience_levels: values['job.experience_levels'],
			work_location: values['job.work_location'],
			skills_required: values['job.skills_required'],
			skills_preferred: values['job.skills_preferred'],
			description: cut ? description.slice(0, MATCH_DESCRIPTION_CUT) : description,
			company_description: values['job.company_description']
		}
	};
}

/** The request for one job: its state, and one question per factor, keyed by factor. */
export function matchDecisionRequest(
	values: Record<string, string>,
	cut = false
): SystemOneRequest {
	return {
		model: MATCH_SCORE_MODEL,
		state: matchDecisionState(values, cut),
		questions: Object.fromEntries(
			MATCH_FACTOR_KEYS.map((key) => [key, MATCH_FACTORS[key].question])
		)
	};
}

/** One factor as Jev answered it. */
export interface FactorAnswer {
	/** The probability-weighted level, 0 for the first criterion. */
	level: number;
	/** How many levels the question had. */
	levels: number;
}

/**
 * What a job_matches row keeps of the decision (`score_factors`): enough to say
 * which way each factor went, which the explanation is written from.
 */
export interface ScoreFactors {
	model: string;
	/** The weighted factors, 0 to 100, before MATCH_SCORE_LINE. */
	combined: number;
	factors: Record<MatchFactorKey, FactorAnswer>;
}

/** Every factor's answer. Throws on a factor left unanswered. */
export function factorAnswers(response: SystemOneResponse): Record<MatchFactorKey, FactorAnswer> {
	return Object.fromEntries(
		MATCH_FACTOR_KEYS.map((key) => {
			const level = response.answers[key]?.score;
			if (typeof level !== 'number') throw new Error(`Jev returned no answer for "${key}"`);
			return [key, { level, levels: MATCH_FACTORS[key].question.criteria.length }];
		})
	) as Record<MatchFactorKey, FactorAnswer>;
}

/** The factors combined with the prompt's weights, 0 to 100. */
export function combineFactors(factors: Record<MatchFactorKey, FactorAnswer>): number {
	return (
		100 *
		MATCH_FACTOR_KEYS.reduce(
			(sum, key) =>
				sum + MATCH_FACTORS[key].weight * (factors[key].level / (factors[key].levels - 1)),
			0
		)
	);
}

/** The score the blend takes, as the prompt's `score` was: a whole number from 0 to 100. */
export function matchModelScore(combined: number): number {
	const score = MATCH_SCORE_LINE.intercept + MATCH_SCORE_LINE.slope * combined;
	return Math.round(Math.max(0, Math.min(100, score)));
}

/** Jev's answer as the matcher keeps it: the score the blend takes, and the factors behind it. */
export function matchScoreFrom(response: SystemOneResponse): {
	score: number;
	factors: ScoreFactors;
} {
	const answers = factorAnswers(response);
	const combined = combineFactors(answers);
	return {
		score: matchModelScore(combined),
		factors: { model: MATCH_SCORE_MODEL, combined, factors: answers }
	};
}

/**
 * Each factor's verdict in words: the criterion nearest the level Jev gave it.
 * Skips a factor stored under a question with a different number of levels,
 * whose level would point at the wrong words.
 */
export function factorVerdicts(stored: ScoreFactors): Array<{ name: string; verdict: string }> {
	return MATCH_FACTOR_KEYS.flatMap((key) => {
		const answer = stored.factors?.[key];
		const { criteria } = MATCH_FACTORS[key].question;
		if (!answer || answer.levels !== criteria.length) return [];
		const nearest = Math.max(0, Math.min(criteria.length - 1, Math.round(answer.level)));
		return [{ name: MATCH_FACTORS[key].name, verdict: criteria[nearest] }];
	});
}

/**
 * Which version of the decision a score came from, as 16 hex characters: the
 * model, the scoring guide, the questions, the weights, the line, the fields
 * left out and the cut, which is everything that decides a score here. The golden gate keys the
 * matcher set on it while the matcher scores on Jev, as it keys the prompt on
 * promptFingerprint.
 */
export function matchDecisionFingerprint(): string {
	return createHash('sha256')
		.update(
			JSON.stringify([
				MATCH_SCORE_MODEL,
				promptTemplates[MATCH_SCORE_PROMPT].system_prompt,
				MATCH_FACTORS,
				MATCH_SCORE_LINE,
				MATCH_PROFILE_LEAVES_OUT,
				MATCH_DESCRIPTION_CUT
			])
		)
		.digest('hex')
		.slice(0, 16);
}
