import { describe, expect, it } from 'vitest';
import { layoutFullGraph, type Dims, type LayoutEdge, type LayoutNode } from './island-layout';

const DIMS: Dims = {
	nodeW: 100,
	nodeH: 30,
	colGap: 50,
	rowGap: 10,
	islandPad: 10,
	islandGap: 20,
	maxWidth: 1000
};

function nodes(...labels: string[]): LayoutNode[] {
	return labels.map((label, i) => ({ id: i + 1, label }));
}
/** Edges by 1-based node index, matching `nodes()`. */
function edges(...pairs: [number, number][]): LayoutEdge[] {
	return pairs.map(([from_id, to_id]) => ({ from_id, to_id }));
}

/** Every node's box, as [x, y, x+w, y+h]. */
function boxes(pos: Record<number, { x: number; y: number }>) {
	return Object.values(pos).map((p) => [p.x, p.y, p.x + DIMS.nodeW, p.y + DIMS.nodeH]);
}

describe('layoutFullGraph', () => {
	it('places nothing when there is nothing', () => {
		const out = layoutFullGraph([], [], DIMS);
		expect(out.islands).toEqual([]);
		expect(out.pos).toEqual({});
	});

	/**
	 * The direction the whole ontology is about. A chain React -> JS framework ->
	 * JavaScript must read left to right, with the most general concept last.
	 */
	it('puts the general concept on the right', () => {
		const n = nodes('React', 'JS framework', 'JavaScript');
		const { pos } = layoutFullGraph(n, edges([1, 2], [2, 3]), DIMS);
		expect(pos[1].x).toBeLessThan(pos[2].x);
		expect(pos[2].x).toBeLessThan(pos[3].x);
	});

	/**
	 * Column is longest-path-to-a-sink, not hop count from wherever the walk
	 * started. Two branches of different length must still land their shared
	 * sink in one column, or an edge would run backwards.
	 */
	it('columns by the longest path, so no arrow runs backwards', () => {
		// a -> b -> d, and c -> d. d is the sink both reach.
		const n = nodes('a', 'b', 'c', 'd');
		const { pos } = layoutFullGraph(n, edges([1, 2], [2, 4], [3, 4]), DIMS);
		expect(pos[1].x).toBeLessThan(pos[2].x);
		expect(pos[2].x).toBeLessThan(pos[4].x);
		expect(pos[3].x).toBeLessThan(pos[4].x);
	});

	it('separates disconnected islands, biggest first', () => {
		const n = nodes('a', 'b', 'c', 'x', 'y');
		const out = layoutFullGraph(n, edges([1, 2], [2, 3], [4, 5]), DIMS);
		expect(out.islands.map((i) => i.size)).toEqual([3, 2]);
		// The 3-node island is laid out before the 2-node one, to its left.
		expect(out.islands[0].x).toBeLessThan(out.islands[1].x);
	});

	it('never overlaps two nodes', () => {
		const n = nodes(...Array.from({ length: 24 }, (_, i) => `n${i}`));
		// Six 4-node chains, so several islands and several shelves.
		const pairs: [number, number][] = [];
		for (let base = 1; base <= 21; base += 4) {
			pairs.push([base, base + 1], [base + 1, base + 2], [base + 2, base + 3]);
		}
		const out = layoutFullGraph(n, edges(...pairs), DIMS);
		const bs = boxes(out.pos);
		expect(bs).toHaveLength(24);
		for (let i = 0; i < bs.length; i++) {
			for (let j = i + 1; j < bs.length; j++) {
				const [ax1, ay1, ax2, ay2] = bs[i];
				const [bx1, by1, bx2, by2] = bs[j];
				const overlaps = ax1 < bx2 && bx1 < ax2 && ay1 < by2 && by1 < ay2;
				expect(overlaps).toBe(false);
			}
		}
	});

	it('wraps to a new shelf rather than growing past maxWidth', () => {
		const n = nodes(...Array.from({ length: 20 }, (_, i) => `n${i}`));
		// Ten unconnected pairs; each island is 2 columns wide.
		const pairs: [number, number][] = [];
		for (let base = 1; base <= 19; base += 2) pairs.push([base, base + 1]);
		const out = layoutFullGraph(n, edges(...pairs), { ...DIMS, maxWidth: 600 });
		expect(out.width).toBeLessThanOrEqual(600);
		expect(new Set(out.islands.map((i) => i.y)).size).toBeGreaterThan(1);
	});

	/** Shrinking every island to fit the rare wide one is the wrong trade. */
	it('lets one oversized island exceed maxWidth alone', () => {
		const n = nodes('a', 'b', 'c', 'd');
		const out = layoutFullGraph(n, edges([1, 2], [2, 3], [3, 4]), { ...DIMS, maxWidth: 100 });
		expect(out.islands).toHaveLength(1);
		expect(out.width).toBeGreaterThan(100);
	});

	/** One wrong approval away, and an unguarded recursion would hang the page. */
	it('survives a cycle', () => {
		const n = nodes('a', 'b', 'c');
		const out = layoutFullGraph(n, edges([1, 2], [2, 3], [3, 1]), DIMS);
		expect(Object.keys(out.pos)).toHaveLength(3);
		expect(out.islands.map((i) => i.size)).toEqual([3]);
	});

	it('is deterministic, so a screenshot is reproducible', () => {
		const n = nodes('a', 'b', 'c', 'x', 'y');
		const e = edges([1, 2], [2, 3], [4, 5]);
		expect(layoutFullGraph(n, e, DIMS)).toEqual(layoutFullGraph(n, e, DIMS));
	});

	it('ignores an edge to a node it was not given', () => {
		const n = nodes('a', 'b');
		const out = layoutFullGraph(n, edges([1, 2], [2, 99]), DIMS);
		expect(out.islands.map((i) => i.size)).toEqual([2]);
	});
});
