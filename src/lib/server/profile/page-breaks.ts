/**
 * Moving an entry a page break splits onto the next page, when that costs nothing.
 *
 * Chrome breaks a page wherever the page ends, so a role can open on the last
 * few lines of one page and carry on over the next. CSS alone cannot fix that
 * well: `break-inside: avoid` on every role is greedy. It moves each role that
 * does not fit, whatever that leaves behind or costs further down: on the
 * Citrus resume of 2026-11-03 it also moved the role that sat half on page 2
 * and half on page 3, leaving a third of page 2 empty, and on a fuller document
 * the same rule adds a page. The rule a person applies looking at the pages is
 * different: move a role when it then fits whole on the next page, little is
 * left empty behind it, nothing else splits because of it, and the document
 * stays as long as it was.
 *
 * Checking that needs to know where the pages actually break, and the only
 * thing that knows is the print. So the print is asked. Each text inside an
 * entry is wrapped in a link to a made-up URL that names the entry, and Chrome
 * writes every link into the PDF as an annotation on the page it landed on,
 * with its rectangle. Reading those back gives each entry's first and last page
 * and how much of it the first page holds. A move is tried by printing again
 * with the break in place and kept only if that print is no longer, and has
 * fewer split entries, than the one before. Nothing is predicted, so there is no
 * model of Chrome's page breaking here to drift from the real one.
 *
 * A renderer opts in by marking each entry `data-keep-whole`. Only an entry that
 * follows another marked entry (a rule between them is fine) is ever moved: the
 * first one under a heading stays, since moving it would leave the heading at
 * the bottom of the page on its own. The marker links come out before the print
 * that is kept, and anything that goes wrong on the way leaves the document
 * printed as it was before this existed.
 */

/** The attribute a renderer puts on each entry it would rather not see split. */
export const KEEP_WHOLE_ATTRIBUTE = 'data-keep-whole';

/** Where the marker links point. `.invalid` is reserved, so none can resolve. */
export const MARKER_URL = 'https://keep-whole.invalid/';

export interface PlanOptions {
	/**
	 * The most of a page an entry may leave empty by moving, as a share of the
	 * page's height: the part of the entry the earlier page held. Without it an
	 * entry that only just spills over would leave most of a page blank.
	 */
	maxHeadShare: number;
	/** Test prints at most, beyond the first one. Each is a full print. */
	maxTrials: number;
}

/**
 * A fifth of the page. On the Citrus resume of 2026-11-03 the role that opened
 * at the foot of page 1 held a tenth of the page there and moves. The next one,
 * once that has moved, holds 23% of page 2 and carries on over page 3; moving
 * it too keeps three pages but leaves a third of page 2 empty, so it stays.
 */
export const PLAN_DEFAULTS: PlanOptions = { maxHeadShare: 0.2, maxTrials: 6 };

// --- Reading the print ---------------------------------------------------

export interface PdfLink {
	/** 1-based. */
	page: number;
	url: string;
	/** PDF points, origin at the bottom left: x1, y1, x2, y2. */
	rect: [number, number, number, number];
}

export interface PdfLinks {
	pages: number;
	/** In PDF points, read from the first page. */
	pageHeight: number;
	links: PdfLink[];
}

/**
 * Every link annotation in a PDF, by page.
 *
 * Written for what Chrome produces, which is plain: a classic cross-reference
 * table, page objects listing their annotations inline, one link per object
 * with its rectangle and URI. page-fit.ts already counts Chrome's pages by
 * reading the bytes the same way. Anything else (compressed object streams,
 * an incremental update) throws, and the caller prints without moving anything.
 */
