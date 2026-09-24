/**
 * The tailoring functions that touch the database.
 *
 * `tailor-version.test.ts` covers the pure layer — what the selector does with
 * a field of candidates. This file covers the assembly around it: what gets
 * written, what gets scoped, and what a rename has to follow. The rules are
 * tested there; here the question is whether the right rows are read and the
 * right ones are changed.
 *
 * Two of these have already cost silent data loss. A version is addressed by
 * SLUG in two places — `applications.cv_version_sent` and the `tags` array on
 * every profile item — and following only the first left items tagged onto a
 * version that no longer existed: still there, still looking right, printing
 * nothing. And an override written when the base already agrees turns a diff
 * into a copy of the profile, which is what stops a later run from deciding
 * about that item at all.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { PgDialect } from 'drizzle-orm/pg-core';
import type { SQL } from 'drizzle-orm';

const dialect = new PgDialect();
const render = (query: SQL) => dialect.sqlToQuery(query);

interface Write {
	table: unknown;
	values?: unknown;
	set?: unknown;
	where?: SQL;
	conflict?: unknown;
}

// Hoisted, because vi.mock factories run before the file's own top-level
// statements — a plain const here is still in its temporal dead zone when the
// module under test imports the thing it mocks.
const {
	find,
	inserts,
	updates,
	deletes,
	returning,
	dbMock,
	mockGetProfile,
	mockQueryRaw,
	mockSemantic,
	mockLexical
} = vi.hoisted(() => {
	const find = {
		applications: { findFirst: vi.fn() },
		profiles: { findFirst: vi.fn() },
		profile_versions: { findFirst: vi.fn(), findMany: vi.fn() },
		profile_version_overrides: { findFirst: vi.fn(), findMany: vi.fn() },
		profile_version_skill_words: { findFirst: vi.fn(), findMany: vi.fn() },
		job_matches: { findFirst: vi.fn() },
		work_experiences: { findMany: vi.fn() },
		work_experience_achievements: { findMany: vi.fn() },
		work_experience_technologies: { findMany: vi.fn() },
		side_projects: { findMany: vi.fn() },
		tech_skills: { findMany: vi.fn() },
		tech_skill_categories: { findMany: vi.fn() },
		education: { findMany: vi.fn() }
	};

	const inserts: Write[] = [];
	const updates: Write[] = [];
	const deletes: Write[] = [];
	/** Rows `.returning()` hands back, per table. */
	const returning = new Map<unknown, unknown[]>();

	const dbMock = {
		query: find,
		insert: (table: unknown) => ({
			values: (values: unknown) => {
				const record: Write = { table, values };
				inserts.push(record);
				const rows = () => Promise.resolve(returning.get(table) ?? []);
				return Object.assign(rows(), {
					returning: rows,
					onConflictDoUpdate: (conflict: unknown) => {
						record.conflict = conflict;
						return Promise.resolve();
					}
				});
			}
		}),
		update: (table: unknown) => ({
			set: (set: unknown) => ({
				where: (where: SQL) => {
					updates.push({ table, set, where });
					return Promise.resolve();
				}
			})
		}),
		delete: (table: unknown) => ({
			where: (where: SQL) => {
				deletes.push({ table, where });
				return Promise.resolve();
			}
		})
	};

	return {
		find,
		inserts,
		updates,
		deletes,
		returning,
		dbMock,
		mockGetProfile: vi.fn(),
		mockQueryRaw: vi.fn(),
		mockSemantic: vi.fn(),
		mockLexical: vi.fn()
	};
});

vi.mock('$lib/server/db', () => ({
	dbDirect: dbMock,
	queryRaw: (query: SQL) => mockQueryRaw(query)
}));
vi.mock('$lib/server/profile/default', () => ({
	getProfileByIdentifier: (...args: unknown[]) => mockGetProfile(...args)
}));
vi.mock('$lib/server/ai-chat/utils', () => ({ createAndGenerateAiChat: vi.fn() }));
vi.mock('$lib/server/documents/content-embeddings', () => ({
	semanticScoreUnits: (...args: unknown[]) => mockSemantic(...args),
	poolKey: (type: string, id: number) => `${type}:${id}`
}));
vi.mock('$lib/server/documents/content-retrieval', () => ({
	scoreUnitAgainstQuery: (...args: unknown[]) => mockLexical(...args)
}));

import {
	applications,
	profile_version_overrides,
	profile_version_skill_words,
	profile_versions
} from '$lib/server/db/schema';
import { config } from '$lib/server/config';
import { OVERRIDE_ENTITIES } from '$lib/version-overrides';
import type { Candidate } from '$lib/tailoring';
import {
	addSkillWordForApplication,
	describeOverrides,
	includeInTailoredVersion,
	jobMatchRead,
	promoteToLibrary as promote,
	removeSkillWordForApplication,
	retagVersionSlug,
	scoreCandidates,
	setItemStateForApplication,
	undoDecision,
	versionItemStates
} from '../tailor-version';
import {
	bullet,
	category,
	education,
	profileFixture,
	project,
	role,
	skill,
	version
} from './version-fixtures';

beforeEach(() => {
	vi.clearAllMocks();
	inserts.length = 0;
	updates.length = 0;
	deletes.length = 0;
	returning.clear();
	for (const table of Object.values(find)) {
		for (const fn of Object.values(table)) fn.mockResolvedValue(undefined);
	}
	find.profile_versions.findMany.mockResolvedValue([]);
	find.profile_version_overrides.findMany.mockResolvedValue([]);
	find.profile_version_skill_words.findMany.mockResolvedValue([]);
	find.work_experiences.findMany.mockResolvedValue([]);
	find.work_experience_achievements.findMany.mockResolvedValue([]);
	find.side_projects.findMany.mockResolvedValue([]);
	find.tech_skills.findMany.mockResolvedValue([]);
	find.tech_skill_categories.findMany.mockResolvedValue([]);
	find.education.findMany.mockResolvedValue([]);
	mockQueryRaw.mockResolvedValue([]);
});

