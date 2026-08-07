/**
 * The pure halves of the derivation pass: what we accept from the model, and
 * what we are willing to write over.
 *
 * Both exist because the model is not trusted. `coerceDerived` is our side of
 * the boundary — the wire schema cannot carry a `.transform()` without
 * throwing "Transforms cannot be represented in JSON Schema" — and
 * `pickChanges` is the guard against a write-side process silently undoing a
 * correction the user made deliberately.
 */
import { describe, expect, it } from 'vitest';
import { coerceDerived, pickChanges, shouldDerive } from '../record-derivation';

describe('coerceDerived', () => {
	it('takes a well-formed answer as given', () => {
		const out = coerceDerived({
			title: 'Technical round scheduled',
			record_type: 'message',
			event_date: '2026-07-28',
			contacts: [{ name: 'Anna Cooper', role: 'technical_interviewer' }]
		});
		expect(out).toEqual({
			title: 'Technical round scheduled',
			record_type: 'message',
			event_date: '2026-07-28',
			contacts: [{ name: 'Anna Cooper', role: 'technical_interviewer' }]
		});
	});

	// An invented type would render as the fallback label and never match a
	// filter, so it is dropped rather than stored.
	it('drops a type outside the vocabulary', () => {
		expect(coerceDerived({ record_type: 'gossip' }).record_type).toBeNull();
	});

	it('accepts a type in the wrong case', () => {
		expect(coerceDerived({ record_type: 'OFFER' }).record_type).toBe('offer');
	});

	it('drops a role outside the vocabulary but keeps the person', () => {
		const out = coerceDerived({
			contacts: [{ name: 'Sam Reyes', role: 'chief vibes officer' }]
		});
		expect(out.contacts).toEqual([{ name: 'Sam Reyes', role: null }]);
	});

	// A wrong date silently reorders the stream, which is worse than no date.
	it.each(['28-07-2026', 'July 28', '2026-13-45', 'soon', ''])(
		'refuses the unparseable date %j',
		(date) => {
			expect(coerceDerived({ event_date: date }).event_date).toBeNull();
		}
	);

	it('survives the shapes gpt-oss actually returns', () => {
		// Bare non-array contacts, a missing key, a nameless entry, a number
		// where a string belongs — all observed failure modes for this family.
		expect(coerceDerived({ contacts: 'Anna Cooper' }).contacts).toEqual([]);
		expect(coerceDerived({}).contacts).toEqual([]);
		expect(coerceDerived({}).title).toBeNull();
		expect(coerceDerived({ contacts: [{ role: 'recruiter' }] }).contacts).toEqual([]);
		expect(coerceDerived({ title: 42 as unknown as string }).title).toBeNull();
	});

	it('collapses the same person named twice in one entry', () => {
		const out = coerceDerived({
			contacts: [
				{ name: 'Anna Cooper', role: 'technical_interviewer' },
				{ name: 'anna  cooper', role: null }
			]
		});
		expect(out.contacts).toHaveLength(1);
		expect(out.contacts[0].role).toBe('technical_interviewer');
	});

	it('treats a blank title as absent rather than storing whitespace', () => {
		expect(coerceDerived({ title: '   ' }).title).toBeNull();
	});
});

const derived = {
	title: 'Technical round scheduled',
	record_type: 'message',
	event_date: '2026-07-28',
	contacts: [{ name: 'Anna Cooper', role: 'technical_interviewer' as const }]
};

describe('pickChanges', () => {
	// date_updated is null until something edits the row, so an untouched record
	// is carrying nothing but write-time fallbacks.
	it('replaces every fallback on a record the user never touched', () => {
		const out = pickChanges(
			{ contacts: [], event_date: '2026-08-03', date_updated: null },
			derived
		);
		expect(out).toEqual({
			title: derived.title,
			record_type: 'message',
			event_date: '2026-07-28',
			contacts: derived.contacts
		});
	});

	// The failure that matters: a process that is right in general quietly
	// undoing a specific correction, invisibly.
	it('leaves title and type alone once the user has edited', () => {
		const out = pickChanges(
			{ contacts: [], event_date: '2026-08-03', date_updated: new Date() },
			derived
		);
		expect(out.title).toBeUndefined();
		expect(out.record_type).toBeUndefined();
	});

	it('still fills a genuinely blank date on an edited record', () => {
		const out = pickChanges({ contacts: [], event_date: null, date_updated: new Date() }, derived);
		expect(out.event_date).toBe('2026-07-28');
	});

	// The composer cannot pre-fill contacts, so anything there came from a
	// person and always stands.
	it('never overwrites contacts the user entered', () => {
		const out = pickChanges(
			{
				contacts: [{ name: 'Someone Else', role: 'recruiter' }],
				event_date: null,
				date_updated: null
			},
			derived
		);
		expect(out.contacts).toBeUndefined();
	});

	it('writes nothing when the model found nothing', () => {
		const out = pickChanges(
			{ contacts: [], event_date: null, date_updated: null },
			{ title: null, record_type: null, event_date: null, contacts: [] }
		);
		expect(out).toEqual({});
	});
});

describe('shouldDerive', () => {
	const long = 'x'.repeat(500);

	// Short notes are the commonest entry by far, and a first line is as good a
	// title as an LLM one — skipping them is most of the cost control.
	it('skips an entry too short to hold anything worth finding', () => {
		expect(
			shouldDerive({
				content: 'Called them, no answer.',
				derived_at: null,
				date_updated: null
			})
		).toBe(false);
	});

	it('runs on a long entry that has never been analysed', () => {
		expect(shouldDerive({ content: long, derived_at: null, date_updated: null })).toBe(true);
	});

	it('does not pay twice for content that has not moved on', () => {
		const t = new Date('2026-08-03T10:00:00Z');
		expect(shouldDerive({ content: long, derived_at: t, date_updated: t })).toBe(false);
	});

	it('re-derives once the content is edited', () => {
		expect(
			shouldDerive({
				content: long,
				derived_at: new Date('2026-08-03T10:00:00Z'),
				date_updated: new Date('2026-08-03T11:00:00Z')
			})
		).toBe(true);
	});

	it('treats an empty record as nothing to do', () => {
		expect(shouldDerive({ content: null, derived_at: null, date_updated: null })).toBe(false);
	});
});
