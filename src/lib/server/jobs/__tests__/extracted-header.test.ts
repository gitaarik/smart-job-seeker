/**
 * Tests for the caller-side clean-up of the model's header fields.
 *
 * Every case is one seen in a stored job or one shape away from it. The
 * invariant across all of them: the result is the model's value, trimmed, or
 * null — never something this module composed.
 */
import { describe, expect, it } from 'vitest';
import {
	MIN_POSTING_CHARS_FOR_SUGGESTION,
	groundHeader,
	groundedValue,
	sanitizeExtractedHeader,
	suggestedTitle
} from '../extracted-header';

describe('sanitizeExtractedHeader', () => {
	it('passes clean values through', () => {
		expect(
			sanitizeExtractedHeader({
				title: 'Semantic AI Engineer',
				company: 'Alliander',
				job_poster: 'Citrus-IT',
				location: 'Arnhem'
			})
		).toEqual({
			title: 'Semantic AI Engineer',
			company: 'Alliander',
			job_poster: 'Citrus-IT',
			location: 'Arnhem'
		});
	});

	it('turns missing, empty and non-string values into null', () => {
		expect(sanitizeExtractedHeader({})).toEqual({
			title: null,
			company: null,
			job_poster: null,
			location: null
		});
		expect(sanitizeExtractedHeader({ title: '  ', company: 42, location: ['x'] })).toEqual({
			title: null,
			company: null,
			job_poster: null,
			location: null
		});
	});

	it('strips a label the model echoed with the value', () => {
		expect(
			sanitizeExtractedHeader({
				title: 'Functietitel: Semantic AI Engineer',
				company: 'Opdrachtgever: Alliander',
				job_poster: 'Contactpersoon: Sanne de Vries',
				location: 'Standplaats: Arnhem'
			})
		).toEqual({
			title: 'Semantic AI Engineer',
			company: 'Alliander',
			job_poster: 'Sanne de Vries',
			location: 'Arnhem'
		});
	});

	it('strips "via" and "namens" from a recruiter', () => {
		expect(sanitizeExtractedHeader({ job_poster: 'via Citrus-IT' }).job_poster).toBe('Citrus-IT');
		expect(sanitizeExtractedHeader({ job_poster: 'namens Avance / Hirexa' }).job_poster).toBe(
			'Avance / Hirexa'
		);
	});

	it('collapses whitespace and trims dangling separators', () => {
		expect(sanitizeExtractedHeader({ title: '  Senior   Engineer — ' }).title).toBe(
			'Senior Engineer'
		);
		expect(sanitizeExtractedHeader({ company: '- Acme Inc.' }).company).toBe('Acme Inc.');
	});

	it('keeps the headline when a title came back as two lines', () => {
		expect(
			sanitizeExtractedHeader({
				title: 'Senior FS for supplier intelligence products\nFull-stack Web Developer | Senior'
			}).title
		).toBe('Senior FS for supplier intelligence products');
	});

	it('nulls a title that is really a sentence', () => {
		expect(
			sanitizeExtractedHeader({
				title:
					'We are seeking an experienced Senior Python Developer to join our team and build REST APIs for data ingestion and streaming services across the platform'
			}).title
		).toBeNull();
	});

	it('nulls a section heading returned as the title', () => {
		for (const heading of [
			'Opdrachtomschrijving',
			'Opdracht omschrijving',
			'Job Description',
			'Position Overview',
			'About the role',
			'Over de functie'
		]) {
			expect(sanitizeExtractedHeader({ title: heading }).title, heading).toBeNull();
		}
	});

	it('does not mistake a real title for a heading', () => {
		expect(sanitizeExtractedHeader({ title: 'Description Writer' }).title).toBe(
			'Description Writer'
		);
		expect(sanitizeExtractedHeader({ title: 'Position Controller' }).title).toBe(
			'Position Controller'
		);
	});

	it('trims the company or location a headline tacked onto the title', () => {
		expect(
			sanitizeExtractedHeader({ title: 'Senior Python Developer at TSC', company: 'TSC' }).title
		).toBe('Senior Python Developer');
		expect(
			sanitizeExtractedHeader({ title: 'Semantic AI Engineer – Alliander', company: 'Alliander' })
				.title
		).toBe('Semantic AI Engineer');
		expect(
			sanitizeExtractedHeader({ title: 'Data Engineer (Lisbon)', location: 'Lisbon' }).title
		).toBe('Data Engineer');
		expect(
			sanitizeExtractedHeader({
				title: 'Lead Engineer | Matrixian | Amsterdam',
				company: 'Matrixian',
				location: 'Amsterdam'
			}).title
		).toBe('Lead Engineer');
	});

	it('only trims a suffix that is the extracted name', () => {
		expect(sanitizeExtractedHeader({ title: 'Engineer, Platform', company: 'Acme' }).title).toBe(
			'Engineer, Platform'
		);
		expect(sanitizeExtractedHeader({ title: 'Developer at Heart', company: 'Acme' }).title).toBe(
			'Developer at Heart'
		);
	});

	it('nulls a title that is just the company again', () => {
		expect(sanitizeExtractedHeader({ title: 'PwC', company: 'PwC' })).toMatchObject({
			title: null,
			company: 'PwC'
		});
	});

	it('nulls a company that stands in for a name the posting never gave', () => {
		for (const stub of ['Our client', 'onze opdrachtgever', 'Confidential', 'N/A', 'null']) {
			expect(sanitizeExtractedHeader({ company: stub }).company, stub).toBeNull();
		}
	});

	it('nulls a recruiter that is the company again', () => {
		expect(
			sanitizeExtractedHeader({ company: 'Acme Corp', job_poster: 'ACME Corp.' }).job_poster
		).toBeNull();
		expect(
			sanitizeExtractedHeader({ company: 'Acme Corp', job_poster: 'Tech Recruiters' }).job_poster
		).toBe('Tech Recruiters');
	});

	it('nulls a value longer than the field can plausibly hold', () => {
		expect(sanitizeExtractedHeader({ company: 'A'.repeat(101) }).company).toBeNull();
		expect(sanitizeExtractedHeader({ location: 'L'.repeat(121) }).location).toBeNull();
		expect(sanitizeExtractedHeader({ location: 'Amsterdam, Nethelrands' }).location).toBe(
			'Amsterdam, Nethelrands'
		);
	});
});

