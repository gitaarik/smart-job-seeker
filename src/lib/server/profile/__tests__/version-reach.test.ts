/**
 * What a document leaves out, and what it shows.
 *
 * `relevantExclusionsByVersion` is the warning beside the version you are about
 * to send: this one omits work that speaks to this job. `versionItemStates` is
 * the panel that lists every item and why it is in the state it is in. Both
 * read the same layers the renderer does — item tags, then the version's, then
 * the override sidecar — and both are worth nothing if they disagree with what
 * actually prints, so neither re-derives visibility and neither is tested here
 * as though it did.
 *
 * The numbers below are chosen against the real tuning constants (floor 0.50,
 * template hold-back 0.25 of the earned margin), because a fixture that dodges
 * them tests arithmetic nobody ships.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';

const { find, dbMock, mockGetProfile, mockSemantic } = vi.hoisted(() => {
	const find = {
		applications: { findFirst: vi.fn() },
		profile_versions: { findFirst: vi.fn() },
		profile_version_overrides: { findMany: vi.fn() }
	};
	return {
		find,
		dbMock: { query: find },
		mockGetProfile: vi.fn(),
		mockSemantic: vi.fn()
	};
});

vi.mock('$lib/server/db', () => ({ dbDirect: dbMock, queryRaw: vi.fn() }));
vi.mock('$lib/server/profile/default', () => ({
	getProfileByIdentifier: (...args: unknown[]) => mockGetProfile(...args)
}));
vi.mock('$lib/server/ai-chat/utils', () => ({ createAndGenerateAiChat: vi.fn() }));
vi.mock('$lib/server/documents/content-embeddings', () => ({
	semanticScoreUnits: (...args: unknown[]) => mockSemantic(...args),
	poolKey: (type: string, id: number) => `${type}:${id}`
}));
vi.mock('$lib/server/documents/content-retrieval', () => ({
	scoreUnitAgainstQuery: vi.fn(() => 0)
}));

import { OVERRIDE_ENTITIES } from '$lib/version-overrides';
import { relevantExclusionsByVersion, versionItemStates } from '../tailor-version';
import {
	bullet,
	category,
	profileFixture,
	project,
	role,
	skill,
	version,
	type ProfileFixture
} from './version-fixtures';

const JOB = {
	id: 9,
	title: 'Data Platform Engineer',
	company: 'Acme',
	job_description: 'Build and run data pipelines.',
	skills_required: ['Python'],
	skills_preferred: ['Airflow'],
	responsibilities: ['Own the warehouse']
};

/** The score every candidate gets, by `type:id`; anything unlisted scores 0. */
function scores(map: Record<string, number>) {
	mockSemantic.mockResolvedValue(new Map(Object.entries(map)));
}

function bulletKey(id: number) {
	return `${OVERRIDE_ENTITIES.achievement}:${id}`;
}

function projectKey(id: number) {
	return `${OVERRIDE_ENTITIES.sideProject}:${id}`;
}

beforeEach(() => {
	vi.clearAllMocks();
	find.applications.findFirst.mockResolvedValue({ id: 12, job: JOB });
	find.profile_versions.findFirst.mockResolvedValue({ id: 5 });
	find.profile_version_overrides.findMany.mockResolvedValue([]);
	mockSemantic.mockResolvedValue(new Map());
});

// ─────────────────────────────────────────────────────────────────────────────
// relevantExclusionsByVersion
// ─────────────────────────────────────────────────────────────────────────────

