/**
 * The header's code review as data: one file drawn twice as a minimap, the
 * original on the left and the reviewed version on the right, with a few
 * lines rewritten and one of them carrying a comment.
 *
 * Seeded, so the server and the browser draw the same picture and hydration
 * has nothing to correct. The geometry is in pixels; the layout clips and
 * fades it rather than scaling it, so the bars keep the size of a minimap.
 */

export interface MinimapBar {
	x: number;
	y: number;
	width: number;
	/** Index into the layout's code tones. */
	tone: number;
	/** On a rewritten line of the right pane. */
	changed: boolean;
}

export interface MinimapBand {
	y: number;
	/** The line with the review comment, rather than a plain change. */
	comment: boolean;
}

export interface Minimap {
	width: number;
	height: number;
	/** x of the rule between the panes. */
	divider: number;
	pane: { x: number; width: number };
	lineHeight: number;
	barHeight: number;
	bars: MinimapBar[];
	bands: MinimapBand[];
	marker: { x: number; y: number };
}

const PITCH = 15;
const BAR = 6;
const UNIT = 6.5;
const PANES = [
	{ x: 40, width: 296 },
	{ x: 376, width: 296 }
];
/** Weighted: the first two tones are the common ones. */
const TONE_PICKS = [0, 1, 2, 3, 4, 0, 1];
const CHANGED = new Set([6, 7, 8, 15, 16, 31, 32, 33, 47, 48, 61]);
const COMMENT = 16;

/**
 * Draw `lines` lines. The seed and the drawing match the LinkedIn banner the
 * design came from, so its first 26 lines are the same code.
 */
export function codeMinimap(lines = 72, seed = 20261108): Minimap {
	let state = seed;
	const rnd = () => ((state = (state * 16807) % 2147483647) - 1) / 2147483646;

	const rows: ({ indent: number; tokens: { len: number; tone: number }[] } | null)[] = [];
	let indent = 0;
	for (let i = 0; i < lines; i++) {
		if (rnd() < 0.1) {
			rows.push(null);
			indent = Math.max(0, indent - 1);
			continue;
		}
		const r = rnd();
		if (r < 0.2 && indent < 3) indent++;
		else if (r < 0.34 && indent > 0) indent--;
		const tokens: { len: number; tone: number }[] = [];
		const n = 1 + Math.floor(rnd() * 4);
		for (let t = 0; t < n; t++) {
			tokens.push({
				len: 2 + Math.floor(rnd() * 9),
				tone: TONE_PICKS[Math.floor(rnd() * TONE_PICKS.length)]
			});
		}
		rows.push({ indent, tokens });
	}

	const bars: MinimapBar[] = [];
	const bands: MinimapBand[] = [];
	rows.forEach((row, i) => {
		const y = 9 + i * PITCH;
		if (CHANGED.has(i)) bands.push({ y: y - 4.5, comment: i === COMMENT });
		if (!row) return;
		PANES.forEach((pane, p) => {
			const changed = p === 1 && CHANGED.has(i);
			// The right pane is the same file with a few lines rewritten.
			const tokens = changed
				? row.tokens.map((t, k) => ({ ...t, len: Math.max(2, t.len + ((k + i) % 3) * 2 - 1) }))
				: row.tokens;
			let x = pane.x + row.indent * 4 * UNIT;
			for (const t of tokens) {
				const width = t.len * UNIT;
				if (x + width > pane.x + pane.width) break;
				bars.push({ x, y, width, tone: t.tone, changed });
				x += width + UNIT;
			}
		});
	});

	const divider = (PANES[0].x + PANES[0].width + PANES[1].x) / 2;
	return {
		width: PANES[1].x + PANES[1].width + 40,
		height: lines * PITCH + 9,
		divider,
		pane: { x: PANES[1].x - 10, width: PANES[1].width + 16 },
		lineHeight: PITCH,
		barHeight: BAR,
		bars,
		bands,
		marker: { x: divider + 0.5, y: 9 + COMMENT * PITCH + BAR / 2 }
	};
}
