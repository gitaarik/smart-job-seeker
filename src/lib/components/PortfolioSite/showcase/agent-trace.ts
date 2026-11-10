/**
 * The header's agent trace as data: a few runs of an agent the way an
 * observability tool shows them, span names indented on the left and a
 * waterfall of their timings on the right. Each panel has one highlight of
 * its own: a selected span in the names, and a slow model call flagged on
 * the waterfall, in a different run.
 *
 * Seeded, so the server and the browser draw the same picture and hydration
 * has nothing to correct. The geometry is in pixels; the layout clips and
 * fades it rather than scaling it, so the bars keep the size of a minimap.
 */

type SpanKind = 'agent' | 'llm' | 'tool' | 'retrieval' | 'step';

/** Which of the layout's art tones each kind of span is drawn in. */
const KIND_TONE: Record<SpanKind, number> = { agent: 0, llm: 2, tool: 1, retrieval: 3, step: 4 };

export interface TraceRow {
	y: number;
	/** The span's kind, as a dot before its name. */
	iconX: number;
	/** The span's name, as a bar. */
	nameX: number;
	nameWidth: number;
	/** The span on the waterfall: when it started and how long it took. */
	x: number;
	width: number;
	/** Index into the layout's art tones. */
	tone: number;
	/** The slow call the waterfall flags. */
	flagged: boolean;
}

export interface TraceBand {
	x: number;
	y: number;
	width: number;
	/** The waterfall's flag, rather than the names' selection. */
	flagged: boolean;
}

export interface AgentTrace {
	width: number;
	height: number;
	lineHeight: number;
	barHeight: number;
	iconSize: number;
	/** x of the rule between the names and the waterfall. */
	divider: number;
	/** x of the waterfall's time gridlines. */
	grid: number[];
	rows: TraceRow[];
	/** One highlight per panel, each inside its own panel. */
	bands: TraceBand[];
}

const PITCH = 15;
const BAR = 6;
const ICON = 6;
const NAME_X = 32;
const INDENT = 12;
const DIVIDER = 168;
const FALL_X = 186;
const FALL_WIDTH = 360;
const GRID_STEPS = 5;
/** Shortest span on the waterfall, as a share of its width: no slivers. */
const MIN_STEP = 0.12;
const MIN_CHILD = 0.08;

interface Span {
	depth: number;
	kind: SpanKind;
	start: number;
	duration: number;
	name: number;
}

/** Draw `lines` rows of runs, one after another with a blank row between them. */
export function agentTrace(lines = 96, seed = 20261109): AgentTrace {
	let state = seed;
	const rnd = () => ((state = (state * 16807) % 2147483647) - 1) / 2147483646;
	const pick = <T>(options: T[]) => options[Math.floor(rnd() * options.length)];

	const spans: (Span | null)[] = [];
	while (spans.length < lines) {
		if (spans.length) spans.push(null);
		const start = rnd() * 0.06;
		const duration = Math.min(1 - start, 0.66 + rnd() * 0.32);
		spans.push({ depth: 0, kind: 'agent', start, duration, name: 5 + Math.floor(rnd() * 4) });
		const end = start + duration;
		let cursor = start + 0.012;
		const steps = 2 + Math.floor(rnd() * 3);
		for (let s = 0; s < steps; s++) {
			const room = end - cursor;
			if (room < MIN_STEP) break;
			const last = s === steps - 1 || room < 2 * MIN_STEP;
			const d = last ? room * 0.94 : Math.max(MIN_STEP, room * (0.25 + rnd() * 0.3));
			const kind = pick<SpanKind>(['llm', 'llm', 'tool', 'tool', 'retrieval']);
			spans.push({ depth: 1, kind, start: cursor, duration: d, name: 3 + Math.floor(rnd() * 6) });
			// A tool runs steps of its own; now and then a model call is a chain.
			if (d >= 2 * MIN_CHILD && (kind === 'tool' || (kind === 'llm' && rnd() < 0.35))) {
				const n = 1 + Math.floor(rnd() * 2);
				let c = cursor + d * 0.04;
				for (let k = 0; k < n; k++) {
					const cd = Math.max(MIN_CHILD, d * (0.35 + rnd() * 0.3));
					if (c + cd > cursor + d) break;
					spans.push({
						depth: 2,
						kind: kind === 'tool' ? 'step' : 'llm',
						start: c,
						duration: cd,
						name: 3 + Math.floor(rnd() * 5)
					});
					c += cd + d * 0.03;
				}
			}
			cursor += d + 0.01;
		}
	}
	spans.length = lines;

	// The waterfall flags the slowest model call among the first rows, so its
	// highlight sits where the header is on every screen.
	let flagged = -1;
	spans.forEach((span, i) => {
		if (i < 4 || i > 22 || span?.depth !== 1 || span.kind !== 'llm') return;
		const best = flagged >= 0 ? spans[flagged] : null;
		if (!best || span.duration > best.duration) flagged = i;
	});
	// The names panel has a tool selected in a later run.
	const runOf = (i: number) => spans.slice(0, i + 1).filter((s) => s === null).length;
	const selected = spans.findIndex(
		(span, i) => i > flagged + 4 && i < 40 && span?.kind === 'tool' && runOf(i) !== runOf(flagged)
	);

	const rows: TraceRow[] = [];
	const bands: TraceBand[] = [];
	spans.forEach((span, i) => {
		const y = 9 + i * PITCH;
		if (i === selected) {
			bands.push({ x: NAME_X - 14, y: y - 4.5, width: DIVIDER - NAME_X + 6, flagged: false });
		}
		if (i === flagged) {
			bands.push({ x: FALL_X - 8, y: y - 4.5, width: FALL_WIDTH + 16, flagged: true });
		}
		if (!span) return;
		const iconX = NAME_X + span.depth * INDENT;
		rows.push({
			y,
			iconX,
			nameX: iconX + ICON + 4,
			nameWidth: span.name * 6,
			x: FALL_X + span.start * FALL_WIDTH,
			width: span.duration * FALL_WIDTH,
			tone: KIND_TONE[span.kind],
			flagged: i === flagged
		});
	});

	return {
		width: FALL_X + FALL_WIDTH + 34,
		height: lines * PITCH + 9,
		lineHeight: PITCH,
		barHeight: BAR,
		iconSize: ICON,
		divider: DIVIDER,
		grid: Array.from({ length: GRID_STEPS + 1 }, (_, k) => FALL_X + (k * FALL_WIDTH) / GRID_STEPS),
		rows,
		bands
	};
}
