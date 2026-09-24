import { describe, expect, it } from 'vitest';
import {
	competitionRanks,
	type RankedEntry,
	reciprocalRankFusion,
	RRF_DEFAULT_K
} from './rank-fusion';

/** A best-first list of ids with no scores: rank is position. */
const ids = <Id extends string | number>(...list: Id[]): RankedEntry<Id>[] =>
	list.map((id) => ({ id }));
/** A best-first list of [id, score] pairs. */
const scored = <Id extends string | number>(...list: [Id, number][]): RankedEntry<Id>[] =>
	list.map(([id, score]) => ({ id, score }));

describe('competitionRanks', () => {
	it('ranks by position when there are no scores', () => {
		expect([...competitionRanks(ids('a', 'b', 'c'))]).toEqual([
			['a', 1],
			['b', 2],
			['c', 3]
		]);
	});

	it('gives tied neighbours the better rank and skips the ranks they use', () => {
		// 1, 2, 2, 4: the fourth entry is fourth, not third.
		const ranks = competitionRanks(scored(['a', 9], ['b', 6], ['c', 6], ['d', 3]));
		expect([...ranks]).toEqual([
			['a', 1],
			['b', 2],
			['c', 2],
			['d', 4]
		]);
	});

	it('ties a whole run of equal scores, including at the top', () => {
		const ranks = competitionRanks(scored(['a', 3], ['b', 3], ['c', 3], ['d', 1]));
		expect([...ranks.values()]).toEqual([1, 1, 1, 4]);
	});

	it('works for ascending scores too, since only neighbours are compared', () => {
		// A distance list: smaller is better.
		const ranks = competitionRanks(scored(['a', 0.1], ['b', 0.2], ['c', 0.2]));
		expect([...ranks.values()]).toEqual([1, 2, 2]);
	});

	it('never ties an entry that has no score', () => {
		const ranks = competitionRanks([{ id: 'a', score: 1 }, { id: 'b' }, { id: 'c' }]);
		expect([...ranks.values()]).toEqual([1, 2, 3]);
	});

	it('keeps only the first occurrence of an id, and the repeat still takes its place', () => {
		const ranks = competitionRanks(ids('a', 'b', 'a', 'c'));
		expect([...ranks]).toEqual([
			['a', 1],
			['b', 2],
			['c', 4]
		]);
	});

	it('is empty for an empty list', () => {
		expect(competitionRanks([]).size).toBe(0);
	});
});

