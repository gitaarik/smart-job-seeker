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

// ── Per-version overrides (job-tailored versions) ──
//
// Tags are the applicant's general rule; an override is one application's
// exception to it. These assert the exception wins in both directions, that a
// list without ordering opinions is left exactly as it was, and that a tailored
// version beats the library version it extends.

type Row = { id: number; name: string; tags?: string[] | null };

const TAILORED = [
	{ id: 1, slug: 'frontend', toggles: [], extension_links: [] },
	{
		id: 10,
		slug: 'app-45',
		toggles: [],
		extension_links: [{ extended_id: 1 }],
		overrides: [] as Array<Record<string, unknown>>
	}
];

function tailoredFilter(overrides: Array<Record<string, unknown>>, versionSlug = 'app-45') {
	const versions = TAILORED.map((v) => (v.id === 10 ? { ...v, overrides } : v));
	return createProfileFilter(versions, 'resume', null, versionSlug);
}

describe('filterOnTags — per-version overrides', () => {
	const PROFILE_ONLY = ['!resume', '!cv'];

	it('leaves lists untouched when the version carries no overrides', () => {
		const rows: Row[] = [
			{ id: 1, name: 'React' },
			{ id: 2, name: 'SQL' }
		];
		expect(
			tailoredFilter([])
				.filterOnTags(rows, 'tech_skill')
				.map((r) => r.name)
		).toEqual(['React', 'SQL']);
	});

	it('ignores overrides for callers that pass no entity type', () => {
		// Every pre-existing call site is exactly this: no entity type, so the
		// tag behaviour must be bit-identical to before overrides existed.
		const rows: Row[] = [{ id: 1, name: 'React' }];
		const filter = tailoredFilter([{ entity_type: 'tech_skill', entity_id: 1, action: 'exclude' }]);
		expect(filter.filterOnTags(rows)).toHaveLength(1);
		expect(filter.filterOnTags(rows, 'tech_skill')).toHaveLength(0);
	});

	it('re-admits a profile-only skill without touching its tags', () => {
		// The whole point of the sidecar: this job requires Kubernetes, which is
		// held back from every document, and the tailored version shows it while
		// the shared tag array stays as the applicant wrote it.
		const rows: Row[] = [{ id: 7, name: 'Kubernetes', tags: PROFILE_ONLY }];
		const overrides = [{ entity_type: 'tech_skill', entity_id: 7, action: 'include' }];
		expect(tailoredFilter(overrides).filterOnTags(rows, 'tech_skill')).toHaveLength(1);
		// The library version it extends is unaffected.
		expect(tailoredFilter(overrides, 'frontend').filterOnTags(rows, 'tech_skill')).toHaveLength(0);
	});

	it('drops an item the tags would have shown', () => {
		const rows: Row[] = [
			{ id: 1, name: 'WordPress' },
			{ id: 2, name: 'React' }
		];
		const overrides = [{ entity_type: 'tech_skill', entity_id: 1, action: 'exclude' }];
		expect(
			tailoredFilter(overrides)
				.filterOnTags(rows, 'tech_skill')
				.map((r) => r.name)
		).toEqual(['React']);
	});

	it('keys overrides by entity type, so ids from different tables cannot collide', () => {
		const rows: Row[] = [{ id: 1, name: 'React' }];
		const overrides = [{ entity_type: 'side_project', entity_id: 1, action: 'exclude' }];
		expect(tailoredFilter(overrides).filterOnTags(rows, 'tech_skill')).toHaveLength(1);
	});

	it('orders by the per-version sort, keeping unsorted items behind in place', () => {
		const rows: Row[] = [
			{ id: 1, name: 'first' },
			{ id: 2, name: 'second' },
			{ id: 3, name: 'third' }
		];
		const overrides = [
			{ entity_type: 'work_experience_achievement', entity_id: 3, action: 'include', sort: 0 },
			{ entity_type: 'work_experience_achievement', entity_id: 1, action: 'include', sort: 1 }
		];
		expect(
			tailoredFilter(overrides)
				.filterOnTags(rows, 'work_experience_achievement')
				.map((r) => r.name)
		).toEqual(['third', 'first', 'second']);
	});

	it('treats the sort as an index, so an item can land in the middle', () => {
		// The case a sort KEY cannot express: put "SQL" after the SQL cluster
		// without renumbering — and without claiming anything about the rest.
		const rows: Row[] = [
			{ id: 1, name: 'PostgreSQL' },
			{ id: 2, name: 'MySQL' },
			{ id: 3, name: 'SQL optimization' },
			{ id: 4, name: 'MongoDB' },
			{ id: 5, name: 'SQL' }
		];
		const overrides = [{ entity_type: 'tech_skill', entity_id: 5, action: 'include', sort: 3 }];
		expect(
			tailoredFilter(overrides)
				.filterOnTags(rows, 'tech_skill')
				.map((r) => r.name)
		).toEqual(['PostgreSQL', 'MySQL', 'SQL optimization', 'SQL', 'MongoDB']);
	});

	it('clamps a sort past the end rather than dropping the item', () => {
		const rows: Row[] = [
			{ id: 1, name: 'first' },
			{ id: 2, name: 'second' }
		];
		const overrides = [{ entity_type: 'tech_skill', entity_id: 2, action: 'include', sort: 99 }];
		expect(
			tailoredFilter(overrides)
				.filterOnTags(rows, 'tech_skill')
				.map((r) => r.name)
		).toEqual(['first', 'second']);
	});

	it('does not reorder when no override carries a sort', () => {
		const rows: Row[] = [
			{ id: 1, name: 'first' },
			{ id: 2, name: 'second' }
		];
		const overrides = [
			{ entity_type: 'work_experience_achievement', entity_id: 2, action: 'include' }
		];
		expect(
			tailoredFilter(overrides)
				.filterOnTags(rows, 'work_experience_achievement')
				.map((r) => r.name)
		).toEqual(['first', 'second']);
	});

	it("lets the tailored version's own decision beat the version it extends", () => {
		const rows: Row[] = [{ id: 1, name: 'WordPress' }];
		const versions = [
			{
				id: 1,
				slug: 'frontend',
				toggles: [],
				extension_links: [],
				overrides: [{ entity_type: 'tech_skill', entity_id: 1, action: 'exclude' }]
			},
			{
				id: 10,
				slug: 'app-45',
				toggles: [],
				extension_links: [{ extended_id: 1 }],
				overrides: [{ entity_type: 'tech_skill', entity_id: 1, action: 'include' }]
			}
		];
		expect(
			createProfileFilter(versions, 'resume', null, 'app-45').filterOnTags(rows, 'tech_skill')
		).toHaveLength(1);
		expect(
			createProfileFilter(versions, 'resume', null, 'frontend').filterOnTags(rows, 'tech_skill')
		).toHaveLength(0);
	});
});
