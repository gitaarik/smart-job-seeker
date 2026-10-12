/**
 * Reading a PDF's text for what still names the applicant.
 *
 * The sample is lines from the first anonymous CV made here, before the rules
 * in anonymity.ts existed: the name in the heading, a phone number, a LinkedIn
 * URL the PDF broke across two lines, an employer called after the applicant,
 * a testimonial beginning with their first name, their home town.
 */

import { describe, expect, it, vi } from 'vitest';

vi.mock('$lib/server/db', () => ({
	db: {},
	dbDirect: {}
}));

const { findLeaks, identityTerms } = await import('../anonymity-check');

const row = {
	name: 'Rik Wanders',
	company_name: 'Rik Wanders Software',
	email_address: 'rik@rikwanders.tech',
	phone_number: '+31649118511',
	personal_website: 'https://www.rikwanders.tech/',
	linkedin_profile: 'https://www.linkedin.com/in/rik-wanders-software',
	github_profile: 'https://github.com/gitaarik',
	street_address: 'Voorbeeldstraat 12',
	postal_code: '2011 AB',
	kvk_number: '12345678',
	vat_id: 'NL001234567B01',
	location: 'Haarlem, The Netherlands'
};

const kinds = (text: string) => findLeaks(text, identityTerms(row)).map((hit) => hit.kind);

describe('identityTerms', () => {
	it('takes every way the row names the applicant', () => {
		const terms = identityTerms(row).map((t) => `${t.kind}:${t.term}`);
		expect(terms).toEqual(
			expect.arrayContaining([
				'name:Rik Wanders',
				'name:Rik',
				'name:Wanders',
				'business:Rik Wanders Software',
				'email:rik@rikwanders.tech',
				'phone:649118511',
				'handle:rik-wanders-software',
				'handle:gitaarik',
				'handle:rikwanders.tech',
				'handle:rikwanders',
				'address:Voorbeeldstraat 12',
				'address:2011 AB',
				'registration:12345678',
				'registration:NL001234567B01',
				'hometown:Haarlem'
			])
		);
	});

	it('leaves out name particles and generic mailboxes', () => {
		const terms = identityTerms({
			name: 'Jan van der Berg',
			email_address: 'info@berg.nl'
		}).map((t) => t.term);
		expect(terms).toContain('Jan van der Berg');
		expect(terms).toContain('Berg');
		expect(terms).not.toContain('van');
		expect(terms).not.toContain('der');
		expect(terms).not.toContain('info');
	});
});

describe('findLeaks', () => {
	it('finds the name, once, where the heading prints it', () => {
		const hits = findLeaks('Rik Wanders\nSenior Full-Stack AI Engineer', identityTerms(row));
		expect(hits).toHaveLength(1);
		expect(hits[0]).toMatchObject({ kind: 'name', term: 'Rik Wanders' });
	});

	it('takes an employer called after the applicant as one hit', () => {
		expect(kinds('AI Engineer\nRik Wanders Software\n08/2025 - Heden')).toEqual(['business']);
	});

	it('finds a first name in a sentence, without the case or accents mattering', () => {
		const [hit] = findLeaks(
			'“Rik moderniseerde de interfaces voor onze klanten”',
			identityTerms(row)
		);
		expect(hit).toMatchObject({ kind: 'name', term: 'Rik' });
		expect(hit.context).toContain('moderniseerde');
		expect(kinds('RIK toonde leiderschap')).toEqual(['name']);
	});

	it('does not find a name inside another word', () => {
		expect(kinds('Rikkert en Wandersman bouwden een Haarlemmermeer-app')).toEqual([]);
	});

	it('finds a phone number however it is written', () => {
		for (const written of ['+31649118511', '06-49118511', '06 4911 8511', '(06) 49 11 85 11']) {
			expect(kinds(`Bel ${written} gerust`), written).toEqual(['phone']);
		}
		expect(kinds('order 1649118511 shipped')).toEqual([]);
	});

	it('finds a handle the PDF broke across two lines', () => {
		expect(kinds('https://www.linkedin.com/in/rik-\nwanders-software')).toEqual(['handle']);
	});

	it('finds the address, registrations and home town', () => {
		expect(kinds('Voorbeeldstraat 12, 2011AB')).toEqual(['address', 'address']);
		expect(kinds('KvK 1234 5678 · btw NL001234567B01')).toEqual(['registration', 'registration']);
		expect(kinds('tooling in Haarlem, NL.')).toEqual(['hometown']);
	});

	it('says nothing about a document that does not name them', () => {
		expect(
			findLeaks(
				'Senior Full-Stack AI Engineer\nEigen onderneming\nLeidde een ontwikkelteam (3-5 devs).',
				identityTerms(row)
			)
		).toEqual([]);
	});
});