describe('reciprocalRankFusion', () => {
	const semantic = (...list: number[]) => ({ name: 'semantic', entries: ids(...list) });
	const keyword = (entries: RankedEntry<number>[]) => ({ name: 'keyword', entries });

	it('scores each item as the sum of 1 / (k + rank) over the lists holding it', () => {
		const out = reciprocalRankFusion([semantic(1, 2), keyword(ids(2, 3))]);
		const byId = new Map(out.map((i) => [i.id, i]));
		expect(byId.get(1)!.score).toBeCloseTo(1 / 61, 12);
		expect(byId.get(2)!.score).toBeCloseTo(1 / 62 + 1 / 61, 12);
		expect(byId.get(3)!.score).toBeCloseTo(1 / 62, 12);
		expect(out.map((i) => i.id)).toEqual([2, 1, 3]);
	});

	it('defaults k to 60', () => {
		expect(RRF_DEFAULT_K).toBe(60);
		const [only] = reciprocalRankFusion([semantic(7)]);
		expect(only.score).toBe(1 / 61);
	});

	it('records each rank by list name, and nothing for a list that lacks the item', () => {
		const out = reciprocalRankFusion([semantic(1, 2), keyword(ids(2))]);
		expect(out.find((i) => i.id === 2)!.ranks).toEqual({ semantic: 2, keyword: 1 });
		expect(out.find((i) => i.id === 1)!.ranks).toEqual({ semantic: 1 });
	});

	it('lets fourth on both lists beat first on one list at k = 60', () => {
		// The behaviour the plan asks for: agreement between the rankers counts
		// for more than either one's conviction.
		const out = reciprocalRankFusion([semantic(10, 11, 12, 4), keyword(ids(20, 21, 22, 4))]);
		expect(out[0].id).toBe(4);
	});

	it('lets position count for more at a small k', () => {
		// 1/(k+1) vs 2/(k+4): at k = 1 first-on-one (0.5) beats fourth-on-both (0.4).
		const out = reciprocalRankFusion([semantic(10, 11, 12, 4), keyword(ids(20, 21, 22, 4))], {
			k: 1
		});
		expect(out[0].id).not.toBe(4);
		expect(out.slice(0, 2).map((i) => i.id)).toEqual([10, 20]);
	});

	it('uses rank alone when k is 0', () => {
		const [top] = reciprocalRankFusion([semantic(3)], { k: 0 });
		expect(top.score).toBe(1);
	});

	it('multiplies a list by its weight', () => {
		// Equal ranks, so without a weight this is a tie; semantic weighted double wins.
		const out = reciprocalRankFusion([semantic(1), keyword(ids(2))], {
			weights: { semantic: 2 }
		});
		expect(out.map((i) => i.id)).toEqual([1, 2]);
		expect(out[0].score).toBeCloseTo(2 / 61, 12);
		expect(out[1].score).toBeCloseTo(1 / 61, 12);
	});

	it('lets a weight overturn the list order a tie-break would give', () => {
		const out = reciprocalRankFusion([semantic(1), keyword(ids(2))], {
			weights: { keyword: 2 }
		});
		expect(out.map((i) => i.id)).toEqual([2, 1]);
	});

	it('keeps a list weighted 0 for tie-breaking and ranks but scores nothing from it', () => {
		const out = reciprocalRankFusion([semantic(1), keyword(ids(2))], {
			weights: { semantic: 0 }
		});
		expect(out.map((i) => [i.id, i.score])).toEqual([
			[2, 1 / 61],
			[1, 0]
		]);
	});

	it('returns one list unchanged in order when the other is empty', () => {
		expect(reciprocalRankFusion([semantic(3, 1, 2), keyword([])]).map((i) => i.id)).toEqual([
			3, 1, 2
		]);
		expect(reciprocalRankFusion([semantic(), keyword(ids(5, 4))]).map((i) => i.id)).toEqual([5, 4]);
	});

	it('returns nothing when both lists are empty, or there are no lists', () => {
		expect(reciprocalRankFusion([semantic(), keyword([])])).toEqual([]);
		expect(reciprocalRankFusion([])).toEqual([]);
	});

	it('shares a rank between tied keyword scores, so neither is favoured by accident', () => {
		// 2 and 3 tie on the keyword list; without shared ranks 2 would get rank 1
		// merely by coming first, and win.
		const out = reciprocalRankFusion([keyword(scored([2, 6], [3, 6], [4, 1]))]);
		expect(out[0].ranks.keyword).toBe(1);
		expect(out[1].ranks.keyword).toBe(1);
		expect(out[2].ranks.keyword).toBe(3);
		expect(out[0].score).toBe(out[1].score);
	});

	describe('equal fused scores', () => {
		it('go to the better rank in the first list', () => {
			// 1 is (1st, 2nd) and 2 is (2nd, 1st): identical sums.
			const out = reciprocalRankFusion([semantic(1, 2), keyword(ids(2, 1))]);
			expect(out[0].score).toBe(out[1].score);
			expect(out.map((i) => i.id)).toEqual([1, 2]);
		});

		it('follow the order of the lists, not their names', () => {
			const out = reciprocalRankFusion([keyword(ids(2, 1)), semantic(1, 2)]);
			expect(out.map((i) => i.id)).toEqual([2, 1]);
		});

		it('count absence from the first list as worse than any rank in it', () => {
			// Both score 1/61: 1 only on semantic, 2 only on keyword.
			const out = reciprocalRankFusion([semantic(1), keyword(ids(2))]);
			expect(out.map((i) => i.id)).toEqual([1, 2]);
		});

		it('fall through to the second list when the first ties them', () => {
			// 2 and 3 tie on semantic; the keyword list tells them apart, but also
			// changes the sums, so weight it to zero to isolate the tie-break.
			const out = reciprocalRankFusion(
				[{ name: 'semantic', entries: scored([2, 0.7], [3, 0.7]) }, keyword(ids(3, 2))],
				{ weights: { keyword: 0 } }
			);
			expect(out.map((i) => i.id)).toEqual([3, 2]);
		});

		it('fall back to the smaller id last, numerically', () => {
			const out = reciprocalRankFusion([keyword(scored([10, 3], [9, 3], [100, 3]))]);
			expect(out.map((i) => i.id)).toEqual([9, 10, 100]);
		});

		it('fall back to string order for string ids', () => {
			const out = reciprocalRankFusion([
				{ name: 'keyword', entries: scored(['b', 1], ['a', 1], ['c', 1]) }
			]);
			expect(out.map((i) => i.id)).toEqual(['a', 'b', 'c']);
		});

		it('are deterministic whatever order the tied input came in', () => {
			const a = reciprocalRankFusion([keyword(scored([1, 5], [2, 5], [3, 5]))]);
			const b = reciprocalRankFusion([keyword(scored([3, 5], [1, 5], [2, 5]))]);
			expect(a).toEqual(b);
		});
	});

	it('does not treat rounding noise as a real difference', () => {
		// Three lists, so each item sums the same three terms in a different order,
		// and at k = 2 floating point makes item 1's sum one ulp smaller.
		const out = reciprocalRankFusion(
			[
				{ name: 'a', entries: ids(1, 2, 3) },
				{ name: 'b', entries: ids(3, 1, 2) },
				{ name: 'c', entries: ids(2, 3, 1) }
			],
			{ k: 2 }
		);
		const score = (id: number) => out.find((i) => i.id === id)!.score;
		expect(score(1)).not.toBe(score(2));
		// All three hold ranks {1, 2, 3}: a three-way tie, broken by list "a".
		expect(out.map((i) => i.id)).toEqual([1, 2, 3]);
	});

	it('counts a repeated id once per list, at its best rank', () => {
		const [top] = reciprocalRankFusion([semantic(1, 1)]);
		expect(top.score).toBe(1 / 61);
	});

	it('fuses more than two lists', () => {
		const out = reciprocalRankFusion([
			{ name: 'a', entries: ids(1) },
			{ name: 'b', entries: ids(2) },
			{ name: 'c', entries: ids(2) }
		]);
		expect(out.map((i) => i.id)).toEqual([2, 1]);
	});

	it('does not modify its input', () => {
		const entries = scored([2, 6], [1, 6]);
		const snapshot = structuredClone(entries);
		reciprocalRankFusion([keyword(entries)]);
		expect(entries).toEqual(snapshot);
	});

	describe('refuses a configuration that can only be a mistake', () => {
		it('a negative or non-finite k', () => {
			expect(() => reciprocalRankFusion([semantic(1)], { k: -1 })).toThrow(/k must be/);
			expect(() => reciprocalRankFusion([semantic(1)], { k: NaN })).toThrow(/k must be/);
			expect(() => reciprocalRankFusion([semantic(1)], { k: Infinity })).toThrow(/k must be/);
		});

		it('a negative or non-finite weight', () => {
			expect(() => reciprocalRankFusion([semantic(1)], { weights: { semantic: -1 } })).toThrow(
				/weight/
			);
			expect(() => reciprocalRankFusion([semantic(1)], { weights: { semantic: NaN } })).toThrow(
				/weight/
			);
		});

		it('a weight for a list that was not passed', () => {
			// A typo in a list name would otherwise leave the weight silently unused.
			expect(() => reciprocalRankFusion([semantic(1)], { weights: { semantc: 2 } })).toThrow(
				/unknown list "semantc"/
			);
		});

		it('the same list name twice', () => {
			expect(() => reciprocalRankFusion([semantic(1), semantic(2)])).toThrow(/passed twice/);
		});
	});
});
