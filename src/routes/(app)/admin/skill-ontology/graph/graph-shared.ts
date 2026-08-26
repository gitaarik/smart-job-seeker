/**
 * The parts both graph views draw the same way.
 *
 * Two views, two questions. The focused view answers "what does React reach?";
 * the full view answers "where is the ontology thin?". They disagree about
 * layout and about node size, and they must not disagree about what a dashed
 * line means — a legend that drifts between two pages is worse than no legend.
 */

/** Relations the matcher traverses, with the line style each is drawn in. */
export const RELATION_STYLES = [
	{ relation: 'broader', label: 'is a kind of', dash: undefined },
	{ relation: 'requires', label: 'requires', dash: '4 3' },
	{ relation: 'covers', label: 'is one entry covering', dash: '1 3' }
] as const;

/**
 * One line style per relation.
 *
 * Solid is the unmarked case because "is a kind of" is most of the graph; the
 * two exceptions earn a mark. Dotted rather than a colour: the palette already
 * carries focus and hover, and a third hue would compete with both for no gain
 * on a diagram that is legible in greyscale.
 */
export function dashFor(relation: string): string | undefined {
	return RELATION_STYLES.find((r) => r.relation === relation)?.dash;
}

/**
 * A left-to-right bezier between two boxes, entering the target's left edge.
 *
 * Stops 7px short so the arrowhead sits beside the box rather than under it.
 */
export function edgePath(
	a: { x: number; y: number },
	b: { x: number; y: number },
	nodeW: number,
	nodeH: number
): string {
	const x1 = a.x + nodeW;
	const y1 = a.y + nodeH / 2;
	const x2 = b.x - 7;
	const y2 = b.y + nodeH / 2;
	const mid = (x1 + x2) / 2;
	return `M ${x1} ${y1} C ${mid} ${y1}, ${mid} ${y2}, ${x2} ${y2}`;
}
