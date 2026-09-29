/**
 * The recommendation word a job match shows, worked out from its score and
 * never stored.
 *
 * Lives outside `$lib/server` because both sides need it, as
 * match-provenance.ts does: the pages show the word, and the server hands it to
 * the assistant.
 *
 * The model used to choose the word itself, and chose it apart from the number
 * it gave: on preview a stored "consider" ran from 4 to 98 and "not recommended"
 * went up to 70. In the matcher golden set, which scores every job three times,
 * the model's word changed between scorings on 31 of 80 jobs; read off the
 * scores of those same answers, it changes on 18. It can never disagree with
 * the number on screen, and moving a line moves every match at once, old ones
 * included.
 */

/** The four words, best first. */
export type RecommendationWord = 'highly_recommend' | 'recommend' | 'consider' | 'not_recommended';

/**
 * Why a match has no word: the job failed the eligibility check before any
 * model saw it. `ineligible` is the matcher's own cycle and `filtered_out` a
 * match queued for one job; both are the same check.
 */
export type SkipReason = 'ineligible' | 'filtered_out';

/** What a match shows: the word for its score, or why it has none. */
export type Recommendation = RecommendationWord | SkipReason;

/**
 * The lowest score of each word. They are the edges of the bands in
 * score_job_match's scoring guide, folded into four: Exceptional and Strong
 * from 75, Good from 60, Moderate from 40, Weak and Poor below. A test holds
 * the two together.
 */
export const RECOMMENDATION_FLOORS = {
	highly_recommend: 75,
	recommend: 60,
	consider: 40,
	not_recommended: 0
} as const satisfies Record<RecommendationWord, number>;

const BEST_FIRST: RecommendationWord[] = [
	'highly_recommend',
	'recommend',
	'consider',
	'not_recommended'
];

/** The word for a match score. */
export function recommendationWord(score: number): RecommendationWord {
	return BEST_FIRST.find((word) => score >= RECOMMENDATION_FLOORS[word]) ?? 'not_recommended';
}

/** What a match row shows: why it was skipped, or the word for its score. */
export function recommendationOf(match: {
	score: number;
	skip_reason: SkipReason | null;
}): Recommendation {
	return match.skip_reason ?? recommendationWord(match.score);
}
