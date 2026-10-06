/**
 * The digest's two boundaries: which entries need one (and when a stored one
 * has gone stale), and what counts as a usable answer from the model.
 */
import { describe, expect, it } from 'vitest';
import {
	coerceAhead,
	coerceDigest,
	digestHash,
	DIGEST_CONTRACT_VERSION,
	digestReadsCurrentText,
	hasCurrentDigest,
	isLongEntry,
	needsDigest,
	renderDigestAbout
} from '../entry-digest';
import { LONG_ENTRY_CHARS } from '$lib/application-records';

const long = 'x'.repeat(LONG_ENTRY_CHARS + 1);

function entry(over: Record<string, unknown> = {}) {
	return {
		record_type: 'transcript',
		event_date: '2026-09-28',
		content: long,
		digest_hash: null as string | null,
		...over
	};
}

describe('digestHash', () => {
	it('is stable, and carries the contract version', () => {
		expect(digestHash(entry())).toBe(digestHash(entry()));
		expect(digestHash(entry()).startsWith(`v${DIGEST_CONTRACT_VERSION}:`)).toBe(true);
	});

	it.each([
		['content', { content: long + 'y' }],
		['date', { event_date: '2026-09-29' }],
		['type', { record_type: 'message' }]
	])('changes when the %s changes', (_name, over) => {
		expect(digestHash(entry(over))).not.toBe(digestHash(entry()));
	});

	// Derivation retitles an entry after it is written; that must not cost a
	// second read of a 90,000-character transcript.
	it('ignores the title', () => {
		const titled = { ...entry(), title: 'Recruiter call' };
		expect(digestHash(titled)).toBe(digestHash(entry()));
	});
});

describe('which entries need a digest', () => {
	it('only long ones', () => {
		expect(isLongEntry({ content: 'x'.repeat(LONG_ENTRY_CHARS) })).toBe(false);
		expect(isLongEntry({ content: long })).toBe(true);
		expect(isLongEntry({ content: null })).toBe(false);
		expect(needsDigest(entry({ content: 'short note' }))).toBe(false);
	});

	it('a long entry with no digest, or one written from other text', () => {
		expect(needsDigest(entry())).toBe(true);
		const current = entry({ digest_hash: digestHash(entry()) });
		expect(needsDigest(current)).toBe(false);
		expect(hasCurrentDigest(current)).toBe(true);
		const edited = { ...current, content: long + ' edited' };
		expect(needsDigest(edited)).toBe(true);
	});

	it('treats a digest from an older contract as stale', () => {
		const old = entry({ digest_hash: 'v0:' + digestHash(entry()).slice(3) });
		expect(needsDigest(old)).toBe(true);
	});
});

// A contract bump makes every digest stale at once, and the write path re-reads
// three per save. Until then an older digest of the same text is still true, and
// beats the cut excerpt the summariser would otherwise read.
describe('digestReadsCurrentText', () => {
	it('accepts an older contract over the same text', () => {
		const old = entry({ digest_hash: 'v1:' + digestHash(entry()).split(':')[1] });
		expect(hasCurrentDigest(old)).toBe(false);
		expect(digestReadsCurrentText(old)).toBe(true);
	});

	it('refuses a digest of other text, or none', () => {
		const written = entry({ digest_hash: digestHash(entry()) });
		expect(digestReadsCurrentText(written)).toBe(true);
		expect(digestReadsCurrentText({ ...written, content: long + ' edited' })).toBe(false);
		expect(digestReadsCurrentText(entry())).toBe(false);
	});
});

describe('coerceDigest', () => {
	it('takes a gist and its facts', () => {
		const out = coerceDigest({
			gist: '  Intro call   with the recruiter. ',
			facts: [{ category: 'logistics', label: 'Next round', value: 'With the CTO' }]
		})!;
		expect(out.gist).toBe('Intro call with the recruiter.');
		expect(out.facts).toEqual([
			{ category: 'logistics', label: 'Next round', value: 'With the CTO' }
		]);
	});

	// A gist with no facts is a real answer (a long onboarding guide can hold
	// nothing worth keeping); no gist is a malformed one, retried next time.
	it('accepts no facts, refuses no gist', () => {
		expect(coerceDigest({ gist: 'An onboarding guide.', facts: [] })!.facts).toEqual([]);
		expect(coerceDigest({ gist: '', facts: [] })).toBeNull();
		expect(coerceDigest({ facts: [] })).toBeNull();
		expect(coerceDigest(null)).toBeNull();
		expect(coerceDigest('a string')).toBeNull();
	});

	it('normalises facts the way details are, with a larger cap', () => {
		const facts = Array.from({ length: 30 }, (_, i) => ({
			category: i === 29 ? 'decision' : 'invented',
			label: `Fact ${i}`,
			value: `Value ${i}`
		}));
		const out = coerceDigest({ gist: 'A contract.', facts })!;
		expect(out.facts).toHaveLength(20);
		// The applicant's own decision leads, whatever the model's order.
		expect(out.facts[0]).toEqual({ category: 'decision', label: 'Fact 29', value: 'Value 29' });
		expect(out.facts[1].category).toBe('other');
	});

	it('caps a runaway gist', () => {
		const out = coerceDigest({ gist: 'word '.repeat(500), facts: [] })!;
		expect(out.gist.length).toBeLessThanOrEqual(601);
	});

	// A v1 digest has no rounds, and is still read until the entry is read again.
	it('reads a digest with no rounds as having none', () => {
		expect(coerceDigest({ gist: 'An intro call.', facts: [] })!.ahead).toEqual([]);
	});
});

