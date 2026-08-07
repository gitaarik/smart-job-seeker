import { describe, expect, it } from 'vitest';
import { createProfileFilter } from './profile-filter';

type Item = { name: string; tags?: string[] | null };

// A minimal profile with two standalone versions ("frontend", "backend") and
// one ("senior") that extends "frontend" via the extension chain.
const VERSIONS = [
	{ id: 1, slug: 'frontend', toggles: [], extension_links: [] },
	{ id: 2, slug: 'backend', toggles: [], extension_links: [] },
	{ id: 3, slug: 'senior', toggles: [], extension_links: [{ extended_id: 1 }] }
];

// Render as the given base template ("resume"/"cv") and version slug.
function filterFor(type: string, versionSlug: string, items: Item[]): Item[] {
	return createProfileFilter(VERSIONS, type, null, versionSlug).filterOnTags(items);
}

describe('filterOnTags — version include/exclude for skills', () => {
	it('shows untagged items on every version', () => {
		const items: Item[] = [{ name: 'TypeScript' }, { name: 'SQL', tags: null }];
		expect(filterFor('resume', 'frontend', items).map((i) => i.name)).toEqual([
			'TypeScript',
			'SQL'
		]);
	});

	it('hides a skill excluded from the viewed version (!slug)', () => {
		const items: Item[] = [{ name: 'jQuery', tags: ['!frontend'] }, { name: 'React' }];
		// On the frontend version, jQuery is hidden.
		expect(filterFor('resume', 'frontend', items).map((i) => i.name)).toEqual(['React']);
		// On any other version, the exclusion doesn't apply.
		expect(filterFor('resume', 'backend', items).map((i) => i.name)).toEqual(['jQuery', 'React']);
	});

	it('treats a positive slug as a whitelist (show only on that version)', () => {
		const items: Item[] = [{ name: 'Kubernetes', tags: ['backend'] }];
		expect(filterFor('resume', 'backend', items)).toHaveLength(1);
		expect(filterFor('resume', 'frontend', items)).toHaveLength(0);
	});

	it('lets a negation win over a positive include for the same version', () => {
		// Contradictory tags: whitelisted to backend but also excluded from it.
		const items: Item[] = [{ name: 'Legacy', tags: ['backend', '!backend'] }];
		expect(filterFor('resume', 'backend', items)).toHaveLength(0);
	});

	it('applies exclusion through the extension chain', () => {
		// "senior" extends "frontend", so a skill excluded from frontend is also
		// hidden when viewing the senior version.
		const items: Item[] = [{ name: 'jQuery', tags: ['!frontend'] }];
		expect(filterFor('resume', 'senior', items)).toHaveLength(0);
	});

	it('restricts by base template via the resume/cv tags', () => {
		const items: Item[] = [{ name: 'Publications', tags: ['cv'] }];
		expect(filterFor('cv', 'frontend', items)).toHaveLength(1);
		expect(filterFor('resume', 'frontend', items)).toHaveLength(0);
	});

	it('keeps a version-restricted skill off the plain base document', () => {
		// No version is being viewed, so nothing satisfies the whitelist.
		const items: Item[] = [{ name: 'Kubernetes', tags: ['backend'] }];
		expect(filterFor('resume', '', items)).toHaveLength(0);
	});
});

describe('filterOnTags — profile-only skills', () => {
	// Kept for matching, off every document: the `!resume` + `!cv` pair.
	const PROFILE_ONLY = ['!resume', '!cv'];

	it('hides a profile-only skill on both base templates', () => {
		const items: Item[] = [{ name: 'Kubernetes', tags: PROFILE_ONLY }];
		expect(filterFor('resume', '', items)).toHaveLength(0);
		expect(filterFor('cv', '', items)).toHaveLength(0);
		expect(filterFor('resume', 'frontend', items)).toHaveLength(0);
		expect(filterFor('cv', 'senior', items)).toHaveLength(0);
	});

	it('re-admits a profile-only skill on an explicitly tagged version', () => {
		const items: Item[] = [{ name: 'Kubernetes', tags: [...PROFILE_ONLY, 'backend'] }];
		expect(filterFor('resume', 'backend', items)).toHaveLength(1);
		expect(filterFor('cv', 'backend', items)).toHaveLength(1);
		// Every other document still hides it.
		expect(filterFor('resume', 'frontend', items)).toHaveLength(0);
		expect(filterFor('resume', '', items)).toHaveLength(0);
	});

	it('re-admits through the extension chain', () => {
		// "senior" extends "frontend", so tagging frontend covers senior too.
		const items: Item[] = [{ name: 'Kubernetes', tags: [...PROFILE_ONLY, 'frontend'] }];
		expect(filterFor('resume', 'senior', items)).toHaveLength(1);
	});

	it('lets a version exclusion override the re-admit', () => {
		const items: Item[] = [{ name: 'Kubernetes', tags: [...PROFILE_ONLY, 'frontend', '!senior'] }];
		expect(filterFor('resume', 'frontend', items)).toHaveLength(1);
		expect(filterFor('resume', 'senior', items)).toHaveLength(0);
	});
});
