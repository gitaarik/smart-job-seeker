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
		profile_version_overrides: { findMany: vi.fn() },
		job_matches: { findFirst: vi.fn() },
		work_experiences: { findMany: vi.fn() },
		work_experience_achievements: { findMany: vi.fn() },
		work_experience_technologies: { findMany: vi.fn() },
		side_projects: { findMany: vi.fn() },
		tech_skills: { findMany: vi.fn() },
		tech_skill_categories: { findMany: vi.fn() }
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

import { applications, profile_version_overrides, profile_versions } from '$lib/server/db/schema';
import { config } from '$lib/server/config';
import { OVERRIDE_ENTITIES } from '$lib/version-overrides';
import type { Candidate } from '$lib/tailoring';
import {
	describeOverrides,
	jobMatchRead,
	promoteToLibrary as promote,
	retagVersionSlug,
	scoreCandidates,
	setItemStateForApplication
} from '../tailor-version';
import { bullet, profileFixture, role, version } from './version-fixtures';

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
	find.work_experiences.findMany.mockResolvedValue([]);
	find.work_experience_achievements.findMany.mockResolvedValue([]);
	find.side_projects.findMany.mockResolvedValue([]);
	find.tech_skills.findMany.mockResolvedValue([]);
	find.tech_skill_categories.findMany.mockResolvedValue([]);
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
		profile_versions: [version(3, 'base')]
	});

	function toggle(over: Partial<Parameters<typeof setItemStateForApplication>[0]> = {}) {
		return setItemStateForApplication({
			profileId: 1,
			applicationId: 12,
			docType: 'resume',
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

	// The sidecar is a diff. A row that agrees with the base is not a decision,
	// and leaving one there would stop a later run deciding about the item.
	it('deletes the override when the answer matches the base', async () => {
		const result = await toggle({ entityId: 10, on: true });

		expect(inserts).toHaveLength(0);
		expect(deletes).toHaveLength(1);
		expect(deletes[0].table).toBe(profile_version_overrides);
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

	// A role is not a candidate — nothing may drop one — so its base state comes
	// from the filter directly.
	it('reads a role’s base state through the document filter', async () => {
		const hidden = profileFixture({
			work_experiences: [role(2, 'Contractor', [], { tags: ['!resume'] })],
			profile_versions: [version(3, 'base')]
		});
		mockGetProfile.mockResolvedValue(hidden);

		await toggle({ entityType: OVERRIDE_ENTITIES.workExperience, entityId: 2, on: true });
		expect(inserts[0].values).toMatchObject({
			entity_type: OVERRIDE_ENTITIES.workExperience,
			action: 'include'
		});

		inserts.length = 0;
		await toggle({ entityType: OVERRIDE_ENTITIES.workExperience, entityId: 2, on: false });
		expect(inserts).toHaveLength(0);
		expect(deletes).toHaveLength(1);
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
// jobMatchRead
// ─────────────────────────────────────────────────────────────────────────────

describe('jobMatchRead', () => {
	it('reads the gaps and the credited skills', async () => {
		find.job_matches.findFirst.mockResolvedValue({
			gaps: ['Kafka', 'Terraform'],
			matched_skills: ['SQL', 'Python']
		});

		expect(await jobMatchRead(1, 9)).toEqual({
			gaps: ['Kafka', 'Terraform'],
			matched: ['SQL', 'Python']
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
		expect(await jobMatchRead(1, 9)).toEqual({ gaps: [], matched: [] });

		find.job_matches.findFirst.mockResolvedValue({ gaps: 'not an array', matched_skills: null });
		expect(await jobMatchRead(1, 9)).toEqual({ gaps: [], matched: [] });
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
