/**
 * What a page that renders the profile may carry.
 *
 * The page source of a public CV carried the applicant's salary asks, home
 * address, KvK and VAT numbers, and the name of every application-tailored
 * version they had made. Nothing printed any of it, so nothing on the page
 * showed it was there; it is asserted here for the same reason.
 */

import { describe, expect, it, vi } from 'vitest';
import { getTableColumns } from 'drizzle-orm';
import { profiles } from '$lib/server/db/schema';

vi.mock('$lib/server/db', () => ({
	db: {},
	dbDirect: {}
}));

const { PAGE_PROFILE_COLUMNS, PRIVATE_PROFILE_COLUMNS, pageProfile } =
	await import('../page-profile');

/** A version as getProfileByIdentifier loads it. */
function version(id: number, slug: string, name: string, extends_: number[] = [], more = {}) {
	return {
		id,
		slug,
		name,
		status: 'published',
		profile_id: 1,
		toggles: null,
		extension_links: extends_.map((extended_id, i) => ({
			id: id * 10 + i,
			extender_id: id,
			extended_id
		})),
		overrides: [] as unknown[],
		...more
	};
}

function tree() {
	return {
		id: 1,
		slug: 'alex-morgan',
		name: 'Alex Morgan',
		title: 'Engineer',
		user_id: 'u-1',
		salary_employed: { amount: 7000 },
		salary_freelance: { unit: 'hour', amount: 100 },
		street_address: 'Main Street 1',
		postal_code: '1234 AB',
		kvk_number: '12345678',
		vat_id: 'NL000000000B01',
		browser_user_agent: 'Mozilla/5.0',
		field_variants: [{ id: 5, field: 'title', text: 'Another title' }],
		work_experiences: [{ id: 3, name: 'Acme' }],
		profile_versions: [
			version(10, 'fullstack', 'Full-stack Engineer'),
			version(11, 'app-92', 'Automation Engineer — Some Employer', [10], {
				overrides: [
					{
						id: 1,
						version_id: 11,
						entity_type: 'work_experience',
						entity_id: 3,
						action: 'include',
						sort: 0,
						reason: 'the most relevant thing for this job',
						source: 'ai'
					}
				]
			}),
			version(12, 'app-81', 'AI Engineer — Another Employer', [10])
		]
	};
}

describe('PAGE_PROFILE_COLUMNS and PRIVATE_PROFILE_COLUMNS', () => {
	it('decide about every column of the profile row, once', () => {
		const decided = [...PAGE_PROFILE_COLUMNS, ...PRIVATE_PROFILE_COLUMNS];
		expect(new Set(decided).size).toBe(decided.length);
		// A column in neither list fails here: decide whether a page may carry
		// it, and put it in one of them.
		expect([...decided].sort()).toEqual(Object.keys(getTableColumns(profiles)).sort());
	});
});

describe('pageProfile', () => {
	it('leaves out the private columns and the wording library', () => {
		const page = pageProfile(tree(), 11) as Record<string, unknown>;
		for (const column of PRIVATE_PROFILE_COLUMNS) expect(page).not.toHaveProperty(column);
		expect(page).not.toHaveProperty('field_variants');
		expect(page.name).toBe('Alex Morgan');
		expect(page.work_experiences).toEqual([{ id: 3, name: 'Acme' }]);
	});

	it('carries only the versions the page renders with, without their names or reasons', () => {
		const page = pageProfile(tree(), 11);
		expect(page.profile_versions.map((v) => v.slug)).toEqual(['fullstack', 'app-92']);
		expect(JSON.stringify(page)).not.toContain('Employer');
		expect(page.profile_versions[1].overrides).toEqual([
			{ entity_type: 'work_experience', entity_id: 3, action: 'include', sort: 0 }
		]);
		expect(JSON.stringify(page)).not.toContain('relevant');
	});

	it('carries no version for a page that renders none', () => {
		expect(pageProfile(tree(), null).profile_versions).toEqual([]);
	});

	it('leaves the tree it was given alone', () => {
		const original = tree();
		pageProfile(original, 11);
		expect(original.salary_employed).toEqual({ amount: 7000 });
		expect(original.profile_versions).toHaveLength(3);
	});
});
