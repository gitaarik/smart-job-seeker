/**
 * What an anonymous document leaves out.
 *
 * Modelled on the first one made here, which named its applicant eight ways:
 * the heading, the PDF's title field, the file name, the contact block (one
 * line of it a consultancy's address with their first name in it), an employer
 * called after them, two testimonials, and their home town twice. Each rule
 * below is one of those.
 */

import { describe, expect, it, vi } from 'vitest';

vi.mock('$lib/server/db', () => ({
	db: {},
	dbDirect: {}
}));

const {
	anonymiseTree,
	anonymousTemplate,
	identityOf,
	isAnonymousChain,
	isOwnBusiness,
	leadsToApplicant
} = await import('../anonymity');
const { pageIsAnonymous, pageProfile } = await import('../page-profile');
const { ANONYMOUS_TOGGLE, isAnonymous, withAnonymous } = await import('$lib/resume-anonymity');

function profile() {
	return {
		id: 1,
		slug: 'alex-morgan',
		name: 'Alex Morgan',
		title: 'Senior Engineer',
		company_name: 'Morgan Digital',
		email_address: 'alex@morgan.dev',
		phone_number: '+31 6 12345678',
		location: 'Utrecht, The Netherlands',
		location_timezone: 'CET',
		personal_website: 'https://www.alexmorgan.dev/',
		linkedin_profile: 'https://www.linkedin.com/in/alex-morgan-eng',
		github_profile: 'https://github.com/amorgan77',
		stackoverflow_profile: 'https://stackoverflow.com/users/123456/amorgan77',
		nationality: 'Dutch',
		profile_photo_path: 'photo.jpg',
		summary: 'Engineer with ten years of experience.',
		references: [{ author: 'Sam Lee', author_position: 'CTO', text: 'Alex rebuilt our platform.' }],
		highlights: [{ text: 'Alex shipped it' }],
		work_experiences: [
			{
				id: 1,
				name: 'Alex Morgan Software',
				location: 'Utrecht, NL',
				website: 'https://alexmorgan.dev',
				work_experience_projects: [{ id: 9, url: 'https://github.com/amorgan77/tool' }]
			},
			{ id: 2, name: 'Acme', location: 'Amsterdam, NL', website: 'https://acme.example' },
			{ id: 3, name: 'Morgan Digital', location: 'Utrecht, NL', website: null }
		],
		side_projects: [
			{ id: 5, name: 'Tool', url: 'https://github.com/amorgan77/tool', repo_url: null },
			{ id: 6, name: 'Site', url: 'https://example.org/', repo_url: null }
		],
		certificates: [{ id: 7, name: 'English', url: 'https://cert.example/x', credential_id: 'X1' }],
		profile_versions: [
			{
				id: 10,
				slug: 'base',
				name: 'Base',
				toggles: null,
				extension_links: [],
				overrides: []
			},
			{
				id: 11,
				slug: 'app-92',
				name: 'Engineer — Some Employer',
				toggles: [ANONYMOUS_TOGGLE],
				extension_links: [{ id: 1, extender_id: 11, extended_id: 10 }],
				overrides: []
			},
			{
				id: 12,
				slug: 'app-93',
				name: 'Built on app-92',
				toggles: ['hide:phone'],
				extension_links: [{ id: 2, extender_id: 12, extended_id: 11 }],
				overrides: []
			}
		]
	};
}

describe('the anonymous toggle', () => {
	it('is set and cleared without touching the other toggles', () => {
		expect(withAnonymous(['hide:phone', 'nationality'], true)).toEqual([
			'hide:phone',
			'nationality',
			ANONYMOUS_TOGGLE
		]);
		expect(withAnonymous(['hide:phone', ANONYMOUS_TOGGLE], false)).toEqual(['hide:phone']);
		expect(withAnonymous(null, true)).toEqual([ANONYMOUS_TOGGLE]);
		expect(withAnonymous([ANONYMOUS_TOGGLE], true)).toEqual([ANONYMOUS_TOGGLE]);
	});

	it('reaches the versions built on an anonymous one, and not the one it builds on', () => {
		const { profile_versions: versions } = profile();
		expect(isAnonymousChain(versions, 11)).toBe(true);
		expect(isAnonymousChain(versions, 12)).toBe(true);
		expect(isAnonymousChain(versions, 10)).toBe(false);
		expect(isAnonymousChain(versions, null)).toBe(false);
		expect(isAnonymous(versions[1].toggles)).toBe(true);
	});
});

describe('identityOf', () => {
	it('collects the handles and host a link to the applicant would carry', () => {
		const identity = identityOf(profile());
		expect(identity.name).toBe('Alex Morgan');
		expect(identity.companyName).toBe('Morgan Digital');
		expect(identity.linkMarks.sort()).toEqual(['alex-morgan-eng', 'alexmorgan.dev', 'amorgan77']);
	});
});

