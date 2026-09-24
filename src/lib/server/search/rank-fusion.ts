/**
 * Reciprocal rank fusion: merge ranked lists by position alone.
 *
 * Each list gives every item it holds `weight / (k + rank)`, ranks starting at
 * 1, and an item's fused score is the sum over the lists that hold it. Nothing
 * else about the lists is used, which is the point: the rankers this merges
 * score on scales that cannot be compared — a cosine bounded in [0, 1] against
 * an unbounded count of keyword hits, or a `ts_rank_cd` against a vector
 * distance — and any arithmetic putting them on one scale is an invented
 * weighting. Positions are comparable; numbers are not.
 *
 * Shared on purpose. Project retrieval (planning/PROJECT-RETRIEVAL-FUSION.md)
 * and the hybrid job search (planning/PGVECTOR-AND-HYBRID-SEARCH.md) both merge
 * two rankers this way, and one function means they cannot drift into merging
 * differently. So it knows nothing about projects or jobs: ids in, ids out.
 *
 * ## What the caller decides
 *
 *  - **Which items each list holds.** Pass the lists already cut to what should
 *    compete: project retrieval passes everything above its floors, the job
 *    search each ranker's top 100. This function does not truncate.
 *  - **The order of the lists.** It is the tie-break priority, see below.
 *  - **k and the weights.** k = 60 is the usual starting value: with short lists
 *    it makes "on both lists" beat "first on one list" almost always. A smaller
 *    k makes position count for more. Both are meant to be set from a labelled
 *    set, not by taste.
 *
 * ## Ties
 *
 * Inside a list, entries with equal scores share the better rank (competition
 * ranking: 1, 2, 2, 4). Keyword scores are small integers and tie constantly, so
 * without this the order a database happened to return would decide who gets
 * the higher rank. Only ADJACENT equal scores tie, so the direction does not
 * matter: a best-first list of descending scores and one of ascending distances
 * both work. An entry without a score never ties, and its rank is its position.
 *
 * Between items with equal fused scores, the one ranked better in the first
 * list wins, then the second list, and so on (absent counts as worst), then the
 * smaller id. Results are deterministic whatever order the input came in.
 */

/** k when the caller does not choose one: the value from the original paper. */
export const RRF_DEFAULT_K = 60;

/** One entry of a ranked list. */
export interface RankedEntry<Id extends string | number> {
	id: Id;
	/**
	 * The ranker's own score, used only to detect ties between neighbours —
	 * never added to anything. Omit it and the entry's rank is its position.
	 */
	score?: number;
}

/** One ranker's output, best first. */
export interface RankedList<Id extends string | number> {
	/** Names the list in `weights` and in each result's `ranks`. */
	name: string;
	entries: readonly RankedEntry<Id>[];
}

export interface FusionOptions {
	/** The constant in `1 / (k + rank)`. Default {@link RRF_DEFAULT_K}. */
	k?: number;
	/** Multiplier per list name; a list not named here weighs 1. */
	weights?: Readonly<Record<string, number>>;
}

export interface FusedItem<Id extends string | number> {
	id: Id;
	/** Sum of `weight / (k + rank)` over the lists holding this item. */
	score: number;
	/** The item's rank in each list that holds it, by list name. */
	ranks: Record<string, number>;
}

/**
 * Two fused scores this close are the same score. Sums of the same terms in a
 * different order can differ in the last bit, and a tie decided by rounding
 * error is exactly the accident the tie-break exists to prevent. Real
 * differences are far larger: at k = 60 and ranks up to 1,000, neighbouring
 * terms differ by about 1e-6.
 */
const SCORE_EPSILON = 1e-12;

/**
 * Competition ranks for a best-first list: equal adjacent scores share the
 * better rank. Only the first occurrence of an id counts — a repeat would
 * otherwise hand one item two ranks — and a skipped repeat still takes up its
 * position, so later entries keep the rank the ranker gave them.
 */
export function competitionRanks<Id extends string | number>(
	entries: readonly RankedEntry<Id>[]
): Map<Id, number> {
	const ranks = new Map<Id, number>();
	let previous: number | undefined;
	let previousRank = 0;
	entries.forEach((entry, i) => {
		const position = i + 1;
		const tied = entry.score !== undefined && previous !== undefined && entry.score === previous;
		const rank = tied ? previousRank : position;
		previous = entry.score;
		previousRank = rank;
		if (!ranks.has(entry.id)) ranks.set(entry.id, rank);
	});
	return ranks;
}

function compareIds(a: string | number, b: string | number): number {
	if (typeof a === 'number' && typeof b === 'number') return a - b;
	const sa = String(a);
	const sb = String(b);
	return sa < sb ? -1 : sa > sb ? 1 : 0;
}

/**
 * Fuse ranked lists into one, best first. Pure.
 *
 * Throws on a configuration that can only be a mistake — a negative or
 * non-finite k or weight, a duplicate list name, a weight for a list that was
 * not passed — rather than returning a ranking that is quietly wrong.
 */
export function reciprocalRankFusion<Id extends string | number>(
	lists: readonly RankedList<Id>[],
	options: FusionOptions = {}
): FusedItem<Id>[] {
	const k = options.k ?? RRF_DEFAULT_K;
	if (!Number.isFinite(k) || k < 0) throw new Error(`rank fusion: k must be >= 0, got ${k}`);

	const names = lists.map((l) => l.name);
	const duplicate = names.find((n, i) => names.indexOf(n) !== i);
	if (duplicate !== undefined) throw new Error(`rank fusion: list "${duplicate}" passed twice`);

	const weights = options.weights ?? {};
	for (const [name, weight] of Object.entries(weights)) {
		if (!names.includes(name)) throw new Error(`rank fusion: weight for unknown list "${name}"`);
		if (!Number.isFinite(weight) || weight < 0) {
			throw new Error(`rank fusion: weight for "${name}" must be >= 0, got ${weight}`);
		}
	}

	const fused = new Map<Id, FusedItem<Id>>();
	for (const list of lists) {
		const weight = weights[list.name] ?? 1;
		for (const [id, rank] of competitionRanks(list.entries)) {
			const item = fused.get(id) ?? { id, score: 0, ranks: {} };
			item.score += weight / (k + rank);
			item.ranks[list.name] = rank;
			fused.set(id, item);
		}
	}

	return [...fused.values()].sort((a, b) => {
		if (Math.abs(a.score - b.score) > SCORE_EPSILON) return b.score - a.score;
		for (const name of names) {
			const ra = a.ranks[name] ?? Infinity;
			const rb = b.ranks[name] ?? Infinity;
			if (ra !== rb) return ra - rb;
		}
		return compareIds(a.id, b.id);
	});
}
