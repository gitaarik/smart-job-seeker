/**
 * The parts both graph views draw the same way.
 *
 * Two views, two questions. The focused view answers "what does React reach?";
 * the full view answers "where is the ontology thin?". They disagree about
 * layout and about node size, and they must not disagree about what a dashed
 * line means — a legend that drifts between two pages is worse than no legend.
 */

/**
 * Every relation drawn, with the line style each gets.
 *
 * The first three are the ones the matcher traverses. `inDomain` is not — it
 * groups categories under a domain so the graph has a spine, and `expandUpward`
 * never walks it. It is drawn faintest on purpose: it carries the least
 * information per line and there are enough of them to swamp the real
 * hierarchy if they competed for attention.
 */
export const RELATION_STYLES = [
	{ relation: 'broader', label: 'is a kind of', verb: 'is a kind of', dash: undefined },
	{ relation: 'requires', label: 'requires', verb: 'cannot be used without', dash: '4 3' },
	{
		relation: 'covers',
		label: 'is one entry covering',
		verb: 'is one entry covering',
		dash: '1 3'
	},
	{
		relation: 'inDomain',
		label: 'in domain (not matched)',
		verb: 'is in the domain of',
		dash: '1 5'
	}
] as const;

/**
 * The same relation as a verb you can put between two names.
 *
 * `label` and `verb` are separate because they do different jobs, and collapsing
 * them makes one of the two read badly. A legend wants the shortest thing that
 * distinguishes a line — "requires". A sentence wants the phrasing that cannot
 * be read backwards — "cannot be used without", which is why the review queue
 * writes it that way. Reusing the legend label as a verb produced "Docker in
 * domain (not matched) Marketplaces" in the relation picker, which is how this
 * field came to exist.
 *
 * The review queue's own `sentence()` still hard-codes three of these and falls
 * back to "X — inDomain — Y" for the fourth; it should read from here.
 */
export function verbFor(relation: string): string {
	return RELATION_STYLES.find((r) => r.relation === relation)?.verb ?? relation;
}

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