// ─────────────────────────────────────────────────────────────────────────────
// retagVersionSlug
// ─────────────────────────────────────────────────────────────────────────────

/** Answer the scan with rows per table, and record what gets written. */
function tagScan(rowsByTable: Record<string, Array<{ id: number; tags: unknown }>>) {
	const selected: string[] = [];
	const written: Array<{ sql: string; params: unknown[] }> = [];
	mockQueryRaw.mockImplementation((query: SQL) => {
		const { sql, params } = render(query);
		if (/^\s*SELECT/i.test(sql)) {
			selected.push(sql);
			const table = Object.keys(rowsByTable).find((t) => sql.includes(`FROM ${t}\n`));
			return Promise.resolve(table ? rowsByTable[table] : []);
		}
		written.push({ sql, params });
		return Promise.resolve([]);
	});
	return { selected, written };
}

describe('retagVersionSlug', () => {
	it('does nothing for a slug that is not one', async () => {
		expect(await retagVersionSlug(1, '', 'later')).toBe(0);
		expect(await retagVersionSlug(1, '  ', 'later')).toBe(0);
		expect(await retagVersionSlug(1, '!', 'later')).toBe(0);
		expect(mockQueryRaw).not.toHaveBeenCalled();
	});

	// Seven tables carry a `tags` array that can name a version. A table missed
	// here is a set of items that silently stop printing on the renamed version.
	it('scans every table that can name a version, scoped to the profile', async () => {
		const { selected } = tagScan({});

		await retagVersionSlug(7, 'backend', 'senior-backend');

		expect(selected).toHaveLength(7);
		const all = selected.join('\n');
		for (const table of [
			'work_experiences',
			'education',
			'side_projects',
			'tech_skill_categories',
			'tech_skills',
			'work_experience_achievements',
			'work_experience_technologies'
		]) {
			expect(all, `${table} is not scanned`).toContain(`FROM ${table}`);
		}
		// `app-<id>` slugs are unique per profile only, so an unscoped rewrite
		// would reach another applicant's tags.
		for (const query of selected) expect(query).toMatch(/profile_id = \$\d/);
	});

	it('points a tag at the new slug and counts the row', async () => {
		const { written } = tagScan({
			side_projects: [{ id: 3, tags: ['backend', 'cv'] }]
		});

		expect(await retagVersionSlug(1, 'backend', 'senior-backend')).toBe(1);
		expect(written).toHaveLength(1);
		expect(written[0].sql).toContain('UPDATE side_projects');
		expect(written[0].params).toContain(JSON.stringify(['senior-backend', 'cv']));
	});

	// "Never on this one" is a different statement from "only on this one", and a
	// rename is not the place to flip it.
	it('keeps a negation a negation', async () => {
		const { written } = tagScan({ work_experiences: [{ id: 1, tags: ['!backend'] }] });

		await retagVersionSlug(1, 'backend', 'senior-backend');

		expect(written[0].params).toContain(JSON.stringify(['!senior-backend']));
	});

	it('matches the slug however it was capitalised', async () => {
		const { written } = tagScan({ work_experiences: [{ id: 1, tags: ['Backend'] }] });

		await retagVersionSlug(1, 'backend', 'senior-backend');

		expect(written[0].params).toContain(JSON.stringify(['senior-backend']));
	});

	// The SQL only narrows the field — its predicate strips every leading `!`,
	// where a tag means only the first — so a row it returns still has to be
	// judged in JS, and one that comes back unchanged must not be written.
	it('does not write a row the rename leaves alone', async () => {
		const { written } = tagScan({
			work_experiences: [
				{ id: 1, tags: ['frontend'] },
				{ id: 2, tags: null },
				{ id: 3, tags: 'not-an-array' }
			]
		});

		expect(await retagVersionSlug(1, 'backend', 'senior-backend')).toBe(0);
		expect(written).toHaveLength(0);
	});

	describe('retiring a slug', () => {
		it('drops the tag and keeps the rest', async () => {
			const { written } = tagScan({ tech_skills: [{ id: 9, tags: ['backend', 'cv'] }] });

			expect(await retagVersionSlug(1, 'backend', null)).toBe(1);
			expect(written[0].params).toContain(JSON.stringify(['cv']));
		});

		// An empty array and no tags at all mean the same thing to the filter;
		// storing NULL keeps the column's two "unrestricted" states from
		// multiplying.
		it('writes NULL when the tag was the only one', async () => {
			const { written } = tagScan({ tech_skills: [{ id: 9, tags: ['backend'] }] });

			await retagVersionSlug(1, 'backend', null);

			expect(written[0].params).toContain(null);
			expect(written[0].sql).toContain('::json');
		});
	});

	it('counts every row it touched, across tables', async () => {
		tagScan({
			work_experiences: [{ id: 1, tags: ['backend'] }],
			side_projects: [
				{ id: 2, tags: ['backend'] },
				{ id: 3, tags: ['backend'] }
			]
		});

		expect(await retagVersionSlug(1, 'backend', 'senior-backend')).toBe(3);
	});
});

// ─────────────────────────────────────────────────────────────────────────────
// promoteToLibrary
// ─────────────────────────────────────────────────────────────────────────────

