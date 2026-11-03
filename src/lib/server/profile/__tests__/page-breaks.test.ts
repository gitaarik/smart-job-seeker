/**
 * Moving a split entry onto the next page, decided by printing.
 *
 * The case it was written for, the Citrus resume of 2026-11-03: the second
 * role opened at the foot of page 1 with its lead and one bullet, the third was
 * split over pages 2 and 3, and page 3 had room to spare. Moving the second role
 * keeps it whole and costs nothing; keeping every role whole the way CSS would
 * (`break-inside: avoid`) moves the third as well, which there left a third of
 * page 2 empty, and on a fuller document costs a page.
 */
import { describe, expect, it } from 'vitest';
import {
	MARKER_URL,
	entryLayout,
	planPageStarts,
	printKeepingEntriesWhole,
	printWithText,
	readPdfLinks,
	type EntryLayout,
	type EntrySpan
} from '../page-breaks';

// --- A PDF the way Chrome writes one ---------------------------------------

type Link = { url: string; rect: [number, number, number, number] };

/** Objects by number, a classic cross-reference table, a trailer. */
function assemble(bodies: Map<number, string>): Buffer {
	let out = '%PDF-1.4\n%\xe2\xe3\xcf\xd3\n';
	const offsets: number[] = [];
	const max = Math.max(...bodies.keys());
	for (let n = 1; n <= max; n++) {
		offsets[n] = out.length;
		out += `${n} 0 obj\n${bodies.get(n) ?? 'null'}\nendobj\n`;
	}
	const xref = out.length;
	out += `xref\n0 ${max + 1}\n0000000000 65535 f \n`;
	for (let n = 1; n <= max; n++) out += `${String(offsets[n]).padStart(10, '0')} 00000 n \n`;
	out += `trailer\n<</Size ${max + 1} /Root 1 0 R>>\nstartxref\n${xref}\n%%EOF\n`;
	return Buffer.from(out, 'latin1');
}

/**
 * One page per list, each link an annotation on its page; `nested` puts the
 * pages under a second tree node, and `text: false` leaves out the font, as a
 * print that drew no text does.
 */
function pdfWith(pages: Link[][], { nested = false, text = true } = {}): Buffer {
	const bodies = new Map<number, string>();
	let next = 4;
	if (text) {
		bodies.set(next++, '<</Type /Font\n/Subtype /Type0\n/BaseFont /AAAAAA+Carlito-Regular>>');
	}
	const pageRefs = pages.map((links) => {
		const annots = links.map((link) => {
			const n = next++;
			bodies.set(
				n,
				`<</Type /Annot\n/Subtype /Link\n/F 4\n/Border [0 0 0]\n/Rect [${link.rect.join(' ')}]\n` +
					`/A <</Type /Action\n/S /URI\n/URI (${link.url})>>>>`
			);
			return `${n} 0 R`;
		});
		const n = next++;
		bodies.set(
			n,
			`<</Type /Page\n/Parent ${nested ? 3 : 2} 0 R\n/MediaBox [0 0 595.91998 842.88]\n/Annots [${annots.join(' ')}]>>`
		);
		return `${n} 0 R`;
	});
	bodies.set(1, '<</Type /Catalog\n/Pages 2 0 R>>');
	if (nested) {
		bodies.set(2, `<</Type /Pages\n/Count ${pages.length}\n/Kids [3 0 R]>>`);
		bodies.set(
			3,
			`<</Type /Pages\n/Parent 2 0 R\n/Count ${pages.length}\n/Kids [${pageRefs.join(' ')}]>>`
		);
	} else {
		bodies.set(2, `<</Type /Pages\n/Count ${pages.length}\n/Kids [${pageRefs.join(' ')}]>>`);
	}
	return assemble(bodies);
}

const at = (url: string, top: number, bottom = top - 12): Link => ({
	url,
	rect: [40, bottom, 300, top]
});

