/**
 * The summariser's two trust boundaries: what counts as a change worth paying
 * to regenerate, and what counts as an actual offer.
 *
 * The second matters more than it looks. The spine shouts "OFFER RECORDED" and
 * quotes terms verbatim, so an offer conjured out of a recruiter mentioning a
 * salary range would be a confident lie about the highest-stakes fact in the
 * product.
 */
import { describe, expect, it } from 'vitest';
import {
	coerceOffer,
	CONTRACT_PREFIX,
	isCurrentContract,
	renderSourceEntries,
	summaryHash,
	type SummarySource
} from '../application-summary';

function entry(over: Partial<SummarySource> = {}): SummarySource {
	return {
		id: 1,
		record_type: 'message',
		title: 'Re: scheduling',
		content: 'Tuesday at 14:00 works.',
		event_date: '2026-07-28',
		digest: null,
		...over
	};
}

const rendered = (entries: SummarySource[]) => renderSourceEntries(entries).text;

describe('summaryHash', () => {
	it('is stable for identical input', () => {
		expect(summaryHash(rendered([entry()]))).toBe(summaryHash(rendered([entry()])));
	});

	it.each([
		['content', { content: 'Wednesday instead.' }],
		['title', { title: 'Re: rescheduling' }],
		['type', { record_type: 'feedback' }],
		['date', { event_date: '2026-07-29' }]
	])('changes when the %s changes', (_name, over) => {
		expect(summaryHash(rendered([entry(over)]))).not.toBe(summaryHash(rendered([entry()])));
	});

	it('changes when an entry is added or removed', () => {
		const one = summaryHash(rendered([entry()]));
		const two = summaryHash(rendered([entry(), entry({ id: 2 })]));
		expect(one).not.toBe(two);
		expect(summaryHash(rendered([]))).not.toBe(one);
	});

	// The hash must not cover anything this pass itself writes, or every summary
	// is permanently stale and regenerates forever. Over the rendered text, that
	// holds by construction: nothing unrendered can reach it.
	it('ignores fields the summariser never reads', () => {
		const withExtra = {
			...entry(),
			date_updated: new Date(),
			derived_at: new Date()
		} as SummarySource;
		expect(summaryHash(rendered([withExtra]))).toBe(summaryHash(rendered([entry()])));
	});

	// The case the row-based hash could not see: the entry is unchanged, what
	// the summariser reads of it is not.
	it('changes when a long entry gains its digest', () => {
		const long = entry({ content: 'x'.repeat(5000) });
		const digested = { ...long, digest: { gist: 'A long thread.', facts: [] } };
		expect(summaryHash(rendered([digested]))).not.toBe(summaryHash(rendered([long])));
	});
});

/**
 * The gate has to notice two different kinds of staleness, and only ever
 * noticed one. When the summariser learned to extract `context_details`, every
 * application already summarised kept a hash that still matched its unchanged
 * entries — so the write path skipped them and the backfill, selecting on
 * `hash IS NULL`, skipped them too. The feature shipped to nothing.
 */
describe('contract versioning', () => {
	it('stamps the contract version on every hash', () => {
		expect(summaryHash(rendered([entry()])).startsWith(CONTRACT_PREFIX)).toBe(true);
	});

	it('treats a hash from an older summariser as not current', () => {
		// What the column held before versioning: bare hex, no prefix.
		expect(isCurrentContract('a'.repeat(64))).toBe(false);
		expect(isCurrentContract('v1:' + 'a'.repeat(64))).toBe(false);
		expect(isCurrentContract('v3:' + 'a'.repeat(64))).toBe(false);
		expect(isCurrentContract(null)).toBe(false);
		expect(isCurrentContract('')).toBe(false);
	});

	it('treats a hash it just wrote as current', () => {
		expect(isCurrentContract(summaryHash(rendered([entry()])))).toBe(true);
	});

	it('still distinguishes entries within one contract version', () => {
		// The prefix must not swallow the original signal.
		const a = summaryHash(rendered([entry()]));
		const b = summaryHash(rendered([entry({ content: 'Wednesday instead.' })]));
		expect(a).not.toBe(b);
		expect(isCurrentContract(a) && isCurrentContract(b)).toBe(true);
	});
});