describe('relevantExclusionsByVersion', () => {
	/**
	 * One role this version prints, holding the two bullets whose scores set the
	 * bar: sorted [0.56, 0.60], median 0.60, so the bar is 0.60 rather than the
	 * 0.50 floor.
	 */
	function baseProfile(over: Partial<ProfileFixture> = {}): ProfileFixture {
		return profileFixture({
			work_experiences: [
				role(1, 'Engineer', [
					bullet(10, 'Shipped the pipeline'),
					bullet(11, 'Ran the on-call rota'),
					// Whitelisted onto a different version, so this one hides it.
					bullet(12, 'Built the warehouse', ['other-version'])
				])
			],
			profile_versions: [version(3, 'v1'), version(4, 'other-version')],
			...over
		});
	}

	function reach(profile: ProfileFixture = baseProfile()) {
		mockGetProfile.mockResolvedValue(profile);
		return relevantExclusionsByVersion({ profileId: 1, applicationId: 12, versionSlugs: ['v1'] });
	}

	it('reports the relevant work this version does not print', async () => {
		scores({ [bulletKey(10)]: 0.6, [bulletKey(11)]: 0.56, [bulletKey(12)]: 0.8 });

		const result = await reach();

		expect(result.exclusions['resume:v1']).toEqual([
			expect.objectContaining({
				entityType: OVERRIDE_ENTITIES.achievement,
				entityId: 12,
				score: 0.8
			})
		]);
	});

	// The bar is the median of what the document already prints, not the floor:
	// "somewhat about this job" is most of a career, and a warning that fires on
	// it is noise.
	it('says nothing about a hidden item no better than what is already shown', async () => {
		scores({ [bulletKey(10)]: 0.6, [bulletKey(11)]: 0.56, [bulletKey(12)]: 0.58 });

		const result = await reach();

		expect(result.exclusions['resume:v1']).toBeUndefined();
	});

	// The tailored version hid it on purpose, with a reason the applicant can
	// read in the diff. Warning about it would have the page argue with itself.
	it('does not warn about something the version already decided against', async () => {
		scores({ [bulletKey(10)]: 0.6, [bulletKey(11)]: 0.56, [bulletKey(12)]: 0.8 });
		const decided = baseProfile({
			profile_versions: [
				version(3, 'v1', {
					overrides: [
						{ entity_type: OVERRIDE_ENTITIES.achievement, entity_id: 12, action: 'exclude' }
					]
				}),
				version(4, 'other-version')
			]
		});

		const result = await reach(decided);

		expect(result.exclusions['resume:v1']).toBeUndefined();
	});

	it('reports the best few rather than everything', async () => {
		const many = baseProfile({
			work_experiences: [
				role(1, 'Engineer', [
					bullet(10, 'Shipped the pipeline'),
					bullet(11, 'Ran the on-call rota'),
					...[20, 21, 22, 23, 24, 25].map((id) => bullet(id, `hidden ${id}`, ['other-version']))
				])
			],
			profile_versions: [version(3, 'v1'), version(4, 'other-version')]
		});
		scores({
			[bulletKey(10)]: 0.6,
			[bulletKey(11)]: 0.56,
			[bulletKey(20)]: 0.71,
			[bulletKey(21)]: 0.75,
			[bulletKey(22)]: 0.73,
			[bulletKey(23)]: 0.79,
			[bulletKey(24)]: 0.77,
			[bulletKey(25)]: 0.9
		});

		const reported = (await reach(many)).exclusions['resume:v1'];

		expect(reported).toHaveLength(4);
		expect(reported.map((r) => r.entityId)).toEqual([25, 23, 24, 21]);
	});

	// A skill's absence costs a keyword; a bullet's costs the proof. The skills
	// strip already answers the first, by exact name and for free.
	it('is about evidence, never about skills', async () => {
		const withSkills = baseProfile({
			tech_skill_categories: [
				category(7, 'Backend', [skill(70, 'Python', ['other-version']), skill(71, 'Go')])
			]
		});
		scores({
			[bulletKey(10)]: 0.6,
			[bulletKey(11)]: 0.56,
			[`${OVERRIDE_ENTITIES.skill}:70`]: 0.99,
			[`${OVERRIDE_ENTITIES.skillCategory}:7`]: 0.99
		});

		const result = await reach(withSkills);

		const reported = Object.values(result.exclusions).flat();
		expect(reported.every((r) => r.entityType !== OVERRIDE_ENTITIES.skill)).toBe(true);
		expect(reported.every((r) => r.entityType !== OVERRIDE_ENTITIES.skillCategory)).toBe(true);
	});

	it('counts a side project the version leaves out', async () => {
		const withProject = baseProfile({
			side_projects: [project(30, 'Warehouse toolkit', { tags: ['other-version'] })]
		});
		scores({ [bulletKey(10)]: 0.6, [bulletKey(11)]: 0.56, [projectKey(30)]: 0.85 });

		const result = await reach(withProject);

		expect(result.exclusions['resume:v1'].map((r) => r.entityId)).toContain(30);
	});

	describe('what no amount of tailoring will reach', () => {
		/**
		 * Two roles the applicant keeps off this document themselves: one for the
		 * CV only, one off every document. A run may not turn either on, so their
		 * bullets are counted and their containers named.
		 */
		function heldBack() {
			return baseProfile({
				work_experiences: [
					role(1, 'Engineer', [
						bullet(10, 'Shipped the pipeline'),
						bullet(11, 'Ran the on-call rota')
					]),
					role(2, 'Contractor', [bullet(20, 'Built a warehouse'), bullet(21, 'Tuned Spark')], {
						tags: ['!resume']
					}),
					role(3, 'Volunteer', [bullet(30, 'Taught Python')], { tags: ['!resume', '!cv'] })
				]
			});
		}

		beforeEach(() => {
			scores({
				[bulletKey(10)]: 0.6,
				[bulletKey(11)]: 0.56,
				[bulletKey(20)]: 0.9,
				[bulletKey(21)]: 0.85,
				[bulletKey(30)]: 0.95
			});
		});

		it('counts them, and names what is holding them', async () => {
			const result = await reach(heldBack());

			expect(result.outOfReach['resume:v1']).toBe(3);
			expect(result.heldBackParents['resume:v1']).toEqual([
				{
					entityType: OVERRIDE_ENTITIES.workExperience,
					entityId: 2,
					label: 'Contractor at Company 2',
					count: 2,
					reason: 'template'
				},
				{
					entityType: OVERRIDE_ENTITIES.workExperience,
					entityId: 3,
					label: 'Volunteer at Company 3',
					count: 1,
					reason: 'profile'
				}
			]);
		});

		// "CV only" and "off every document" are different statements, and the
		// strip says which — one is a document-type decision, the other is about
		// the item itself.
		it('tells the two kinds of hold-back apart', async () => {
			const result = await reach(heldBack());
			const reasons = result.heldBackParents['resume:v1'].map((p) => p.reason);

			expect(reasons).toEqual(['template', 'profile']);
		});

		// The same profile read as a CV: the contractor role prints there, so
		// nothing about it is out of reach.
		it('answers per document, not per profile', async () => {
			const result = await reach(heldBack());

			expect(result.heldBackParents['cv:v1']?.map((p) => p.entityId) ?? []).not.toContain(2);
		});

		// It is hidden by a version tag, which a run may simply turn on — so it
		// belongs in the warning, not in the count of what is unreachable.
		it('does not count what a run could still bring back', async () => {
			const result = await reach();

			expect(result.outOfReach['resume:v1']).toBeUndefined();
		});
	});

	describe('nothing to say', () => {
		it('when the application is gone, or has no job', async () => {
			mockGetProfile.mockResolvedValue(baseProfile());
			find.applications.findFirst.mockResolvedValue(undefined);
			expect(
				await relevantExclusionsByVersion({ profileId: 1, applicationId: 12, versionSlugs: ['v1'] })
			).toEqual({ exclusions: {}, outOfReach: {}, heldBackParents: {} });

			find.applications.findFirst.mockResolvedValue({ id: 12, job: null });
			expect(
				await relevantExclusionsByVersion({ profileId: 1, applicationId: 12, versionSlugs: ['v1'] })
			).toEqual({ exclusions: {}, outOfReach: {}, heldBackParents: {} });
		});

		it('when the profile is gone', async () => {
			mockGetProfile.mockResolvedValue(null);
			expect(
				await relevantExclusionsByVersion({ profileId: 1, applicationId: 12, versionSlugs: ['v1'] })
			).toEqual({ exclusions: {}, outOfReach: {}, heldBackParents: {} });
		});

		// Scoring a document against an empty query ranks nothing; every item
		// would tie, and the warning would be arbitrary.
		it('when the job says nothing to rank against', async () => {
			mockGetProfile.mockResolvedValue(baseProfile());
			find.applications.findFirst.mockResolvedValue({
				id: 12,
				job: {
					id: 9,
					title: '',
					job_description: '',
					skills_required: [],
					skills_preferred: [],
					responsibilities: []
				}
			});

			const result = await relevantExclusionsByVersion({
				profileId: 1,
				applicationId: 12,
				versionSlugs: ['v1']
			});

			expect(result).toEqual({ exclusions: {}, outOfReach: {}, heldBackParents: {} });
			expect(mockSemantic).not.toHaveBeenCalled();
		});
	});
});