describe('readPdfLinks', () => {
	it('reads every link with the page it is on and its rectangle', () => {
		const read = readPdfLinks(
			pdfWith([
				[at('https://a.invalid/0/0', 700), at('https://a.invalid/0/1', 680)],
				[at('https://b.invalid/', 800)]
			])
		);
		expect(read.pages).toBe(2);
		expect(read.pageHeight).toBeCloseTo(842.88);
		expect(read.links).toEqual([
			{ page: 1, url: 'https://a.invalid/0/0', rect: [40, 688, 300, 700] },
			{ page: 1, url: 'https://a.invalid/0/1', rect: [40, 668, 300, 680] },
			{ page: 2, url: 'https://b.invalid/', rect: [40, 788, 300, 800] }
		]);
	});

	it('counts a page with no links, and keeps the order of a nested page tree', () => {
		const read = readPdfLinks(pdfWith([[], [at('https://x.invalid/', 500)], []], { nested: true }));
		expect(read.pages).toBe(3);
		expect(read.links.map((l) => l.page)).toEqual([2]);
	});

	it('skips annotations that are not links', () => {
		const bodies = new Map<number, string>([
			[1, '<</Type /Catalog /Pages 2 0 R>>'],
			[2, '<</Type /Pages /Count 1 /Kids [3 0 R]>>'],
			[3, '<</Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Annots [4 0 R]>>'],
			[4, '<</Type /Annot /Subtype /Widget /Rect [0 0 10 10]>>']
		]);
		expect(readPdfLinks(assemble(bodies)).links).toEqual([]);
	});

	it('refuses a PDF it cannot read rather than guessing', () => {
		expect(() => readPdfLinks(Buffer.from('not a pdf'))).toThrow();
		// A cross-reference stream: startxref points at an object, not a table.
		expect(() =>
			readPdfLinks(Buffer.from('%PDF-1.7\n1 0 obj\n<<>>\nendobj\nstartxref\n9\n%%EOF'))
		).toThrow();
	});
});

describe('entryLayout', () => {
	it('gives each entry its first and last page and how much of the first page it holds', () => {
		const layout = entryLayout(
			{
				pages: 2,
				pageHeight: 842,
				links: [
					{ page: 1, url: `${MARKER_URL}0/0`, rect: [0, 690, 100, 700] },
					{ page: 1, url: `${MARKER_URL}1/0`, rect: [0, 110, 100, 120] },
					{ page: 1, url: `${MARKER_URL}1/1`, rect: [0, 60, 100, 72] },
					{ page: 2, url: `${MARKER_URL}1/2`, rect: [0, 780, 100, 792] },
					// Not a marker, and a marker naming no entry: both ignored.
					{ page: 2, url: 'https://github.com/gitaarik', rect: [0, 0, 100, 10] },
					{ page: 2, url: `${MARKER_URL}7/0`, rect: [0, 0, 100, 10] }
				]
			},
			3
		);
		expect(layout.pages).toBe(2);
		expect(layout.entries).toEqual([
			{ first: 1, last: 1, head: 10 },
			{ first: 1, last: 2, head: 60 },
			null
		]);
	});

	it('ignores the empty rectangle Chrome leaves on the page before a forced break', () => {
		const layout = entryLayout(
			{
				pages: 2,
				pageHeight: 842,
				links: [
					{ page: 1, url: `${MARKER_URL}0/0`, rect: [28, 28, 310, 28] },
					{ page: 2, url: `${MARKER_URL}0/0`, rect: [28, 803, 310, 815] }
				]
			},
			1
		);
		expect(layout.entries).toEqual([{ first: 2, last: 2, head: 12 }]);
	});
});

// --- Choosing the moves ----------------------------------------------------

const H = 800;
const span = (first: number, last = first, headShare = 0.1): EntrySpan => ({
	first,
	last,
	head: headShare * H
});
const layout = (pages: number, ...entries: (EntrySpan | null)[]): EntryLayout => ({
	pages,
	pageHeight: H,
	entries
});

/** A print per set of moves, as scripted; asking for one not scripted fails the test. */
function prints(table: Record<string, EntryLayout>) {
	const asked: string[] = [];
	const measure = async (starts: readonly number[]) => {
		const key = starts.join(',');
		asked.push(key);
		const found = table[key];
		if (!found) throw new Error(`no print scripted for [${key}]`);
		return found;
	};
	return { measure, asked };
}

const ALL_BUT_FIRST = [false, true, true, true, true, true];