describe('promoteToLibrary', () => {
	beforeEach(() => {
		find.profile_versions.findFirst.mockResolvedValue({
			id: 5,
			slug: 'app-12',
			name: 'Tailored — Acme'
		});
		find.profile_versions.findMany.mockResolvedValue([]);
	});

	it('refuses when the application has no tailored version', async () => {
		find.profile_versions.findFirst.mockResolvedValue(undefined);

		await expect(promote({ profileId: 1, applicationId: 12 })).rejects.toThrow(
			'no tailored version'
		);
	});

	it('takes the version out of the application and gives it a library slug', async () => {
		const result = await promote({ profileId: 1, applicationId: 12, name: 'Senior Backend!' });

		expect(result).toEqual({ slug: 'senior-backend', name: 'Senior Backend!' });
		const versionUpdate = updates.find((u) => u.table === profile_versions);
		expect(versionUpdate?.set).toMatchObject({
			application_id: null,
			slug: 'senior-backend',
			name: 'Senior Backend!'
		});
	});

	it('falls back to the version’s own name, and then to a constant', async () => {
		expect((await promote({ profileId: 1, applicationId: 12 })).name).toBe('Tailored — Acme');

		find.profile_versions.findFirst.mockResolvedValue({ id: 5, slug: 'app-12', name: '' });
		const unnamed = await promote({ profileId: 1, applicationId: 12, name: '   ' });
		expect(unnamed).toEqual({ slug: 'tailored-version', name: 'Tailored version' });
	});

	// The library forms refuse an `app-<id>` slug, and it would read as noise in
	// a share link.
	it('never hands back a slug that looks like an application’s own', async () => {
		const result = await promote({ profileId: 1, applicationId: 12, name: 'app-42' });
		expect(result.slug).toBe('v-app-42');
	});

	it('suffixes a slug the profile already uses', async () => {
		find.profile_versions.findMany.mockResolvedValue([
			{ slug: 'senior-backend' },
			{ slug: 'senior-backend-2' },
			{ slug: null }
		]);

		const result = await promote({ profileId: 1, applicationId: 12, name: 'Senior Backend' });
		expect(result.slug).toBe('senior-backend-3');
	});

	it('gives up rather than looping forever', async () => {
		find.profile_versions.findMany.mockResolvedValue([
			{ slug: 'taken' },
			...Array.from({ length: 98 }, (_, i) => ({ slug: `taken-${i + 2}` }))
		]);

		await expect(promote({ profileId: 1, applicationId: 12, name: 'Taken' })).rejects.toThrow(
			'free slug'
		);
	});

	// Two references key on the slug rather than the id, and both were found the
	// hard way: an application that recorded sending this version, and every
	// item tagged onto it.
	it('follows the slug into the send record and the item tags', async () => {
		const { selected } = tagScan({});

		await promote({ profileId: 1, applicationId: 12, name: 'Senior Backend' });

		const sendRecord = updates.find((u) => u.table === applications);
		expect(sendRecord?.set).toMatchObject({ cv_version_sent: 'senior-backend' });
		expect(render(sendRecord!.where as SQL).params).toContain('app-12');
		// The tag scan ran for the old slug.
		expect(selected.length).toBe(7);
	});

	it('leaves both alone when there was no old slug to follow', async () => {
		find.profile_versions.findFirst.mockResolvedValue({ id: 5, slug: null, name: 'Kept' });

		await promote({ profileId: 1, applicationId: 12 });

		expect(updates.find((u) => u.table === applications)).toBeUndefined();
		expect(mockQueryRaw).not.toHaveBeenCalled();
	});
});

// ─────────────────────────────────────────────────────────────────────────────
// setItemStateForApplication
// ─────────────────────────────────────────────────────────────────────────────

