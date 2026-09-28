import { describe, expect, it } from 'vitest';
import { legacyNoteEntries } from '../legacy-notes';

const now = new Date('2026-09-28T12:00:00Z');

describe('legacyNoteEntries', () => {
	it('turns each note into an entry dated when it was written', () => {
		expect(
			legacyNoteEntries(
				[
					{
						id: 'a',
						text: 'Recruiter said the band is 90-100k',
						created_at: '2026-03-01T09:30:00Z'
					},
					{ id: 'b', text: 'Sent the references', created_at: '2026-03-04T16:00:00.000Z' }
				],
				now
			)
		).toEqual([
			{
				title: 'Recruiter said the band is 90-100k',
				content: 'Recruiter said the band is 90-100k',
				event_date: '2026-03-01',
				date_created: new Date('2026-03-01T09:30:00Z')
			},
			{
				title: 'Sent the references',
				content: 'Sent the references',
				event_date: '2026-03-04',
				date_created: new Date('2026-03-04T16:00:00Z')
			}
		]);
	});

	it("reads Postgres's own timestamp form, which older rows hold", () => {
		const [entry] = legacyNoteEntries(
			[{ text: 'They will call later', created_at: '2026-04-25 11:25:38.48+00' }],
			now
		);
		expect(entry).toMatchObject({
			event_date: '2026-04-25',
			date_created: new Date('2026-04-25T11:25:38.480Z')
		});
	});

	it('titles a long note by its first line', () => {
		const [entry] = legacyNoteEntries(
			[{ text: '\n  Office days\nTuesdays and Thursdays', created_at: '2026-03-01T09:30:00Z' }],
			now
		);
		expect(entry.title).toBe('Office days');
		expect(entry.content).toBe('Office days\nTuesdays and Thursdays');
	});

	it('dates a note with an unreadable timestamp now, rather than dropping it', () => {
		const [missing, garbled] = legacyNoteEntries(
			[{ text: 'No date' }, { text: 'Bad date', created_at: 'yesterday-ish' }],
			now
		);
		expect(missing).toMatchObject({ event_date: '2026-09-28', date_created: now });
		expect(garbled).toMatchObject({ event_date: '2026-09-28', date_created: now });
	});

	it('drops notes without text and anything that is not a note', () => {
		expect(
			legacyNoteEntries(
				[{ text: '   ' }, { text: 42 }, null, 'a bare string', ['nested'], { created_at: 'x' }],
				now
			)
		).toEqual([]);
	});

	it('reads nothing from an export that has no list', () => {
		expect(legacyNoteEntries(undefined, now)).toEqual([]);
		expect(legacyNoteEntries(null, now)).toEqual([]);
		expect(legacyNoteEntries({ text: 'not a list' }, now)).toEqual([]);
	});
});