describe('coerceOffer', () => {
	const full = {
		base: 92000,
		bonus: '10%',
		equity: '0.15%',
		currency: 'eur',
		period: 'Year',
		start_date: '2026-09-01',
		respond_by: '2026-08-15',
		notes: '27 days leave'
	};

	it('takes a complete offer, normalising currency and period', () => {
		const out = coerceOffer(full)!;
		expect(out.base).toBe(92000);
		expect(out.currency).toBe('EUR');
		expect(out.period).toBe('year');
		expect(out.respond_by).toBe('2026-08-15');
	});

	it('treats an absent offer as no offer', () => {
		expect(coerceOffer(null)).toBeNull();
		expect(coerceOffer(undefined)).toBeNull();
		expect(coerceOffer('no offer yet')).toBeNull();
	});

	// The failure this exists to stop: the spine announcing OFFER RECORDED for
	// an expression of interest, because the model filled in a currency and
	// nothing else.
	it('rejects an offer carrying no substantive term', () => {
		expect(coerceOffer({ currency: 'EUR', period: 'year' })).toBeNull();
		expect(coerceOffer({})).toBeNull();
	});

	it('accepts an offer that has only a deadline', () => {
		// Terms unstated but a decision is due — the most actionable case there is.
		const out = coerceOffer({ respond_by: '2026-08-15' });
		expect(out).not.toBeNull();
		expect(out!.respond_by).toBe('2026-08-15');
		expect(out!.base).toBeNull();
	});

	// Measured against the real model: it returned `equity: 0.15` where the
	// schema demanded a string, and a strict wire type failed the WHOLE parse —
	// losing the summary and the response deadline along with the equity.
	it('accepts a number where the model should have sent a string', () => {
		const out = coerceOffer({ base: 92000, equity: 0.15, bonus: 10 })!;
		expect(out.equity).toBe('0.15');
		expect(out.bonus).toBe('10');
	});

	it('parses a base sent as a formatted string', () => {
		expect(coerceOffer({ base: '92,000' })!.base).toBe(92000);
		expect(coerceOffer({ base: '92000' })!.base).toBe(92000);
	});

	it('refuses a base that is not a usable number', () => {
		expect(coerceOffer({ base: 'ninety-two thousand', notes: 'x' })!.base).toBeNull();
		expect(coerceOffer({ base: 0, notes: 'x' })!.base).toBeNull();
		expect(coerceOffer({ base: -5, notes: 'x' })!.base).toBeNull();
	});

	it('refuses a date that is not plain YYYY-MM-DD', () => {
		const out = coerceOffer({
			base: 1,
			respond_by: 'next Friday',
			start_date: '01-09-2026'
		})!;
		expect(out.respond_by).toBeNull();
		expect(out.start_date).toBeNull();
	});
});