describe('setItemStateForApplication', () => {
	const profile = profileFixture({
		work_experiences: [
			role(1, 'Engineer', [
				bullet(10, 'Shipped the thing'),
				bullet(11, 'Hid this one', ['!resume'])
			])
		],
		tech_skill_categories: [
			category(4, 'Backend', [skill(40, 'Python'), skill(41, 'Django', ['!resume', '!cv'])])
		],
		educations: [education(7, 'Software Development', 'Nova College')],
		profile_versions: [version(3, 'base')]
	});

	function toggle(over: Partial<Parameters<typeof setItemStateForApplication>[0]> = {}) {
		return setItemStateForApplication({
			profileId: 1,
			applicationId: 12,
			baseSlug: 'base',
			entityType: OVERRIDE_ENTITIES.achievement,
			entityId: 10,
			on: true,
			...over
		});
	}

	beforeEach(() => {
		mockGetProfile.mockResolvedValue(profile);
		find.applications.findFirst.mockResolvedValue({
			id: 12,
			job: { title: 'Backend Engineer', company: 'Acme' }
		});
		find.profile_versions.findFirst.mockResolvedValue({ id: 5, slug: 'app-12' });
	});

	it('refuses without a profile or an application', async () => {
		mockGetProfile.mockResolvedValue(null);
		await expect(toggle()).rejects.toThrow('Profile not found');

		mockGetProfile.mockResolvedValue(profile);
		find.applications.findFirst.mockResolvedValue(undefined);
		await expect(toggle()).rejects.toThrow('Application not found');
	});

	// The review diff prints an item's text by looking its id up with no profile
	// in the question, so a row naming somebody else's bullet would put their
	// words on this applicant's page.
	it('refuses an item that is not on this profile', async () => {
		await expect(toggle({ entityId: 999 })).rejects.toThrow('Item not found');
		// Ids are per table: a bullet's id is not a skill's.
		await expect(toggle({ entityType: OVERRIDE_ENTITIES.skill, entityId: 10 })).rejects.toThrow(
			'Item not found'
		);
		expect(inserts).toHaveLength(0);
	});

	// Putting an item back used to delete the row, to keep the sidecar a pure
	// diff, and nothing then stopped the next run hiding it again.
	it('records putting an item back the way the base has it, so a rerun leaves it alone', async () => {
		const result = await toggle({ entityId: 10, on: true });

		expect(deletes).toHaveLength(0);
		expect(inserts[0].values).toMatchObject({
			version_id: 5,
			entity_type: OVERRIDE_ENTITIES.achievement,
			entity_id: 10,
			action: 'include',
			reason: 'you chose to show this',
			source: 'user'
		});
		expect(result).toEqual({ versionSlug: 'app-12', created: false });
	});

	it('writes an exclusion for hiding something the base shows', async () => {
		await toggle({ entityId: 10, on: false });

		expect(deletes).toHaveLength(0);
		expect(inserts[0].values).toMatchObject({
			version_id: 5,
			entity_type: OVERRIDE_ENTITIES.achievement,
			entity_id: 10,
			action: 'exclude',
			reason: 'you chose to hide this',
			source: 'user'
		});
	});

	it('writes an include for showing something the base holds back', async () => {
		await toggle({ entityId: 11, on: true });

		expect(inserts[0].values).toMatchObject({ action: 'include', source: 'user' });
	});

	// A hand toggle replaces whatever the run decided, ordering included: the
	// sort a relevance pass chose is not a statement the applicant made.
	it('overwrites a previous decision about the same item, clearing its order', async () => {
		await toggle({ entityId: 10, on: false });

		expect(inserts[0].conflict).toMatchObject({
			set: expect.objectContaining({ action: 'exclude', sort: null, source: 'user' })
		});
	});

	// None of these is a candidate a run ranks: a run only reaches the skills a
	// job requires, and never an education entry. Hiding a skill used to ask the
	// candidate list whether the base showed it, got "no" for every skill no job
	// required, and wrote nothing at all.
	it('takes a skill, a skill group and an education entry', async () => {
		await toggle({ entityType: OVERRIDE_ENTITIES.skill, entityId: 40, on: false });
		await toggle({ entityType: OVERRIDE_ENTITIES.skill, entityId: 41, on: true });
		await toggle({ entityType: OVERRIDE_ENTITIES.skillCategory, entityId: 4, on: false });
		await toggle({ entityType: OVERRIDE_ENTITIES.education, entityId: 7, on: false });

		expect(deletes).toHaveLength(0);
		expect(inserts.map((i) => i.values)).toMatchObject([
			{ entity_type: OVERRIDE_ENTITIES.skill, entity_id: 40, action: 'exclude' },
			{ entity_type: OVERRIDE_ENTITIES.skill, entity_id: 41, action: 'include' },
			{ entity_type: OVERRIDE_ENTITIES.skillCategory, entity_id: 4, action: 'exclude' },
			{ entity_type: OVERRIDE_ENTITIES.education, entity_id: 7, action: 'exclude' }
		]);
	});

	// Noticing the gap and fixing it IS tailoring; making someone generate a
	// version first turned one intent into a two-step ceremony.
	it('creates the version on demand, and says that it did', async () => {
		find.profile_versions.findFirst.mockResolvedValue(undefined);
		returning.set(profile_versions, [{ id: 77 }]);

		const result = await toggle({ entityId: 10, on: false });

		expect(result).toEqual({ versionSlug: 'app-12', created: true });
		expect(inserts.some((i) => i.table === profile_versions)).toBe(true);
		expect(inserts.find((i) => i.table === profile_version_overrides)?.values).toMatchObject({
			version_id: 77
		});
	});
});

// ─────────────────────────────────────────────────────────────────────────────
// addSkillWordForApplication / removeSkillWordForApplication
// ─────────────────────────────────────────────────────────────────────────────

