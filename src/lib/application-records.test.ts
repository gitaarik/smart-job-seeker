/**
 * The composer never asks for a title, so something has to produce one. Until
 * the LLM derivation pass lands, that something is a first line — and these
 * cases are why that is defensible rather than lazy.
 */
import { describe, expect, it } from 'vitest';
import { deriveRecordTitle, recordTypes, recordTypeValues } from './application-records';

describe('deriveRecordTitle', () => {
	it('takes the first non-empty line', () => {
		expect(deriveRecordTitle('Screening call went well\n\nDetails follow.')).toBe(
			'Screening call went well'
		);
	});

	it('skips leading blank lines rather than titling nothing', () => {
		expect(deriveRecordTitle('\n\n  \nActual first line')).toBe('Actual first line');
	});

	// Pasting an email is the single most common way an entry gets created, and
	// "Subject: Re: your application" as a title wastes the scannable part.
	it('strips a Subject: prefix', () => {
		expect(deriveRecordTitle('Subject: Re: your application\n\nHi Alex,')).toBe(
			'Re: your application'
		);
	});

	it('strips the Dutch equivalent too', () => {
		expect(deriveRecordTitle('Onderwerp: Uitnodiging gesprek')).toBe('Uitnodiging gesprek');
	});

	it('does not strip a mid-line colon', () => {
		expect(deriveRecordTitle('Next steps: send the assignment')).toBe(
			'Next steps: send the assignment'
		);
	});

	it('clips a wall of text so a title stays scannable', () => {
		const out = deriveRecordTitle('x'.repeat(500));
		expect(out.length).toBeLessThanOrEqual(121); // 120 + the ellipsis
		expect(out.endsWith('…')).toBe(true);
	});

	// A file-only entry passes "" here and falls back to the filename in the
	// caller; an entry with neither still must not write a null title, since the
	// column is NOT NULL.
	it('never returns an empty string', () => {
		expect(deriveRecordTitle('')).toBe('Untitled');
		expect(deriveRecordTitle('   \n  ')).toBe('Untitled');
		expect(deriveRecordTitle('Subject:   ')).toBe('Untitled');
	});
});

describe('record vocabulary', () => {
	it('keeps values and labels in step', () => {
		expect(recordTypeValues).toEqual(recordTypes.map((t) => t.value));
	});

	// `note` stopped being the catch-all "Other" when it became the authorship
	// kind. If its label drifts back, the aggregate that reads "entries the
	// applicant wrote themselves" silently starts meaning something else.
	it('labels note as an authored update, not as Other', () => {
		const note = recordTypes.find((t) => t.value === 'note');
		expect(note?.label).not.toBe('Other');
		expect(note?.hint).toMatch(/yourself/i);
	});
});