describe('renderSourceEntries', () => {
	it('renders a readable chronology with type, title and date', () => {
		const { text: out } = renderSourceEntries([
			entry({ id: 1, title: 'First' }),
			entry({ id: 2, title: 'Second', record_type: 'offer' })
		]);
		expect(out).toContain('Message: First');
		expect(out).toContain('Offer: Second');
		expect(out).toContain('Date: 2026-07-28');
		expect(out.indexOf('First')).toBeLessThan(out.indexOf('Second'));
	});

	// Detail provenance rests entirely on this: without an id in the heading the
	// model has nothing to cite, and coerceDetails drops every citation it
	// cannot match back to an entry that was actually shown.
	it('names each entry by id so an extracted detail can cite it', () => {
		const { text: out, shownIds } = renderSourceEntries([
			entry({ id: 41, title: 'First' }),
			entry({ id: 42, title: 'Second' })
		]);
		expect(out).toContain('[entry 41]');
		expect(out).toContain('[entry 42]');
		expect(shownIds).toEqual([41, 42]);
	});

	it('shows a short entry whole', () => {
		const note = 'Walk away below EUR 7,000 a month; serious from 7,500, wins from 8,500.';
		const { text } = renderSourceEntries([entry({ record_type: 'note', content: note })]);
		expect(text).toContain(note);
	});

	it('shows a long entry through its digest, not its text', () => {
		const { text } = renderSourceEntries([
			entry({
				id: 7,
				record_type: 'transcript',
				content: 'SPEAKER_00: hello. '.repeat(1000),
				digest: {
					gist: 'Intro call with the recruiter.',
					facts: [{ category: 'logistics', label: 'Next round', value: 'With the CTO' }]
				}
			})
		]);
		expect(text).toContain('Shown as its digest');
		expect(text).toContain('What it is: Intro call with the recruiter.');
		expect(text).toContain('- Next round [logistics]: With the CTO');
		expect(text).not.toContain('SPEAKER_00');
	});

	// Without a digest (a failed call, a backlog) the text is cut, and says so:
	// a cut that reads as a complete entry is how a missing answer becomes a
	// confident "they never said".
	it('shows a long entry with no digest as a marked excerpt', () => {
		const long = 'a'.repeat(3000) + 'MIDDLE' + 'z'.repeat(3000);
		const { text } = renderSourceEntries([entry({ content: long })]);
		expect(text).toMatch(/Shown: \d+ of 6006 characters\. The middle is cut\./);
		expect(text).not.toContain('MIDDLE');
		expect(text.startsWith('### [entry 1]')).toBe(true);
	});

	// The failure this replaced: a history cut at a fixed length from the
	// start, which kept the opening weeks, dropped everything recent and told
	// the model nothing. Now the OLDEST shrink first, and a note says so.
	it('shortens the oldest entries first to fit, and says how many', () => {
		const entries = Array.from({ length: 6 }, (_, i) =>
			entry({ id: i + 1, title: `Entry ${i + 1}`, content: `${i + 1}`.repeat(1400) })
		);
		const out = renderSourceEntries(entries, 6000);
		expect(out.shortened + out.omitted).toBeGreaterThan(0);
		expect(out.text).toMatch(/^NOTE: this history is longer than can be shown in full\./);
		// The newest entry is still whole.
		expect(out.text).toContain('6'.repeat(1400));
		// The oldest is not.
		expect(out.text).not.toContain('1'.repeat(1400));
		expect(out.text.length).toBeLessThanOrEqual(6000 + 400);
	});

	it('leaves the oldest out when shortening is not enough, and never cites them', () => {
		const entries = Array.from({ length: 30 }, (_, i) =>
			entry({ id: i + 1, content: 'x'.repeat(1400) })
		);
		const out = renderSourceEntries(entries, 3000);
		expect(out.omitted).toBeGreaterThan(0);
		expect(out.shownIds).not.toContain(1);
		expect(out.shownIds).toContain(30);
		expect(out.text).toContain(`The ${out.omitted} oldest entries are left out`);
	});

	// Notes are where the applicant's own decisions live, and nothing else
	// records them. They go last.
	it('keeps an old note whole while shortening the documents around it', () => {
		const note = entry({ id: 1, record_type: 'note', content: 'Floor: EUR 7,500 a month.' });
		const docs = Array.from({ length: 5 }, (_, i) =>
			entry({ id: i + 2, record_type: 'message', content: 'm'.repeat(1400) })
		);
		const out = renderSourceEntries([note, ...docs], 4000);
		expect(out.text).toContain('Floor: EUR 7,500 a month.');
		expect(out.shortened).toBeGreaterThan(0);
	});

	it('renders nothing extra when everything fits', () => {
		const out = renderSourceEntries([entry()]);
		expect(out.shortened).toBe(0);
		expect(out.omitted).toBe(0);
		expect(out.text).not.toContain('NOTE:');
	});
});
