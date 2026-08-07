/**
 * Normalize an application-question string for exact-match deduplication.
 *
 * Collapses only *trivial* differences — surrounding whitespace, internal
 * whitespace runs, letter case, and trailing sentence punctuation — so that
 * "Why us?" and "  why   us  " collide, while genuinely different questions
 * stay distinct. This is deliberately NOT fuzzy/semantic matching: a wrong
 * match would silently file an answer under the wrong question, which is worse
 * than a visible duplicate. Two questions are "the same" iff their normalized
 * forms are strictly equal.
 */
export function normalizeQuestion(s: string): string {
	return s
		.trim()
		.toLowerCase()
		.replace(/\s+/g, ' ')
		.replace(/[?.!:]+$/, '');
}