export function readPdfLinks(pdf: Buffer): PdfLinks {
	// latin1 maps each byte to one character, so string offsets are byte offsets.
	const src = pdf.toString('latin1');
	const offsets = xrefOffsets(src);
	const object = (n: number): string => {
		const at = offsets.get(n);
		if (at === undefined) throw new Error(`PDF object ${n} is not in the cross-reference table`);
		const end = src.indexOf('endobj', at);
		return src.slice(at, end < 0 ? undefined : end);
	};

	const trailer = src.slice(src.lastIndexOf('trailer'));
	const root = refAfter(trailer, 'Root');
	const tree = root === null ? null : refAfter(object(root), 'Pages');
	if (tree === null) throw new Error('PDF has no page tree');

	const pageObjects: number[] = [];
	const walk = (n: number, depth: number) => {
		if (depth > 32) throw new Error('PDF page tree is too deep');
		const body = object(n);
		if (/\/Type\s*\/Pages\b/.test(body)) {
			for (const kid of refsIn(arrayAfter(body, 'Kids') ?? '')) walk(kid, depth + 1);
		} else {
			pageObjects.push(n);
		}
	};
	walk(tree, 0);
	if (pageObjects.length === 0) throw new Error('PDF has no pages');

	const box = numbersIn(
		arrayAfter(object(pageObjects[0]), 'MediaBox') ?? arrayAfter(object(tree), 'MediaBox') ?? ''
	);
	if (box.length !== 4) throw new Error('PDF page has no MediaBox');

	const links: PdfLink[] = [];
	pageObjects.forEach((n, index) => {
		const body = object(n);
		const indirect = /\/Annots\s+(\d+)\s+\d+\s+R/.exec(body);
		const list = indirect ? object(Number(indirect[1])) : (arrayAfter(body, 'Annots') ?? '');
		for (const a of refsIn(list)) {
			const annot = object(a);
			if (!/\/Subtype\s*\/Link\b/.test(annot)) continue;
			const uri = /\/URI\s*\(([^)]*)\)/.exec(annot);
			const rect = numbersIn(arrayAfter(annot, 'Rect') ?? '');
			if (!uri || rect.length !== 4) continue;
			links.push({ page: index + 1, url: uri[1], rect: [rect[0], rect[1], rect[2], rect[3]] });
		}
	});

	return { pages: pageObjects.length, pageHeight: Math.abs(box[3] - box[1]), links };
}

function pageCountOrNull(pdf: Buffer): number | null {
	try {
		return readPdfLinks(pdf).pages;
	} catch {
		return null;
	}
}

function xrefOffsets(src: string): Map<number, number> {
	const start = /startxref\s+(\d+)\s+%%EOF\s*$/.exec(src);
	if (!start) throw new Error('PDF has no startxref');
	const at = Number(start[1]);
	if (!src.startsWith('xref', at)) {
		throw new Error('PDF uses a cross-reference stream, not a table');
	}
	const end = src.indexOf('trailer', at);
	if (end < 0) throw new Error('PDF has no trailer');
	const lines = src
		.slice(at + 4, end)
		.split(/\r\n|\r|\n/)
		.map((line) => line.trim())
		.filter(Boolean);
	const offsets = new Map<number, number>();
	let i = 0;
	while (i < lines.length) {
		const [first, count] = lines[i++].split(/\s+/).map(Number);
		if (!Number.isInteger(first) || !Number.isInteger(count)) {
			throw new Error('PDF cross-reference table is malformed');
		}
		for (let k = 0; k < count; k++, i++) {
			const [offset, , kind] = (lines[i] ?? '').split(/\s+/);
			if (kind === 'n') offsets.set(first + k, Number(offset));
		}
	}
	return offsets;
}

function refAfter(body: string, key: string): number | null {
	const m = new RegExp(`/${key}\\s+(\\d+)\\s+\\d+\\s+R`).exec(body);
	return m ? Number(m[1]) : null;
}

function arrayAfter(body: string, key: string): string | null {
	const m = new RegExp(`/${key}\\s*\\[([^\\]]*)\\]`).exec(body);
	return m ? m[1] : null;
}

function refsIn(list: string): number[] {
	return Array.from(list.matchAll(/(\d+)\s+\d+\s+R/g), (m) => Number(m[1]));
}

function numbersIn(list: string): number[] {
	return list
		.trim()
		.split(/\s+/)
		.filter(Boolean)
		.map(Number)
		.filter((n) => Number.isFinite(n));
}

// --- Where each entry landed ---------------------------------------------

export interface EntrySpan {
	/** 1-based, like the PDF's pages. */
	first: number;
	last: number;
	/** PDF points of the entry on its first page, from its top line to its bottom one. */
	head: number;
}

export interface EntryLayout {
	pages: number;
	pageHeight: number;
	/** By entry, in document order; null for one with no text the print placed. */
	entries: (EntrySpan | null)[];
}

/** Each entry's span, read off the marker links of one print. */
export function entryLayout(read: PdfLinks, entryCount: number, prefix = MARKER_URL): EntryLayout {
	const boxes: { page: number; top: number; bottom: number }[][] = Array.from(
		{ length: entryCount },
		() => []
	);
	for (const link of read.links) {
		if (!link.url.startsWith(prefix)) continue;
		const entry = Number(link.url.slice(prefix.length).split('/')[0]);
		if (!Number.isInteger(entry) || entry < 0 || entry >= entryCount) continue;
		const [, y1, , y2] = link.rect;
		const top = Math.max(y1, y2);
		const bottom = Math.min(y1, y2);
		// A line of text has height. Chrome also writes an empty rectangle for a
		// link on the page before a forced break, at that page's bottom margin,
		// which read as the entry still starting there: the default layout's
		// first move looked like it changed nothing.
		if (top - bottom < 1) continue;
		boxes[entry].push({ page: link.page, top, bottom });
	}
	const entries = boxes.map((list): EntrySpan | null => {
		if (list.length === 0) return null;
		const first = Math.min(...list.map((b) => b.page));
		const last = Math.max(...list.map((b) => b.page));
		const onFirst = list.filter((b) => b.page === first);
		const head = Math.max(...onFirst.map((b) => b.top)) - Math.min(...onFirst.map((b) => b.bottom));
		return { first, last, head };
	});
	return { pages: read.pages, pageHeight: read.pageHeight, entries };
}

