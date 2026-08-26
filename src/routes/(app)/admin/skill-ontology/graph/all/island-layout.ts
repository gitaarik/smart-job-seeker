/**
 * Lay out the whole approved graph — every concept an edge touches, at once.
 *
 * ## Why this is drawable at all
 *
 * The focused view's header says 244 nodes would be a hairball. That was
 * reasoning from the vocabulary rather than from the graph, and it was wrong.
 * Measured on dev: of 247 concepts only **116** are touched by an approved
 * edge, joined by **117** edges — about one edge per node. The result is not a
 * hairball but a forest: **18 connected components**, the largest 29 and 26
 * nodes, everything else 8 or fewer, a DAG four hops deep with a maximum
 * in-degree of 5.
 *
 * So the layout can be exact rather than approximate, which is why there is no
 * force simulation here either. Islands are laid out one at a time and packed.
 *
 * ## Why it is a .ts module and not `$derived.by` in the page
 *
 * Two reasons, and the second is the real one. It is genuinely testable — a
 * layout that silently overlaps two nodes is a bug no type checks. And
 * `svelte/prefer-svelte-reactivity` fires on a plain `Map` inside a `.svelte`
 * file however immutably it is used, and this algorithm wants several.
 */

export interface LayoutNode {
	id: number;
	label: string;
}

export interface LayoutEdge {
	from_id: number;
	to_id: number;
}

export interface Dims {
	nodeW: number;
	nodeH: number;
	colGap: number;
	rowGap: number;
	/** Padding inside one island, between its border and its nodes. */
	islandPad: number;
	/** Space between islands, both ways. */
	islandGap: number;
	/** Islands wrap to a new row past this, unless one island is wider alone. */
	maxWidth: number;
}

/** One connected component's bounding box, drawn so the islands read as islands. */
export interface Island {
	x: number;
	y: number;
	w: number;
	h: number;
	size: number;
}

export interface FullLayout {
	pos: Record<number, { x: number; y: number }>;
	islands: Island[];
	width: number;
	height: number;
}

/**
 * Longest path from each node to a sink, memoised.
 *
 * This is what puts the general concepts on the right: a sink — nothing it
 * implies — is height 0 and lands in the last column, and a node's column is
 * `maxHeight - height`, so the most specific concept in an island starts at
 * the left edge and every arrow runs rightward.
 *
 * The `visiting` state is a cycle guard rather than an assertion. The data is a
 * DAG today, but a cycle is one wrong approval away and an unguarded recursion
 * would hang the page rather than draw a slightly odd picture.
 */
function heights(ids: number[], out: Map<number, number[]>): Map<number, number> {
	const height = new Map<number, number>();
	const visiting = new Set<number>();

	function walk(id: number): number {
		const done = height.get(id);
		if (done !== undefined) return done;
		if (visiting.has(id)) return 0;
		visiting.add(id);
		let best = 0;
		for (const next of out.get(id) ?? []) best = Math.max(best, walk(next) + 1);
		visiting.delete(id);
		height.set(id, best);
		return best;
	}

	for (const id of ids) walk(id);
	return height;
}

/** Connected components over the UNDIRECTED graph, largest first. */
function components(nodes: LayoutNode[], edges: LayoutEdge[]): LayoutNode[][] {
	const byId = new Map(nodes.map((n) => [n.id, n]));
	const near = new Map<number, number[]>();
	const link = (a: number, b: number) => {
		if (!near.has(a)) near.set(a, []);
		near.get(a)!.push(b);
	};
	for (const e of edges) {
		if (!byId.has(e.from_id) || !byId.has(e.to_id)) continue;
		link(e.from_id, e.to_id);
		link(e.to_id, e.from_id);
	}

	const seen = new Set<number>();
	const found: LayoutNode[][] = [];
	for (const n of nodes) {
		if (seen.has(n.id)) continue;
		const group: LayoutNode[] = [];
		const queue = [n.id];
		seen.add(n.id);
		while (queue.length > 0) {
			const id = queue.shift()!;
			group.push(byId.get(id)!);
			for (const next of near.get(id) ?? []) {
				if (seen.has(next)) continue;
				seen.add(next);
				queue.push(next);
			}
		}
		found.push(group);
	}

	// Deterministic on purpose, so the same data draws the same picture and a
	// screenshot is reproducible: biggest island first, ties broken by name.
	for (const g of found) g.sort((a, b) => a.label.localeCompare(b.label));
	found.sort((a, b) => b.length - a.length || a[0].label.localeCompare(b[0].label));
	return found;
}

/**
 * Place every node, and return a box per island.
 *
 * Islands are packed onto shelves: fill a row left to right until the next one
 * would pass `maxWidth`, then start a new row at the height of the tallest
 * island in the finished one. An island wider than `maxWidth` on its own gets a
 * row to itself rather than being shrunk — the page scrolls, and shrinking the
 * common case to fit the rare one is the wrong trade.
 */
export function layoutFullGraph(nodes: LayoutNode[], edges: LayoutEdge[], dims: Dims): FullLayout {
	const { nodeW, nodeH, colGap, rowGap, islandPad, islandGap, maxWidth } = dims;
	const pos: Record<number, { x: number; y: number }> = {};
	const islands: Island[] = [];

	const out = new Map<number, number[]>();
	for (const e of edges) {
		if (!out.has(e.from_id)) out.set(e.from_id, []);
		out.get(e.from_id)!.push(e.to_id);
	}

	let shelfX = 0;
	let shelfY = 0;
	let shelfH = 0;
	let width = 0;

	for (const group of components(nodes, edges)) {
		const ids = group.map((n) => n.id);
		const height = heights(ids, out);
		const maxH = Math.max(0, ...ids.map((id) => height.get(id) ?? 0));

		const columns: LayoutNode[][] = Array.from({ length: maxH + 1 }, () => []);
		for (const n of group) columns[maxH - (height.get(n.id) ?? 0)].push(n);

		const tallest = Math.max(1, ...columns.map((c) => c.length));
		const innerW = columns.length * nodeW + (columns.length - 1) * colGap;
		const innerH = tallest * nodeH + (tallest - 1) * rowGap;
		const boxW = innerW + islandPad * 2;
		const boxH = innerH + islandPad * 2;

		if (shelfX > 0 && shelfX + boxW > maxWidth) {
			shelfX = 0;
			shelfY += shelfH + islandGap;
			shelfH = 0;
		}

		columns.forEach((col, ci) => {
			const colH = col.length * nodeH + (col.length - 1) * rowGap;
			const top = shelfY + islandPad + (innerH - colH) / 2;
			col.forEach((n, ri) => {
				pos[n.id] = {
					x: shelfX + islandPad + ci * (nodeW + colGap),
					y: top + ri * (nodeH + rowGap)
				};
			});
		});

		islands.push({ x: shelfX, y: shelfY, w: boxW, h: boxH, size: group.length });
		shelfX += boxW + islandGap;
		shelfH = Math.max(shelfH, boxH);
		width = Math.max(width, shelfX - islandGap);
	}

	return { pos, islands, width, height: shelfY + shelfH };
}
