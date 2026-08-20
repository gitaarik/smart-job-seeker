/**
 * The index of everything recorded, across every application.
 *
 * Its whole job is to make "I was not given this" distinguishable from "this
 * does not exist", so what matters is that every application survives trimming
 * and that the block says what it is. A manifest that silently drops an
 * application is worse than no manifest: it reproduces the failure it exists to
 * remove, one level up.
 */
import { describe, expect, it } from 'vitest';
import {
	DOCUMENT_MANIFEST_BUDGET_CHARS,
	formatActivityManifest,
	MANIFEST_BUDGET_CHARS,
	type ManifestApplication,
	type ManifestEntry
} from '../activity-manifest';

function entry(over: Partial<ManifestEntry> = {}): ManifestEntry {
	return {
		id: 1,
		record_type: 'transcript',
		title: 'A call',
		event_date: '2026-08-01',
		chars: 1200,
		...over
	};
}

function app(over: Partial<ManifestApplication> = {}): ManifestApplication {
	return {
		id: 10,
		company: 'Acme',
		position: 'Backend Engineer',
		status: 'applied',
		isCurrent: false,
		entries: [entry()],
		...over
	};
}

describe('formatActivityManifest', () => {
	it('returns empty string when there are no applications at all', () => {
		expect(formatActivityManifest([])).toBe('');
	});

	it('lists an application that has nothing recorded', () => {
		// The most important row in the whole block: without it, an application
		// with no history is indistinguishable from one the index forgot.
		const out = formatActivityManifest([app({ entries: [] })]);

		expect(out).toContain('Backend Engineer at Acme');
		expect(out).toContain('nothing recorded yet');
	});

	it('gives each entry an id, a type, a date and a size', () => {
		const out = formatActivityManifest([
			app({
				entries: [
					entry({
						id: 45,
						record_type: 'transcript',
						title: 'QA follow-up call',
						event_date: '2026-08-04',
						chars: 29163
					})
				]
			})
		]);

		expect(out).toContain('#45');
		expect(out).toContain('Transcript');
		expect(out).toContain('QA follow-up call');
		expect(out).toContain('2026-08-04');
		expect(out).toContain('29163 chars');
	});

	it('marks the application the page is about', () => {
		const out = formatActivityManifest([
			app({ id: 27, isCurrent: true }),
			app({ id: 28, company: 'Northwind' })
		]);

		expect(out).toMatch(/application 27\) — the one on screen/);
		expect(out).not.toMatch(/application 28\) — the one on screen/);
	});

	it('tells the model the index is not the contents', () => {
		const out = formatActivityManifest([app()]);
		expect(out).toContain('An index, not the contents');
		expect(out).toContain('offer to go through it');
	});

	// Both blocks describe the same applications; two spellings of one reads as
	// two. Caught live: the assistant reported a transcript as belonging to
	// "another Senior Backend Engineer position" — a second application that did
	// not exist.
	it('names an application exactly as the pipeline block names it', () => {
		const out = formatActivityManifest([
			app({ id: 16, company: null, position: 'Senior Backend Engineer' })
		]);

		expect(out).toContain('Senior Backend Engineer (application 16)');
	});

	it('survives an application with no company or position', () => {
		const out = formatActivityManifest([app({ company: null, position: null })]);
		expect(out).toContain('Untitled application');
	});

	it('survives an entry with no title', () => {
		const out = formatActivityManifest([app({ entries: [entry({ title: null })] })]);
		expect(out).toContain('Untitled');
	});

	describe('trimming', () => {
		const many = (n: number, appId: number) =>
			app({
				id: appId,
				company: `Company ${appId}`,
				entries: Array.from({ length: n }, (_, i) =>
					entry({ id: appId * 100 + i, title: `Entry ${appId}-${i}` })
				)
			});

		it('keeps every application, however tight the budget', () => {
			const apps = [many(40, 1), many(40, 2), many(40, 3)];

			const out = formatActivityManifest(apps, 800);

			// Every application is still named. Losing one would recreate the exact
			// blind spot this block exists to remove.
			expect(out).toContain('Company 1');
			expect(out).toContain('Company 2');
			expect(out).toContain('Company 3');
		});

		it('drops the oldest entries of the busiest application first', () => {
			const apps = [many(30, 1), many(2, 2)];

			const out = formatActivityManifest(apps, 1200);

			// The small application keeps everything; the big one loses its oldest.
			expect(out).toContain('Entry 2-0');
			expect(out).toContain('Entry 2-1');
			expect(out).not.toContain('Entry 1-0');
			expect(out).toContain('Entry 1-29');
		});

		it('says so when it trimmed', () => {
			const out = formatActivityManifest([many(40, 1)], 700);

			expect(out).toMatch(/older entry\(s\) are missing from this index/);
			expect(out).toContain('Every application is listed');
		});

		it('says nothing about trimming when everything fits', () => {
			const out = formatActivityManifest([app()]);

			expect(out).not.toContain('missing from this index');
		});

		it('does not spin forever when one entry alone exceeds the budget', () => {
			// Never drops the last entry of an application, so the loop has to give
			// up rather than trim to nothing.
			const out = formatActivityManifest([app({ entries: [entry()] })], 10);

			expect(out).toContain('Acme');
		});
	});
});

describe('documents in the index', () => {
	/**
	 * A profile document reaches a prompt only through retrieval, so "nothing was
	 * retrieved" and "no such document" look identical from inside the model —
	 * the same confusion the applications half of this block exists to remove.
	 */
	const DOC = {
		id: 14,
		kind: 'archive',
		title: 'Recent AI achievements.zip',
		fileCount: 41,
		chars: 4538182,
		summarised: true
	};

	it('lists a document with its size and whether it has a summary', () => {
		const out = formatActivityManifest([], MANIFEST_BUDGET_CHARS, [DOC]);

		expect(out).toContain('#14');
		expect(out).toContain('Recent AI achievements.zip');
		expect(out).toContain('41 files');
		// The summary is the cheap way in to 4.5M characters, so the model is told
		// one exists rather than being left to ask for the text.
		expect(out).toContain('summarised');
	});

	it('tells the model what to say when a document holds the answer', () => {
		const out = formatActivityManifest([], MANIFEST_BUDGET_CHARS, [DOC]);
		expect(out).toContain('say which document you would need');
	});

	it('renders for a profile with documents and no applications at all', () => {
		// Applications used to be the only reason this block existed, so an empty
		// list short-circuited the whole thing — which would now hide the documents.
		expect(formatActivityManifest([], MANIFEST_BUDGET_CHARS, [DOC])).not.toBe('');
	});

	it('stays empty when there is neither', () => {
		expect(formatActivityManifest([], MANIFEST_BUDGET_CHARS, [])).toBe('');
	});

	it('trims documents on their own budget, saying how many it dropped', () => {
		// Separate budgets so neither half can starve the other: forty documents
		// must not push an application out of the index, or the reverse.
		const many = Array.from({ length: 60 }, (_, i) => ({ ...DOC, id: i + 1 }));
		const out = formatActivityManifest([], MANIFEST_BUDGET_CHARS, many);

		expect(out).toContain('more not listed');
		expect(out.length).toBeLessThan(MANIFEST_BUDGET_CHARS + DOCUMENT_MANIFEST_BUDGET_CHARS + 800);
	});
});