// --- Choosing the moves --------------------------------------------------

const isSplit = (layout: EntryLayout, i: number): boolean => {
	const span = layout.entries[i];
	return !!span && span.last > span.first;
};

const splitCount = (layout: EntryLayout): number =>
	layout.entries.filter((_, i) => isSplit(layout, i)).length;

export interface PagePlan {
	/** The entries that start a page, in document order. */
	starts: number[];
	/** The print with no moves. */
	before: EntryLayout;
	/** The print with `starts` in place. */
	after: EntryLayout;
}

/**
 * The entries to start a new page with, found by printing.
 *
 * Top down, one split entry at a time: an entry is tried when it may move at
 * all, a page break splits it, and the part on the earlier page is small
 * enough. The try is kept when the print has no more pages and fewer split
 * entries than before. If the move splits an entry further down that was
 * whole, that one is tried along with it, so a cascade of moves can still pay
 * off; if it cannot move, neither does the first.
 *
 * `measure` prints with page breaks before exactly the entries it is given.
 */
export async function planPageStarts(
	movable: readonly boolean[],
	measure: (starts: readonly number[]) => Promise<EntryLayout>,
	options: PlanOptions = PLAN_DEFAULTS
): Promise<PagePlan> {
	const before = await measure([]);
	let current = before;
	let starts: number[] = [];
	let trials = 0;
	const tried = new Set<number>();
	const canMove = (layout: EntryLayout, i: number): boolean =>
		!!movable[i] &&
		isSplit(layout, i) &&
		layout.entries[i]!.head <= options.maxHeadShare * layout.pageHeight;

	while (trials < options.maxTrials) {
		const entry = current.entries.findIndex((_, i) => !tried.has(i) && canMove(current, i));
		if (entry < 0) break;
		tried.add(entry);

		let attempt = [...starts, entry];
		let better: EntryLayout | null = null;
		while (trials < options.maxTrials) {
			trials++;
			const trial = await measure(attempt);
			if (trial.pages > current.pages) break;
			const broken = trial.entries.findIndex((_, i) => isSplit(trial, i) && !isSplit(current, i));
			if (broken < 0) {
				if (splitCount(trial) < splitCount(current)) better = trial;
				break;
			}
			if (attempt.includes(broken) || !canMove(trial, broken)) break;
			attempt = [...attempt, broken].sort((a, b) => a - b);
		}
		if (better) {
			starts = attempt;
			current = better;
		}
	}
	return { starts, before, after: current };
}

// --- Driving the page ----------------------------------------------------

/**
 * What this needs of a browser page, rather than a Page type from a package
 * the OSS tree does not depend on directly (see PrintablePage in
 * generate-version-pdfs.ts).
 */
export interface PrintSurface<Settings> {
	evaluate<R, Arg>(fn: (arg: Arg) => R | Promise<R>, arg: Arg): Promise<R>;
	pdf(settings: Settings): Promise<Buffer | Uint8Array>;
}

/**
 * Print the page, first moving any split entry onto the next page where that
 * costs nothing. The page must be settled for print (settleForPrint).
 *
 * One print when nothing is marked or nothing may move; otherwise one to
 * measure, one per move tried, and the one that is kept.
 */