describe('planPageStarts', () => {
	it('moves a role that opens at the foot of a page, and leaves the half-and-half one split', async () => {
		const { measure, asked } = prints({
			'': layout(3, span(1), span(1, 2, 0.1), span(2, 3, 0.35), span(3), span(3)),
			'1': layout(3, span(1), span(2), span(2, 3, 0.23), span(3), span(3))
		});
		const plan = await planPageStarts(ALL_BUT_FIRST, measure);
		expect(plan.starts).toEqual([1]);
		expect(plan.after.entries[1]).toEqual(span(2));
		expect(asked).toEqual(['', '1']);
	});

	it('keeps the split when moving would cost a page', async () => {
		const { measure, asked } = prints({
			'': layout(2, span(1), span(1, 2), span(2)),
			'1': layout(3, span(1), span(2), span(2, 3))
		});
		expect((await planPageStarts(ALL_BUT_FIRST, measure)).starts).toEqual([]);
		expect(asked).toEqual(['', '1']);
	});

	it('does not try a role that would leave too much of its page empty', async () => {
		const { measure, asked } = prints({ '': layout(2, span(1), span(1, 2, 0.4), span(2)) });
		expect((await planPageStarts(ALL_BUT_FIRST, measure)).starts).toEqual([]);
		expect(asked).toEqual(['']);
	});

	it('never moves the first entry under a heading', async () => {
		const { measure, asked } = prints({ '': layout(2, span(1, 2), span(2)) });
		expect((await planPageStarts(ALL_BUT_FIRST, measure)).starts).toEqual([]);
		expect(asked).toEqual(['']);
	});

	it('keeps the split when the role is still split on its new page', async () => {
		const { measure } = prints({
			'': layout(3, span(1), span(1, 2, 0.05), span(3)),
			'1': layout(3, span(1), span(2, 3, 0.9), span(3))
		});
		expect((await planPageStarts(ALL_BUT_FIRST, measure)).starts).toEqual([]);
	});

	it('moves the role a move split as well, when that one can move', async () => {
		const { measure, asked } = prints({
			'': layout(3, span(1), span(1, 2, 0.1), span(2), span(2), span(3)),
			'1': layout(3, span(1), span(2), span(2), span(2, 3, 0.05), span(3)),
			'1,3': layout(3, span(1), span(2), span(2), span(3), span(3))
		});
		expect((await planPageStarts(ALL_BUT_FIRST, measure)).starts).toEqual([1, 3]);
		expect(asked).toEqual(['', '1', '1,3']);
	});

	it('keeps the first split when the role the move would split cannot move', async () => {
		const { measure, asked } = prints({
			'': layout(3, span(1), span(1, 2, 0.1), span(2), span(2), span(3)),
			'1': layout(3, span(1), span(2), span(2), span(2, 3, 0.6), span(3))
		});
		expect((await planPageStarts(ALL_BUT_FIRST, measure)).starts).toEqual([]);
		expect(asked).toEqual(['', '1']);
	});

	it('tries the next split role against the pages the last move left', async () => {
		const { measure, asked } = prints({
			'': layout(4, span(1), span(1, 2, 0.1), span(2), span(2, 3, 0.4), span(4)),
			'1': layout(4, span(1), span(2), span(2), span(2, 3, 0.1), span(4)),
			'1,3': layout(4, span(1), span(2), span(2), span(3), span(4))
		});
		expect((await planPageStarts(ALL_BUT_FIRST, measure)).starts).toEqual([1, 3]);
		expect(asked).toEqual(['', '1', '1,3']);
	});

	it('stops after its last test print', async () => {
		const { measure, asked } = prints({
			'': layout(3, span(1), span(1, 2), span(2, 3)),
			'1': layout(4, span(1), span(2), span(3, 4))
		});
		const plan = await planPageStarts(ALL_BUT_FIRST, measure, { maxHeadShare: 0.25, maxTrials: 1 });
		expect(plan.starts).toEqual([]);
		expect(asked).toEqual(['', '1']);
	});
});

// --- Driving the page ------------------------------------------------------

/** What an unreadable print looks like: it has text, so it is not printed again. */
const UNREADABLE = '/Type /Font, and nothing else of a PDF';

/**
 * A page that prints the scripted layout for the breaks set on it: with a
 * marker link on each page an entry touches while marked, without any after.
 * The prints numbered in `textless` (from 1) draw no text.
 */