const POSTING = `Functie: Senior Python Developer
Standplaats: Arnhem

Het programma BZB werkt aan opdrachten toegekend door het bestuursteam van de Belastingdienst.
Als software/data engineer binnen het DataHub-team werk je aan pipelines.

Met vriendelijke groet,
Sanne de Vries
Recruiter, Citrus-IT`;

describe('groundedValue', () => {
	it('keeps a value whose quote is in the posting and contains the value', () => {
		expect(
			groundedValue(
				{
					value: 'Belastingdienst',
					quote: 'toegekend door het bestuursteam van de Belastingdienst'
				},
				POSTING
			)
		).toBe('Belastingdienst');
	});

	it('matches loosely on case, punctuation and whitespace', () => {
		expect(
			groundedValue(
				{
					value: 'Software/Data Engineer',
					quote: 'als software/data engineer binnen het datahub-team'
				},
				POSTING
			)
		).toBe('Software/Data Engineer');
		expect(groundedValue({ value: 'Arnhem', quote: 'Standplaats:  Arnhem' }, POSTING)).toBe(
			'Arnhem'
		);
	});

	it('accepts a recruiter composed from two lines', () => {
		expect(
			groundedValue(
				{ value: 'Sanne de Vries (Citrus-IT)', quote: 'Sanne de Vries\nRecruiter, Citrus-IT' },
				POSTING
			)
		).toBe('Sanne de Vries (Citrus-IT)');
	});

	// The whole point: no evidence in the posting, no value.
	it('rejects a quote the posting does not contain', () => {
		expect(
			groundedValue({ value: 'Google', quote: 'Join Google as a Python developer' }, POSTING)
		).toBeNull();
	});

	it('rejects a value the quote does not contain', () => {
		expect(
			groundedValue(
				{ value: 'Google Cloud', quote: 'toegekend door het bestuursteam van de Belastingdienst' },
				POSTING
			)
		).toBeNull();
	});

	it('rejects a value with no quote at all', () => {
		expect(groundedValue({ value: 'Belastingdienst', quote: null }, POSTING)).toBeNull();
		expect(groundedValue({ value: 'Belastingdienst' }, POSTING)).toBeNull();
		expect(groundedValue(null, POSTING)).toBeNull();
		expect(groundedValue(undefined, POSTING)).toBeNull();
	});

	it('rejects an empty value or quote', () => {
		expect(groundedValue({ value: '  ', quote: 'Standplaats: Arnhem' }, POSTING)).toBeNull();
		expect(groundedValue({ value: 'Arnhem', quote: ' - ' }, POSTING)).toBeNull();
	});
});

describe('groundHeader', () => {
	it('grounds every field and nulls the rest', () => {
		expect(
			groundHeader(
				{
					title: { value: 'Senior Python Developer', quote: 'Functie: Senior Python Developer' },
					company: { value: 'Acme', quote: 'Acme is hiring' },
					job_poster: null,
					location: { value: 'Arnhem', quote: 'Standplaats: Arnhem' }
				},
				POSTING
			)
		).toEqual({
			title: 'Senior Python Developer',
			company: null,
			job_poster: null,
			location: 'Arnhem'
		});
	});

	it('is all-null for a missing answer', () => {
		expect(groundHeader(null, POSTING)).toEqual({
			title: null,
			company: null,
			job_poster: null,
			location: null
		});
	});
});

describe('suggestedTitle', () => {
	const LONG = 'Het programma BZB werkt aan opdrachten. '.repeat(12);

	it('offers a cleaned suggestion for a substantial posting', () => {
		expect(
			suggestedTitle(
				{ suggested_title: '  Developer AI & procesautomatisering (programma BZB) ' },
				LONG
			)
		).toBe('Developer AI & procesautomatisering (programma BZB)');
		expect(LONG.length).toBeGreaterThanOrEqual(MIN_POSTING_CHARS_FOR_SUGGESTION);
	});

	// A one-liner has nothing to describe the work from; whatever the model
	// offered for it is filler.
	it('offers nothing for a short posting', () => {
		expect(
			suggestedTitle(
				{ suggested_title: 'Data Engineer' },
				'We are hiring a data engineer in Lisbon.'
			)
		).toBeNull();
	});

	it('is cleaned like a title', () => {
		expect(suggestedTitle({ suggested_title: 'Opdrachtomschrijving' }, LONG)).toBeNull();
		expect(suggestedTitle({ suggested_title: 'Title: Developer BZB' }, LONG)).toBe('Developer BZB');
	});

	it('is null when the model offered none', () => {
		expect(suggestedTitle({ suggested_title: null }, LONG)).toBeNull();
		expect(suggestedTitle({}, LONG)).toBeNull();
		expect(suggestedTitle(null, LONG)).toBeNull();
	});
});
