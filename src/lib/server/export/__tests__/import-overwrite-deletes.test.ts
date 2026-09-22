/**
 * An overwrite import must only delete what its payload can put back.
 *
 * Two instances of that rule were broken, both silent, both found on a live
 * database rather than by anything in this suite. The first was
 * `salary_expectations`: the April 2026 salary overhaul stopped writing that
 * table's payload but left the *delete* in `deleteProfileChildren`, so every
 * overwrite import wiped 50 rows and put nothing back. That table was retired
 * on 2026-09-22, which is why its cases are gone from this file; the rule it
 * taught is what the remaining ones check.
 *
 * With the DB mocked this asserts which tables the importer *asks* to delete and
 * insert, not what Postgres does. That is the right level here: the bug was a
 * delete with no matching write, which is visible in exactly those calls.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';

/** Tables named in a delete()/insert(), in call order. */
const deleted: string[] = [];
const inserted: { table: string; values: Record<string, unknown> }[] = [];

const TABLES = [
	'profiles',
	'highlights',
	'education',
	'languages',
	'profile_field_variants',
	'references',
	'certificates',
	'project_stories',
	'cheat_sheets',
	'tech_skill_categories',
	'tech_skills',
	'tech_skill_types',
	'work_experiences',
	'work_experience_achievements',
	'work_experience_technologies',
	'work_experience_projects',
	'work_experience_project_technologies',
	'side_projects',
	'side_project_achievements',
	'side_project_technologies',
	'profile_versions',
	'profile_version_extensions',
	'applications',
	'application_letters',
	'application_questions',
	'jobs'
] as const;

/** A table stands in as a marker whose columns are markers too. */
function tableMarker(name: string) {
	return new Proxy(
		{ __table: name },
		{
			get: (_t, prop) => (prop === '__table' ? name : { __column: `${name}.${String(prop)}` })
		}
	);
}

vi.mock('$lib/server/db/schema', () => {
	const schema: Record<string, unknown> = {};
	for (const t of TABLES) schema[t] = tableMarker(t);
	return schema;
});

vi.mock('drizzle-orm', () => ({
	eq: (a: unknown, b: unknown) => ({ op: 'eq', a, b }),
	and: (...args: unknown[]) => ({ op: 'and', args }),
	ne: (a: unknown, b: unknown) => ({ op: 'ne', a, b }),
	sql: Object.assign(() => ({ op: 'sql' }), { raw: () => ({ op: 'sql' }) })
}));

vi.mock('$lib/server/profile/generate-version-pdfs', () => ({
	generateVersionPdfs: () => Promise.resolve()
}));
vi.mock('../import-documents', () => ({
	deleteProfileDocuments: () => Promise.resolve(),
	emptyCreatedProjectIds: () => ({}),
	importDocuments: () => Promise.resolve(0)
}));
vi.mock('../import-translations', () => ({
	deleteProfileTranslations: () => Promise.resolve(),
	emptyCreatedTranslationIds: () => ({}),
	importTranslations: () => Promise.resolve(0)
}));
vi.mock('../import-templates', () => ({
	deleteProfilePresentationTemplates: () => Promise.resolve(),
	importResumeTemplates: () => Promise.resolve(0)
}));

/** Awaitable query builder: every step returns itself, awaiting yields `result`. */
function chain(result: unknown) {
	const obj: Record<string, unknown> = {};
	const self = () => obj;
	Object.assign(obj, {
		where: self,
		set: self,
		returning: () => Promise.resolve(result),
		then: (res: (v: unknown) => unknown, rej: (e: unknown) => unknown) =>
			Promise.resolve(result).then(res, rej)
	});
	return obj;
}

vi.mock('$lib/server/db', () => {
	const query: Record<string, unknown> = {};
	for (const t of TABLES) {
		query[t] = {
			findFirst: () =>
				Promise.resolve(t === 'profiles' ? { id: 1, name: 'Existing', user_id: 'u1' } : undefined),
			// One existing application, so the per-application deletes of letters
			// and answers actually fire and can be asserted on.
			findMany: () => Promise.resolve(t === 'applications' ? [{ id: 42 }] : [])
		};
	}
	return {
		dbDirect: {
			query,
			delete: (t: { __table: string }) => {
				deleted.push(t.__table);
				return chain([]);
			},
			insert: (t: { __table: string }) => ({
				values: (values: Record<string, unknown>) => {
					inserted.push({ table: t.__table, values });
					return chain([{ id: 1 }]);
				}
			}),
			update: () => chain([])
		}
	};
});

const { importExportData } = await import('../import-data');

/** The smallest payload that reaches the full-account import path. */
function fullExport(extra: Record<string, unknown> = {}) {
	return exportPayload('full', extra);
}

/** The same, at profile scope — carries no stories, cheat sheets or applications. */
function profileExport(extra: Record<string, unknown> = {}) {
	return exportPayload('profile', extra);
}

function exportPayload(scope: 'profile' | 'full', extra: Record<string, unknown> = {}) {
	return {
		version: '2.0',
		exported_at: '2026-08-23T00:00:00.000Z',
		scope,
		profile: {
			name: 'Test',
			highlights: [],
			tech_skill_categories: [],
			work_experiences: [],
			side_projects: [],
			educations: [],
			languages: [],
			references: [],
			certificates: [],
			profile_versions: []
		},
		project_stories: [],
		cheat_sheets: [],
		applications: [],
		...extra
	} as never;
}

describe('overwrite import at profile scope', () => {
	beforeEach(() => {
		deleted.length = 0;
		inserted.length = 0;
	});

	it('does not touch what only a full-account payload can restore', async () => {
		await importExportData(profileExport(), 'u1', { overwriteProfileId: 1 });

		expect(deleted).not.toContain('applications');
		expect(deleted).not.toContain('application_letters');
		expect(deleted).not.toContain('application_questions');
		expect(deleted).not.toContain('project_stories');
		expect(deleted).not.toContain('cheat_sheets');
	});

	it('still replaces the CV content it does carry', async () => {
		await importExportData(profileExport(), 'u1', { overwriteProfileId: 1 });

		expect(deleted).toEqual(
			expect.arrayContaining([
				'highlights',
				'education',
				'languages',
				// Alternative wordings are replaced with the rest of the CV content.
				// They are keyed by profile id and their translations hang off their
				// row ids, so leaving them would strand overlays on ids the import is
				// about to reissue.
				'profile_field_variants',
				'certificates',
				'work_experiences',
				'side_projects',
				'profile_versions'
			])
		);
	});

	it('clears those tables when the payload is full-account', async () => {
		await importExportData(fullExport(), 'u1', { overwriteProfileId: 1 });

		expect(deleted).toEqual(
			expect.arrayContaining(['applications', 'project_stories', 'cheat_sheets'])
		);
	});
});