// ─────────────────────────────────────────────────────────────────────────────
// versionItemStates
// ─────────────────────────────────────────────────────────────────────────────

describe('versionItemStates', () => {
	function states(profile: ProfileFixture, over: Record<string, unknown> = {}) {
		mockGetProfile.mockResolvedValue(profile);
		return versionItemStates({
			profileId: 1,
			applicationId: 12,
			docType: 'resume',
			versionSlug: 'v1',
			...over
		});
	}

	const oneRole = () =>
		profileFixture({
			work_experiences: [
				role(
					1,
					'Engineer',
					[bullet(10, 'Shipped the pipeline'), bullet(11, 'Hid this one', ['cv'])],
					{
						start_date: '2019-03-01',
						end_date: '2023-06-30'
					}
				)
			],
			profile_versions: [version(3, 'v1')]
		});

	it('says nothing about a profile that is not there', async () => {
		mockGetProfile.mockResolvedValue(null);
		expect(
			await versionItemStates({
				profileId: 1,
				applicationId: null,
				docType: 'resume',
				versionSlug: 'v1'
			})
		).toEqual([]);
	});

	it('groups the bullets under their role, with the years and the role’s own state', async () => {
		const [group] = await states(oneRole());

		expect(group).toMatchObject({
			key: `${OVERRIDE_ENTITIES.workExperience}:1`,
			entityType: OVERRIDE_ENTITIES.workExperience,
			entityId: 1,
			title: 'Engineer at Company 1',
			subtitle: '2019 – 2023',
			on: true
		});
		expect(group.rows).toHaveLength(2);
	});

	it('says "now" for a role that has not ended', async () => {
		const current = profileFixture({
			work_experiences: [role(1, 'Engineer', [bullet(10, 'Still shipping')])],
			profile_versions: [version(3, 'v1')]
		});

		const [group] = await states(current);
		expect(group.subtitle).toBe('2018 – now');
	});

	// The group already names the role; repeating it in every row is noise.
	it('strips the role name off each row', async () => {
		const [group] = await states(oneRole());

		expect(group.rows[0].label).toBe('Shipped the pipeline');
	});

	describe('why an item is in the state it is in', () => {
		it('names the document type when that is what holds it back', async () => {
			const [group] = await states(oneRole());

			expect(group.rows[1]).toMatchObject({
				on: false,
				source: 'base',
				reason: 'only on your CV'
			});
		});

		it('names the version when that is what holds it back', async () => {
			const onOther = profileFixture({
				work_experiences: [role(1, 'Engineer', [bullet(10, 'Elsewhere only', ['other-version'])])],
				profile_versions: [version(3, 'v1'), version(4, 'other-version')]
			});

			const [group] = await states(onOther);
			expect(group.rows[0]).toMatchObject({ on: false, reason: 'not on this version' });
		});

		// The group says it once. Repeating it per row would name the wrong tag,
		// and point at the wrong fix.
		it('stays quiet when the role itself is what is hidden', async () => {
			const hiddenRole = profileFixture({
				work_experiences: [
					role(1, 'Engineer', [bullet(10, 'Shipped the pipeline')], { tags: ['!resume'] })
				],
				profile_versions: [version(3, 'v1')]
			});

			const [group] = await states(hiddenRole);
			expect(group.on).toBe(false);
			expect(group.rows[0]).toMatchObject({ on: false, reason: '' });
		});

		it('credits the decision to whoever made it', async () => {
			find.profile_version_overrides.findMany.mockResolvedValue([
				{
					entity_type: OVERRIDE_ENTITIES.achievement,
					entity_id: 10,
					action: 'exclude',
					reason: 'trimmed to fit the page',
					source: 'ai'
				},
				{
					entity_type: OVERRIDE_ENTITIES.achievement,
					entity_id: 11,
					action: 'include',
					reason: 'you chose to show this',
					source: 'user'
				}
			]);

			const [group] = await states(oneRole());

			expect(group.rows[0]).toMatchObject({
				source: 'tailoring',
				reason: 'trimmed to fit the page'
			});
			expect(group.rows[1]).toMatchObject({ source: 'user', reason: 'you chose to show this' });
		});
	});

	// A role with nothing under it cannot be read off its bullets, and turning it
	// on is the whole reason to look at the panel.
	it('lists an empty role only when it is the thing that is off', async () => {
		const empty = profileFixture({
			work_experiences: [role(1, 'Engineer', [], { tags: ['!resume'] }), role(2, 'Advisor', [])],
			profile_versions: [version(3, 'v1')]
		});

		const groups = await states(empty);

		expect(groups.map((g) => g.entityId)).toEqual([1]);
		expect(groups[0].on).toBe(false);
	});

	it('gives the side projects a group of their own', async () => {
		const withProjects = profileFixture({
			side_projects: [project(30, 'Warehouse toolkit')],
			profile_versions: [version(3, 'v1')]
		});

		const groups = await states(withProjects);

		expect(groups).toHaveLength(1);
		expect(groups[0]).toMatchObject({ key: 'side-projects', entityType: null, on: true });
		expect(groups[0].rows[0]).toMatchObject({ entityId: 30, on: true });
	});

	it('carries each item’s relevance to the job', async () => {
		mockSemantic.mockResolvedValue(new Map([[bulletKey(10), 0.66]]));

		const [group] = await states(oneRole());

		expect(group.rows[0].score).toBe(0.66);
	});

	// The panel is the only place to see what prints, so it has to work before
	// there is a job to rank against.
	it('works with no application at all, and scores nothing', async () => {
		const [group] = await states(oneRole(), { applicationId: null });

		expect(group.rows[0].score).toBeNull();
		expect(find.applications.findFirst).not.toHaveBeenCalled();
		expect(mockSemantic).not.toHaveBeenCalled();
	});
});