describe('addSkillWordForApplication', () => {
	const profile = profileFixture({
		tech_skill_categories: [
			category(4, 'DevOps', [skill(40, 'Sentry')]),
			category(6, 'AI', [skill(60, 'Function calling')])
		],
		profile_versions: [version(3, 'base')]
	});
	const JOB = {
		id: 9,
		title: 'AI Engineer',
		company: 'Acme',
		skills_required: ['Monitoring', 'Tool Calling'],
		skills_preferred: ['Jira']
	};

	function add(over: Partial<Parameters<typeof addSkillWordForApplication>[0]> = {}) {
		return addSkillWordForApplication({
			profileId: 1,
			applicationId: 12,
			baseSlug: 'base',
			docType: 'resume',
			name: 'Monitoring',
			categoryId: 4,
			...over
		});
	}
	const written = () => inserts.filter((i) => i.table === profile_version_skill_words);

	beforeEach(() => {
		mockGetProfile.mockResolvedValue(profile);
		find.applications.findFirst.mockResolvedValue({ id: 12, job: JOB });
		find.profile_versions.findFirst.mockResolvedValue({ id: 5, slug: 'app-12' });
		find.job_matches.findFirst.mockResolvedValue({
			gaps: [],
			matched_skills: ['Monitoring', 'Tool Calling'],
			matched_skill_details: [
				{ skill: 'Monitoring', via: 'ontology', depth: 1, from: 'Sentry' },
				{ skill: 'Tool Calling', via: 'llm', depth: 0 }
			]
		});
	});

	// The posting's spelling, because that is what a keyword search looks for.
	it('writes the word on this job’s version, spelled the way the job spells it', async () => {
		const result = await add({ name: '  monitoring ' });

		expect(result).toEqual({ versionSlug: 'app-12', created: false });
		expect(written()).toHaveLength(1);
		expect(written()[0].values).toMatchObject({
			version_id: 5,
			category_id: 4,
			name: 'Monitoring',
			reason: 'this job asks for it; your match credits it through Sentry'
		});
	});

	it('says so when the match inferred it rather than naming a skill', async () => {
		await add({ name: 'Tool Calling', categoryId: 6 });

		expect(written()[0].values).toMatchObject({
			reason: 'this job asks for it; your match infers it from your profile'
		});
	});

	it('takes a word the job lists as a plus', async () => {
		await add({ name: 'Jira' });

		expect(written()[0].values).toMatchObject({ name: 'Jira', reason: 'this job asks for it' });
	});

	it('refuses a word the job does not list', async () => {
		await expect(add({ name: 'Kubernetes' })).rejects.toThrow(/doesn't list “Kubernetes”/);
		expect(inserts).toHaveLength(0);
	});

	// Showing the profile's own skill is the fix; a second copy under the same
	// name is the duplicate this exists to stop.
	it('refuses a name the profile already holds', async () => {
		find.applications.findFirst.mockResolvedValue({
			id: 12,
			job: { ...JOB, skills_required: ['Sentry'] }
		});

		await expect(add({ name: 'sentry' })).rejects.toThrow(/already has “Sentry”/);
		expect(inserts).toHaveLength(0);
	});

	it('refuses a group that is not on this profile', async () => {
		await expect(add({ categoryId: 999 })).rejects.toThrow('Skill group not found');
		expect(inserts).toHaveLength(0);
	});

	it('moves a word it already has rather than adding it twice', async () => {
		find.profile_version_skill_words.findMany.mockResolvedValue([{ id: 31, name: 'MONITORING' }]);

		await add({ categoryId: 6 });

		expect(written()).toHaveLength(0);
		expect(updates[0]).toMatchObject({
			table: profile_version_skill_words,
			set: expect.objectContaining({ name: 'Monitoring', category_id: 6 })
		});
	});

	it('creates the version on demand, and says that it did', async () => {
		find.profile_versions.findFirst.mockResolvedValue(undefined);
		returning.set(profile_versions, [{ id: 77 }]);

		const result = await add();

		expect(result).toEqual({ versionSlug: 'app-12', created: true });
		expect(written()[0].values).toMatchObject({ version_id: 77 });
	});
});

describe('removeSkillWordForApplication', () => {
	const remove = () =>
		removeSkillWordForApplication({ profileId: 1, applicationId: 12, wordId: 31 });

	// The word must sit on THIS application's version: an id alone could name
	// somebody else's.
	it('deletes the word only from this application’s own version', async () => {
		find.profile_versions.findFirst.mockResolvedValue({ id: 5, slug: 'app-12' });

		expect(await remove()).toEqual({ versionSlug: 'app-12' });
		expect(deletes).toHaveLength(1);
		expect(deletes[0].table).toBe(profile_version_skill_words);
		const { sql, params } = render(deletes[0].where!);
		expect(sql).toContain('"version_id"');
		expect(params).toEqual([31, 5]);
	});

	it('refuses when the application has no tailored version', async () => {
		find.profile_versions.findFirst.mockResolvedValue(undefined);

		await expect(remove()).rejects.toThrow('No tailored version');
		expect(deletes).toHaveLength(0);
	});
});

// ─────────────────────────────────────────────────────────────────────────────
// includeInTailoredVersion
// ─────────────────────────────────────────────────────────────────────────────

describe('includeInTailoredVersion', () => {
	function include(entityType: string = OVERRIDE_ENTITIES.skill, entityId = 41) {
		return includeInTailoredVersion({ profileId: 1, applicationId: 12, entityType, entityId });
	}

	beforeEach(() => {
		mockGetProfile.mockResolvedValue(
			profileFixture({
				tech_skill_categories: [category(4, 'Backend', [skill(41, 'Django', ['!resume', '!cv'])])]
			})
		);
		find.profile_versions.findFirst.mockResolvedValue({ id: 5, slug: 'app-12' });
	});

	it('refuses an item that is not on this profile', async () => {
		await expect(include(OVERRIDE_ENTITIES.skill, 999)).rejects.toThrow('Item not found');
		expect(inserts).toHaveLength(0);
	});

	// Offered only once the tailored version is what goes out, so a missing one
	// means the page is out of date, not that one should be made.
	it('never creates a version', async () => {
		find.profile_versions.findFirst.mockResolvedValue(undefined);

		await expect(include()).rejects.toThrow('No tailored version');
		expect(inserts).toHaveLength(0);
	});

	it('records the item as the applicant’s own', async () => {
		expect(await include()).toEqual({ versionSlug: 'app-12' });
		expect(inserts[0].values).toMatchObject({
			version_id: 5,
			entity_type: OVERRIDE_ENTITIES.skill,
			entity_id: 41,
			action: 'include',
			source: 'user'
		});
	});
});

// ─────────────────────────────────────────────────────────────────────────────
// undoDecision
// ─────────────────────────────────────────────────────────────────────────────

describe('undoDecision', () => {
	const undo = (decisionId = 9) => undoDecision({ profileId: 1, applicationId: 12, decisionId });
	const decision = (over = {}) => ({
		id: 9,
		entity_type: OVERRIDE_ENTITIES.achievement,
		action: 'exclude',
		sort: null,
		source: 'ai',
		...over
	});

	beforeEach(() => {
		find.profile_versions.findFirst.mockResolvedValue({ id: 5, slug: 'app-12' });
	});

	it('refuses without a version for this application', async () => {
		find.profile_versions.findFirst.mockResolvedValue(undefined);
		await expect(undo()).rejects.toThrow('No tailored version');
	});

	// Deleting the row put the item back only until the next Regenerate, which
	// made the same call again.
	it('turns a decision tailoring made into the applicant’s reversal of it', async () => {
		find.profile_version_overrides.findFirst.mockResolvedValue(decision());

		expect(await undo()).toEqual({ versionSlug: 'app-12' });

		expect(deletes).toHaveLength(0);
		expect(updates[0].table).toBe(profile_version_overrides);
		expect(updates[0].set).toMatchObject({
			action: 'include',
			sort: null,
			reason: 'you put this back',
			source: 'user'
		});
	});

	it('deletes a decision the applicant made', async () => {
		find.profile_version_overrides.findFirst.mockResolvedValue(decision({ source: 'user' }));

		await undo();

		expect(updates).toHaveLength(0);
		expect(deletes).toHaveLength(1);
		expect(deletes[0].table).toBe(profile_version_overrides);
	});

	// A second tab, or a regeneration in between.
	it('does nothing about a row that is already gone', async () => {
		find.profile_version_overrides.findFirst.mockResolvedValue(undefined);

		expect(await undo()).toEqual({ versionSlug: 'app-12' });
		expect(updates).toHaveLength(0);
		expect(deletes).toHaveLength(0);
	});

	// The id comes from the form. Without the version in every query, a
	// decision on somebody else's version could be read and rewritten.
	it('only reads and writes a row on this application’s version', async () => {
		find.profile_version_overrides.findFirst.mockResolvedValue(decision());

		await undo(9);

		const read = find.profile_version_overrides.findFirst.mock.calls[0][0] as { where: SQL };
		expect(render(read.where).params).toEqual(expect.arrayContaining([9, 5]));
		expect(render(updates[0].where!).params).toEqual(expect.arrayContaining([9, 5]));
	});
});

// ─────────────────────────────────────────────────────────────────────────────
// versionItemStates
// ─────────────────────────────────────────────────────────────────────────────

describe('versionItemStates', () => {
	const base = version(3, 'base');
	const tailored = version(5, 'app-12', {
		extension_links: [{ extended_id: 3 }],
		overrides: [{ entity_type: OVERRIDE_ENTITIES.skill, entity_id: 40, action: 'exclude' }]
	});
	const profile = profileFixture({
		side_projects: [project(20, 'Monkful')],
		tech_skill_categories: [
			category(4, 'Backend', [skill(40, 'Python'), skill(41, 'Django', ['!resume', '!cv'])]),
			category(6, 'Frontend', [skill(60, 'Vue')], ['!resume'])
		],
		educations: [education(7, 'Software Development', 'Nova College')],
		profile_versions: [base, tailored]
	});

	function states(over: Partial<Parameters<typeof versionItemStates>[0]> = {}) {
		return versionItemStates({
			profileId: 1,
			applicationId: 12,
			docType: 'resume',
			versionSlug: 'app-12',
			baseSlug: 'base',
			...over
		});
	}
	const group = (groups: Awaited<ReturnType<typeof states>>, key: string) =>
		groups.find((g) => g.key === key);
	const row = (groups: Awaited<ReturnType<typeof states>>, key: string) =>
		groups.flatMap((g) => g.rows).find((r) => `${r.entityType}:${r.entityId}` === key);

	beforeEach(() => {
		mockGetProfile.mockResolvedValue(profile);
		// No job, so nothing is scored and the test stays about visibility.
		find.applications.findFirst.mockResolvedValue({ id: 12, cv_template_sent: null, job: null });
		find.profile_versions.findFirst.mockResolvedValue({ id: 5 });
		find.profile_version_overrides.findMany.mockResolvedValue([
			{
				entity_type: OVERRIDE_ENTITIES.skill,
				entity_id: 40,
				action: 'exclude',
				reason: 'you chose to hide this',
				source: 'user'
			}
		]);
	});

	// A run only ever reaches the skills a job requires, so for every other skill
	// this list is the only per-job control there is.
	it('lists every skill by group, in the parts of the document they print in', async () => {
		const groups = await states();

		expect(groups.map((g) => [g.section, g.title])).toEqual([
			['projects', 'Side projects'],
			['skills', 'Backend'],
			['skills', 'Frontend'],
			['education', 'Education']
		]);
		expect(group(groups, 'tech_skill_category:4')?.rows.map((r) => r.label)).toEqual([
			'Python',
			'Django'
		]);
	});

	it('says what prints, who decided, and what the base does', async () => {
		const groups = await states();

		expect(row(groups, 'tech_skill:40')).toMatchObject({
			on: false,
			baseOn: true,
			source: 'user',
			reason: 'you chose to hide this'
		});
		expect(row(groups, 'tech_skill:41')).toMatchObject({
			on: false,
			baseOn: false,
			source: 'base',
			reason: 'kept off your documents',
			profileOnly: true
		});
	});

	// The group is its own switch. What its skills would do once it prints is
	// the thing to see while it doesn't, and the group says why they don't.
	it('keeps a hidden group’s skills at their own answer, without a reason each', async () => {
		const groups = await states();

		expect(group(groups, 'tech_skill_category:6')).toMatchObject({ on: false, baseOn: false });
		expect(row(groups, 'tech_skill:60')).toMatchObject({ on: true, reason: '' });
	});

	it('lists education, named by what and where', async () => {
		expect(row(await states(), 'education:7')).toMatchObject({
			label: 'Software Development at Nova College',
			on: true,
			baseOn: true
		});
	});

	// Switches that change nothing on the page read as switches that are broken.
	it('says when the template has no projects section', async () => {
		expect(group(await states(), 'side-projects')?.note).toBeNull();

		find.applications.findFirst.mockResolvedValue({
			id: 12,
			cv_template_sent: 'citrus',
			job: null
		});
		expect(group(await states(), 'side-projects')?.note).toMatch(/doesn't print side projects/);
	});

	it('claims nothing about a base it cannot resolve', async () => {
		const groups = await states({ baseSlug: null });

		expect(row(groups, 'tech_skill:40')?.baseOn).toBeUndefined();
		expect(group(groups, 'tech_skill_category:4')?.baseOn).toBeUndefined();
	});

	// A library version nothing has tailored yet is its own base.
	it('answers a version against itself when no base is named', async () => {
		const groups = await states({ baseSlug: undefined });

		for (const r of groups.flatMap((g) => g.rows)) expect(r.baseOn).toBe(r.on);
	});

	// The job's own words for skills the profile holds under other names. Its
	// own can be taken off here; the base's only say where they come from.
	it('lists the words it carries under their group, and whether each prints', async () => {
		const wordRow = (id: number, version_id: number, category_id: number, name: string) => ({
			id,
			version_id,
			category_id,
			name,
			reason: id === 1 ? 'this job asks for it; your match credits it through Python' : null,
			version: { profile_id: version_id === 99 ? 2 : 1 }
		});
		find.profile_version_skill_words.findMany.mockResolvedValue([
			wordRow(1, 5, 4, 'Monitoring'),
			wordRow(2, 3, 4, 'Testing'),
			// Frontend is off every resume, so a word in it prints nothing.
			wordRow(3, 5, 6, 'Tool Calling'),
			// Somebody else's version.
			wordRow(4, 99, 4, 'Theirs')
		]);

		const groups = await states();

		expect(group(groups, 'tech_skill_category:4')?.words).toEqual([
			{
				id: 1,
				name: 'Monitoring',
				reason: 'this job asks for it; your match credits it through Python',
				on: true,
				inherited: false
			},
			{ id: 2, name: 'Testing', reason: '', on: true, inherited: true }
		]);
		expect(group(groups, 'tech_skill_category:6')?.words).toEqual([
			{ id: 3, name: 'Tool Calling', reason: '', on: false, inherited: false }
		]);
	});
});

// ─────────────────────────────────────────────────────────────────────────────
// jobMatchRead
// ─────────────────────────────────────────────────────────────────────────────

describe('jobMatchRead', () => {
	it('reads the gaps and the credited skills', async () => {
		const details = [{ skill: 'SQL', via: 'ontology', depth: 1, from: 'PostgreSQL' }];
		find.job_matches.findFirst.mockResolvedValue({
			gaps: ['Kafka', 'Terraform'],
			matched_skills: ['SQL', 'Python'],
			matched_skill_details: details
		});

		expect(await jobMatchRead(1, 9)).toEqual({
			gaps: ['Kafka', 'Terraform'],
			matched: ['SQL', 'Python'],
			// Passed through unread: provenanceFor narrows it where it is used.
			details
		});
	});

	// A warning listing everything is not a warning.
	it('caps the gaps at six', async () => {
		find.job_matches.findFirst.mockResolvedValue({
			gaps: Array.from({ length: 10 }, (_, i) => `skill ${i}`),
			matched_skills: []
		});

		expect((await jobMatchRead(1, 9)).gaps).toHaveLength(6);
	});

	it('is empty when nothing has matched this job, or the columns hold junk', async () => {
		find.job_matches.findFirst.mockResolvedValue(undefined);
		expect(await jobMatchRead(1, 9)).toEqual({ gaps: [], matched: [], details: null });

		find.job_matches.findFirst.mockResolvedValue({ gaps: 'not an array', matched_skills: null });
		expect(await jobMatchRead(1, 9)).toEqual({ gaps: [], matched: [], details: null });
	});
});

// ─────────────────────────────────────────────────────────────────────────────
// describeOverrides
// ─────────────────────────────────────────────────────────────────────────────

describe('describeOverrides', () => {
	function row(entity_type: string, entity_id: number, over = {}) {
		return {
			id: entity_id,
			entity_type,
			entity_id,
			action: 'exclude',
			reason: 'trimmed to fit',
			sort: null,
			source: 'ai',
			...over
		};
	}

	it('fills in the applicant’s own words, and where they live', async () => {
		find.work_experience_achievements.findMany.mockResolvedValue([
			{ id: 10, description: 'Cut deploy time in half', work_experience_id: 1 }
		]);
		find.work_experiences.findMany.mockResolvedValue([
			{ id: 1, position: 'Engineer', name: 'Acme' }
		]);

		const [described] = await describeOverrides([row(OVERRIDE_ENTITIES.achievement, 10)]);

		expect(described.label).toBe('Cut deploy time in half');
		expect(described.context).toBe('Engineer at Acme');
	});

	// A bare "Frontend" asks the applicant to go and look up what is leaving the
	// page before they can decide about it.
	it('lists what a skill group holds', async () => {
		find.tech_skill_categories.findMany.mockResolvedValue([
			{ id: 4, name: 'Frontend', tech_skills: [{ name: 'Vue' }, { name: 'Shopify' }] }
		]);

		const [described] = await describeOverrides([row(OVERRIDE_ENTITIES.skillCategory, 4)]);

		expect(described.label).toBe('Frontend');
		expect(described.context).toBe('Vue, Shopify');
	});

	// The row's item is gone; the cascade already made the decision meaningless,
	// and a blank line in a review panel is worse than none.
	it('drops a row whose item has been deleted', async () => {
		expect(await describeOverrides([row(OVERRIDE_ENTITIES.sideProject, 99)])).toEqual([]);
	});

	it('names the role itself, which is the largest change a run can make', async () => {
		find.work_experiences.findMany.mockResolvedValue([
			{ id: 1, position: 'Engineer', name: 'Acme' }
		]);

		const [described] = await describeOverrides([
			row(OVERRIDE_ENTITIES.workExperience, 1, { action: 'include' })
		]);

		expect(described).toMatchObject({
			entityType: OVERRIDE_ENTITIES.workExperience,
			label: 'Engineer at Acme',
			action: 'include'
		});
	});

	// One word, and a profile can list Docker under three roles — so the word
	// alone does not say which line it left.
	it('names the role a dropped technology left', async () => {
		find.work_experience_technologies.findMany.mockResolvedValue([
			{ id: 7, name: 'Varnish', work_experience_id: 1 }
		]);
		find.work_experiences.findMany.mockResolvedValue([
			{ id: 1, position: 'Engineer', name: 'Acme' }
		]);

		const [described] = await describeOverrides([row(OVERRIDE_ENTITIES.technology, 7)]);

		expect(described.label).toBe('Varnish');
		expect(described.context).toBe('Engineer at Acme');
	});

	it('names an education entry by what and where', async () => {
		find.education.findMany.mockResolvedValue([
			{ id: 7, area: null, study_type: 'Dutch MBO', institution: 'Nova College' }
		]);

		const [described] = await describeOverrides([row(OVERRIDE_ENTITIES.education, 7)]);

		expect(described.label).toBe('Dutch MBO at Nova College');
	});

	it('asks only about the types it was given rows for', async () => {
		find.tech_skills.findMany.mockResolvedValue([{ id: 8, name: 'Python' }]);

		await describeOverrides([row(OVERRIDE_ENTITIES.skill, 8)]);

		expect(find.tech_skills.findMany).toHaveBeenCalledTimes(1);
		expect(find.side_projects.findMany).not.toHaveBeenCalled();
		expect(find.work_experience_achievements.findMany).not.toHaveBeenCalled();
		expect(find.tech_skill_categories.findMany).not.toHaveBeenCalled();
		expect(find.work_experience_technologies.findMany).not.toHaveBeenCalled();
	});
});

// ─────────────────────────────────────────────────────────────────────────────
// scoreCandidates
// ─────────────────────────────────────────────────────────────────────────────

describe('scoreCandidates', () => {
	function candidate(over: Partial<Candidate> = {}): Candidate {
		return {
			entityType: OVERRIDE_ENTITIES.achievement,
			entityId: 1,
			parentId: 1,
			label: 'a bullet',
			chars: 20,
			visible: true,
			pinned: false,
			score: 0,
			...over
		};
	}

	const query = { text: 'Backend engineer', skills: ['Python', 'SQL'] };

	it('scores against cached vectors when embeddings answer', async () => {
		mockSemantic.mockResolvedValue(new Map([[`${OVERRIDE_ENTITIES.achievement}:1`, 0.71]]));

		const result = await scoreCandidates(1, [candidate(), candidate({ entityId: 2 })], query);

		expect(result.ranker).toBe('semantic');
		expect(result.floor).toBe(config.embeddingProjectThreshold);
		expect(result.candidates[0].score).toBe(0.71);
		// Nothing in the pool for it: unscored is zero, not undefined.
		expect(result.candidates[1].score).toBe(0);
	});

	it('falls back to word overlap when they do not', async () => {
		mockSemantic.mockResolvedValue(null);
		mockLexical.mockReturnValue(4);

		const result = await scoreCandidates(1, [candidate()], query);

		expect(result.ranker).toBe('lexical');
		expect(result.floor).toBe(1);
		expect(result.candidates[0].score).toBe(4);
	});

	// A pinned item is not up for discussion, and the two rankers put "above
	// everything" at very different numbers.
	it('puts a pinned candidate above whatever the ranker can produce', async () => {
		mockSemantic.mockResolvedValue(new Map());
		const semantic = await scoreCandidates(1, [candidate({ pinned: true })], query);
		expect(semantic.candidates[0].score).toBe(1);

		mockSemantic.mockResolvedValue(null);
		const lexical = await scoreCandidates(1, [candidate({ pinned: true })], query);
		expect(lexical.candidates[0].score).toBe(Number.MAX_SAFE_INTEGER);
		// It never reached the scorer at all.
		expect(mockLexical).not.toHaveBeenCalled();
	});

	// Asked to judge "LitState" against a web-components job the model called it
	// an unrelated hobby project; its summary names Lit in the first six words.
	it('embeds what an item says, not what it is called', async () => {
		mockSemantic.mockResolvedValue(new Map());

		await scoreCandidates(
			1,
			[candidate({ label: 'LitState', detail: 'LitState — state management for Lit' })],
			query
		);

		expect(mockSemantic.mock.calls[0][1]).toEqual([
			expect.objectContaining({ embedText: 'LitState — state management for Lit' })
		]);
		expect(mockSemantic.mock.calls[0][2]).toBe('Backend engineer\nPython\nSQL');
	});

	it('caches the job vector under the key it was given', async () => {
		mockSemantic.mockResolvedValue(new Map());

		await scoreCandidates(1, [candidate()], query, { unitType: 'job_query', unitId: 9 });

		expect(mockSemantic.mock.calls[0][3]).toEqual({ unitType: 'job_query', unitId: 9 });
	});
});