export async function printKeepingEntriesWhole<Settings>(
	page: PrintSurface<Settings>,
	settings: Settings,
	options: PlanOptions = PLAN_DEFAULTS
): Promise<Buffer> {
	const selector = `[${KEEP_WHOLE_ATTRIBUTE}]`;
	let starts: number[] = [];
	let pagesBefore: number | null = null;
	try {
		const movable = await page.evaluate(markEntries, { selector, prefix: MARKER_URL });
		if (movable.some(Boolean)) {
			const plan = await planPageStarts(
				movable,
				async (at) => {
					await page.evaluate(startPagesAt, { selector, starts: [...at] });
					const pdf = await printWithText(page, settings);
					return entryLayout(readPdfLinks(pdf), movable.length);
				},
				options
			);
			if (plan.before.entries.every((span) => span === null)) {
				console.warn('[page-breaks] no marker links read back from the print; nothing moved');
			}
			starts = plan.starts;
			pagesBefore = plan.before.pages;
		}
	} catch (err) {
		console.warn('[page-breaks] could not plan page breaks; printing without moves', err);
		starts = [];
	}

	await page.evaluate(unmarkEntries, null);
	await page.evaluate(startPagesAt, { selector, starts });
	let pdf = await printWithText(page, settings);
	if (starts.length > 0) {
		// The kept print is the first one without marker links. They change
		// nothing on the page, but if this print came out longer anyway, the
		// moves are not what was measured: print as before.
		const pages = pageCountOrNull(pdf);
		if (pages === null || pagesBefore === null || pages > pagesBefore) {
			console.warn(
				`[page-breaks] the kept print has ${pages ?? 'unreadable'} pages against ` +
					`${pagesBefore} measured; printing without moves`
			);
			await page.evaluate(startPagesAt, { selector, starts: [] });
			pdf = await printWithText(page, settings);
		} else {
			console.log(`[page-breaks] started a page at entries ${starts.join(', ')} (${pages} pages)`);
		}
	}
	return pdf;
}

/**
 * Print, and print again when the PDF came out with no font in it.
 *
 * On dev, Chrome fetches the template's web fonts anew for every print, since
 * Vite serves static files `no-cache`, and now and then lays the page out
 * before they are back. With `font-display: block` that print draws no text at
 * all, and lays it out in the fallback font's metrics, so it also runs a page
 * longer. Measured 2026-11-03 on the Citrus CV: about one print in six, none
 * of them the first after the page loaded, while a production build (preview)
 * refetched nothing and printed 24 of 24 with text. The export used to print
 * once, and none of the 400 PDFs it stored on dev in the two months before had
 * come out blank; this file prints several times, so it checks. A document
 * always has text, so a PDF without a font is never measured or kept.
 */
export async function printWithText<Settings>(
	page: Pick<PrintSurface<Settings>, 'pdf'>,
	settings: Settings,
	attempts = 4
): Promise<Buffer> {
	let pdf = Buffer.from(await page.pdf(settings));
	for (let attempt = 1; attempt < attempts && !hasFont(pdf); attempt++) {
		console.warn('[page-breaks] a print came out without any text; printing again');
		pdf = Buffer.from(await page.pdf(settings));
	}
	return pdf;
}

function hasFont(pdf: Buffer): boolean {
	return /\/Type\s*\/Font\b/.test(pdf.toString('latin1'));
}

// The three below run in the browser: serialised as they stand, so they use
// nothing from this module and declare no named functions inside (a bundler's
// name helper would not exist there).

/**
 * Wrap each text of each entry in a marker link naming the entry, and answer
 * per entry whether it may start a page: whether the element before it,
 * skipping a rule, is an entry too.
 */
function markEntries({ selector, prefix }: { selector: string; prefix: string }): boolean[] {
	const entries = Array.from(document.querySelectorAll(selector));
	return entries.map((entry, i) => {
		const walker = document.createTreeWalker(entry, NodeFilter.SHOW_TEXT);
		const texts: Text[] = [];
		while (walker.nextNode()) {
			const text = walker.currentNode as Text;
			// Text that is already a link keeps its own; the rest of the entry marks it.
			if (text.data.trim() && !text.parentElement?.closest('a')) texts.push(text);
		}
		texts.forEach((text, k) => {
			const link = document.createElement('a');
			link.href = `${prefix}${i}/${k}`;
			link.setAttribute('data-keep-whole-marker', '');
			// Lays out exactly as the bare text did: no colour, underline or box.
			link.style.setProperty('all', 'unset');
			text.before(link);
			link.append(text);
		});
		let before = entry.previousElementSibling;
		while (before && before.tagName === 'HR') before = before.previousElementSibling;
		return !!before && before.matches(selector);
	});
}

/**
 * Put a page break before exactly these entries, and hide the rule that would
 * otherwise end the page before each.
 */
function startPagesAt({ selector, starts }: { selector: string; starts: number[] }): void {
	Array.from(document.querySelectorAll<HTMLElement>(selector)).forEach((entry, i) => {
		const on = starts.includes(i);
		entry.style.breakBefore = on ? 'page' : '';
		const before = entry.previousElementSibling;
		if (before instanceof HTMLHRElement) before.style.display = on ? 'none' : '';
	});
}

/** Take the marker links out, each text back where it was. */
function unmarkEntries(): void {
	document.querySelectorAll('a[data-keep-whole-marker]').forEach((link) => {
		link.replaceWith(...Array.from(link.childNodes));
	});
}