describe('isOwnBusiness', () => {
	const identity = identityOf(profile());

	it('is the company on the profile, or a name that contains the full name', () => {
		expect(isOwnBusiness('Morgan Digital', identity)).toBe(true);
		expect(isOwnBusiness('Alex Morgan Software', identity)).toBe(true);
		expect(isOwnBusiness('alex  morgan', identity)).toBe(true);
	});

	it('is not a company that only shares a first or last name', () => {
		expect(isOwnBusiness('Morgan Stanley', identity)).toBe(false);
		expect(isOwnBusiness('Alexander Morganson BV', identity)).toBe(false);
		expect(isOwnBusiness('Acme', identity)).toBe(false);
		expect(isOwnBusiness(null, identity)).toBe(false);
	});
});

describe('leadsToApplicant', () => {
	const identity = identityOf(profile());

	it('is a link under their handle or on their own site', () => {
		expect(leadsToApplicant('https://github.com/amorgan77/tool', identity)).toBe(true);
		expect(leadsToApplicant('https://alexmorgan.dev/blog', identity)).toBe(true);
		expect(leadsToApplicant('https://example.org/', identity)).toBe(false);
	});
});

describe('anonymiseTree', () => {
	function anonymised(locale: string | null = 'nl') {
		const source = profile();
		const page: Record<string, unknown> = { ...source };
		anonymiseTree(page, identityOf(source), locale);
		return { page, source };
	}

	it('leaves out who the applicant is and where they live', () => {
		const { page } = anonymised();
		for (const field of [
			'name',
			'email_address',
			'phone_number',
			'location',
			'location_timezone',
			'personal_website',
			'linkedin_profile',
			'github_profile',
			'stackoverflow_profile',
			'nationality',
			'profile_photo_path'
		]) {
			expect(page[field], field).toBeNull();
		}
		expect(page.references).toEqual([]);
		expect(page.highlights).toEqual([]);
		// What the document is about stays.
		expect(page.title).toBe('Senior Engineer');
		expect(page.summary).toBe('Engineer with ten years of experience.');
	});

	it("prints the applicant's own business without its name, place, site or links", () => {
		const { page } = anonymised();
		const [own, other, company] = page.work_experiences as Array<Record<string, unknown>>;
		expect(own).toMatchObject({
			name: 'Eigen onderneming',
			location: null,
			website: null,
			work_experience_projects: [{ id: 9, url: null }]
		});
		expect(company).toMatchObject({ name: 'Eigen onderneming', location: null });
		expect(other).toMatchObject({
			name: 'Acme',
			location: 'Amsterdam, NL',
			website: 'https://acme.example'
		});
	});

	it('names the business in the language of the document', () => {
		const { page } = anonymised(null);
		expect((page.work_experiences as Array<{ name: string }>)[0].name).toBe('Own business');
	});

	it('drops the links that lead to the applicant and keeps the rest', () => {
		const { page } = anonymised();
		expect(page.side_projects).toMatchObject([
			{ name: 'Tool', url: null },
			{ name: 'Site', url: 'https://example.org/' }
		]);
		expect(page.certificates).toMatchObject([{ name: 'English', url: null, credential_id: null }]);
	});

	it('leaves the tree it was given alone', () => {
		const { source } = anonymised();
		expect(source.name).toBe('Alex Morgan');
		expect(source.work_experiences[0].name).toBe('Alex Morgan Software');
		expect(source.side_projects[0].url).toBe('https://github.com/amorgan77/tool');
	});
});

describe('pageProfile on an anonymous version', () => {
	it('carries nothing that names the applicant', () => {
		const page = pageProfile(profile(), 12, 'en');
		expect(pageIsAnonymous(page)).toBe(true);
		const source = JSON.stringify(page).toLowerCase();
		for (const mark of ['alex', 'morgan', 'utrecht', 'sam lee', '+31', 'dutch']) {
			expect(source, mark).not.toContain(mark);
		}
	});

	it('leaves a document that is not anonymous as it was', () => {
		const page = pageProfile(profile(), 10, 'en');
		expect(pageIsAnonymous(page)).toBe(false);
		expect(page.name).toBe('Alex Morgan');
		expect((page.work_experiences as Array<{ name: string }>)[0].name).toBe('Alex Morgan Software');
	});
});

describe('anonymousTemplate', () => {
	it("drops the brand's contact points and keeps its dress", () => {
		const template = {
			id: 1,
			name: 'Brand',
			slug: 'brand',
			config: { accent: '#ff0', contact: { email: 'alex@brand.example' } }
		};
		expect(anonymousTemplate(template).config).toEqual({ accent: '#ff0', contact: {} });
		expect(template.config.contact).toEqual({ email: 'alex@brand.example' });
		expect(anonymousTemplate(null)).toBeNull();
	});
});