function fakePage(
	movable: boolean[],
	layouts: Record<string, EntryLayout>,
	{ cleanPages, textless = [] }: { cleanPages?: number; textless?: number[] } = {}
) {
	const state = { marked: false, starts: [] as number[], prints: [] as string[] };
	const page = {
		async evaluate<R, Arg>(fn: (arg: Arg) => R | Promise<R>, arg: Arg): Promise<R> {
			if (fn.name === 'markEntries') {
				state.marked = true;
				return movable as R;
			}
			if (fn.name === 'unmarkEntries') state.marked = false;
			else if (fn.name === 'startPagesAt') state.starts = [...(arg as { starts: number[] }).starts];
			else throw new Error(`unexpected page function ${fn.name}`);
			return undefined as R;
		},
		async pdf(): Promise<Buffer> {
			const key = state.starts.join(',');
			state.prints.push(`${state.marked ? 'marked' : 'clean'}:${key}`);
			const text = !textless.includes(state.prints.length);
			const scripted = layouts[key];
			if (!scripted) return Buffer.from(UNREADABLE);
			const pages: Link[][] = Array.from({ length: scripted.pages }, () => []);
			if (state.marked) {
				scripted.entries.forEach((entry, i) => {
					if (!entry) return;
					pages[entry.first - 1].push(at(`${MARKER_URL}${i}/0`, 700, 700 - entry.head));
					if (entry.last > entry.first) pages[entry.last - 1].push(at(`${MARKER_URL}${i}/1`, 780));
				});
			} else if (cleanPages !== undefined) {
				return pdfWith(
					Array.from({ length: cleanPages }, () => []),
					{ text }
				);
			}
			return pdfWith(pages, { text });
		}
	};
	return { page, state };
}

const SETTINGS = { format: 'A4' };

describe('printKeepingEntriesWhole', () => {
	const citrus = {
		'': layout(3, span(1), span(1, 2, 0.1), span(2, 3, 0.35), span(3)),
		'1': layout(3, span(1), span(2), span(2, 3, 0.23), span(3))
	};

	it('measures, tries the move, and keeps a print without the marker links', async () => {
		const { page, state } = fakePage([false, true, true, true], citrus);
		const pdf = await printKeepingEntriesWhole(page, SETTINGS);
		expect(state.prints).toEqual(['marked:', 'marked:1', 'clean:1']);
		expect(readPdfLinks(pdf)).toMatchObject({ pages: 3, links: [] });
	});

	it('prints once when no entry may move', async () => {
		const { page, state } = fakePage([false], { '': layout(1, span(1)) });
		await printKeepingEntriesWhole(page, SETTINGS);
		expect(state.prints).toEqual(['clean:']);
	});

	it('prints as before when the measuring print cannot be read', async () => {
		const { page, state } = fakePage([false, true], {});
		const pdf = await printKeepingEntriesWhole(page, SETTINGS);
		expect(state.prints).toEqual(['marked:', 'clean:']);
		expect(pdf.toString()).toBe(UNREADABLE);
	});

	it('prints as before when the kept print comes out longer than the measured one', async () => {
		const { page, state } = fakePage([false, true, true, true], citrus, { cleanPages: 4 });
		await printKeepingEntriesWhole(page, SETTINGS);
		expect(state.prints).toEqual(['marked:', 'marked:1', 'clean:1', 'clean:']);
		expect(state.starts).toEqual([]);
	});

	it('neither measures nor keeps a print that drew no text', async () => {
		// The try and the kept print each come out blank once, as dev's refetched
		// fonts made them (printWithText); each is printed again, and the move holds.
		const { page, state } = fakePage([false, true, true, true], citrus, { textless: [2, 4] });
		const pdf = await printKeepingEntriesWhole(page, SETTINGS);
		expect(state.prints).toEqual(['marked:', 'marked:1', 'marked:1', 'clean:1', 'clean:1']);
		expect(state.starts).toEqual([1]);
		expect(pdf.toString('latin1')).toMatch(/\/Type \/Font/);
	});
});

describe('printWithText', () => {
	const blank = pdfWith([[]], { text: false });
	const page = (prints: Buffer[]) => {
		let n = 0;
		return { calls: () => n, pdf: async () => prints[Math.min(n++, prints.length - 1)] };
	};

	it('keeps the first print that has text', async () => {
		const good = pdfWith([[]]);
		const p = page([blank, blank, good]);
		expect(await printWithText(p, SETTINGS)).toEqual(good);
		expect(p.calls()).toBe(3);
	});

	it('gives up after its last attempt rather than printing forever', async () => {
		const p = page([blank]);
		expect(await printWithText(p, SETTINGS, 3)).toEqual(blank);
		expect(p.calls()).toBe(3);
	});
});