describe('coerceAhead', () => {
	it('takes a round in the shape of an application round', () => {
		expect(
			coerceAhead([
				{
					kind: 'Intro',
					date: '2026-10-08',
					time: '15:30',
					with: 'Jane Doe, CTO',
					about: 'A conversation about background; moved from 2026-10-02'
				}
			])
		).toEqual([
			{
				kind: 'Intro',
				date: '2026-10-08',
				time: '15:30',
				with: 'Jane Doe, CTO',
				about: 'A conversation about background; moved from 2026-10-02'
			}
		]);
	});

	// The round said in passing, which is the one this field exists for: nobody
	// has said what kind or when, only who.
	it('keeps a round that only names who runs it', () => {
		const [round] = coerceAhead([{ with: 'Joost, a partner at the fund', about: 'If it goes on' }]);
		expect(round).toEqual({
			kind: null,
			date: null,
			time: null,
			with: 'Joost, a partner at the fund',
			about: 'If it goes on'
		});
	});

	it('drops a field that is not what its name says, not the round', () => {
		const [round] = coerceAhead([
			{ kind: 'Chat', date: 'next Thursday', time: '3.30pm', with: 'the CTO' }
		]);
		expect(round).toMatchObject({ kind: null, date: null, time: null, with: 'the CTO' });
	});

	it('normalises a kind and a time the way the rounds editor does', () => {
		const [round] = coerceAhead([{ kind: 'technical', time: '9:30' }]);
		expect(round).toMatchObject({ kind: 'Technical', time: '09:30' });
		expect(coerceAhead([{ time: '15.30' }, { time: '15:30:00' }]).map((r) => r.time)).toEqual([
			'15:30',
			'15:30'
		]);
		expect(coerceAhead([{ time: '24:10', about: 'x' }])[0].time).toBeNull();
	});

	it('drops what is not a round', () => {
		expect(coerceAhead(null)).toEqual([]);
		expect(coerceAhead('Intro with the CTO')).toEqual([]);
		expect(coerceAhead([{}, { kind: null, with: '  ' }, 'words', null])).toEqual([]);
	});

	it('parses a round that arrives as a string holding it, and caps the list', () => {
		const one = JSON.stringify({ kind: 'Team', with: 'The platform team' });
		expect(coerceAhead([one])[0]).toMatchObject({ kind: 'Team', with: 'The platform team' });
		const many = Array.from({ length: 9 }, (_, i) => ({ about: `Round ${i + 1}` }));
		expect(coerceAhead(many)).toHaveLength(5);
	});
});

describe('renderDigestAbout', () => {
	const about = (over: Partial<Parameters<typeof renderDigestAbout>[0]> = {}) =>
		renderDigestAbout(
			{
				record_type: 'transcript',
				title: 'Recruiter reschedules the first round',
				event_date: '2026-10-02',
				filename: null,
				job: { title: 'Backend Engineer', company: 'Norvik Data' },
				...over
			},
			100,
			100
		);

	// "Thursday next week" is a date only against the day it was said on.
	it('gives the weekday with the date', () => {
		expect(about()).toContain('Date: 2026-10-02 (Friday)');
	});

	// Counting the days itself, the model put "Thursday" on the Wednesday one
	// run in seven. Listed, it is a lookup.
	it('lists the week of the date and the week after, from Monday', () => {
		expect(about()).toContain(
			'Its week: Mon 2026-09-28, Tue 2026-09-29, Wed 2026-09-30, Thu 2026-10-01, ' +
				'Fri 2026-10-02, Sat 2026-10-03, Sun 2026-10-04\n' +
				'The week after: Mon 2026-10-05, Tue 2026-10-06, Wed 2026-10-07, Thu 2026-10-08, ' +
				'Fri 2026-10-09, Sat 2026-10-10, Sun 2026-10-11'
		);
		// A Sunday ends its week rather than starting the next one.
		expect(about({ event_date: '2026-10-04' })).toContain('Its week: Mon 2026-09-28,');
		expect(about({ event_date: 'soon' })).not.toContain('Its week');
	});

	// What a transcriber mishears is the employer's name; the model can only
	// put it right if it is told what the name is.
	it('names the employer and the role', () => {
		expect(about()).toContain('Employer: Norvik Data');
		expect(about()).toContain('Role: Backend Engineer');
	});

	it('leaves out what it does not know', () => {
		const text = about({ event_date: null, job: null });
		expect(text).not.toContain('Date:');
		expect(text).not.toContain('Employer:');
		expect(about({ job: { title: null, company: '  ' } })).not.toMatch(/Employer:|Role:/);
	});

	it('says when the middle is cut', () => {
		const text = renderDigestAbout(
			{ record_type: 'message', title: null, event_date: null, filename: 'thread.eml', job: null },
			50,
			200
		);
		expect(text).toContain('Shown: 50 of 200 characters.');
		expect(text).toContain('Extracted from a file named "thread.eml".');
	});
});
