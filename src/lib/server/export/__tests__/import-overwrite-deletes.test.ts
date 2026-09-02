/**
 * An overwrite import must only delete what its payload can put back.
 *
 * Two instances of that rule were broken, both silent, both found on a live
 * database rather than by anything in this suite.
 *
 * The April 2026 salary overhaul replaced this export's salary payload with the
 * profile-level `salary_settings` fields and deleted the importer's reader for
 * the `salary_expectations` table — but left the *delete* in
 * `deleteProfileChildren`. Every overwrite import from then on wiped the whole
 * table for that profile and put nothing back. Nothing failed, so nothing said
 * so; on the dev database that was 50 rows.
 *
 * The table outlived the overhaul and belongs to settings export/import now, so
 * the fix is that a profile import leaves it alone — unless the payload itself
 * carries the rows, which only a pre-overhaul archive does, and which is the one
 * case where replacing them is what the file asked for.
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
	'salary_expectations',
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
	deleteProfileResumeTemplates: () => Promise.resolve(),
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

describe('overwrite import and salary_expectations', () => {
	beforeEach(() => {
		deleted.length = 0;
		inserted.length = 0;
	});

	it('leaves the table alone when the payload does not carry it', async () => {
		await importExportData(fullExport(), 'u1', { overwriteProfileId: 1 });

		expect(deleted).not.toContain('salary_expectations');
	});

	it('still clears the rest of the profile it is replacing', async () => {
		await importExportData(fullExport(), 'u1', { overwriteProfileId: 1 });

		// Guards the assertion above: it has to fail because the salary delete is
		// gone, not because deleteProfileChildren stopped running altogether.
		expect(deleted).toEqual(
			expect.arrayContaining(['highlights', 'education', 'cheat_sheets', 'work_experiences'])
		);
	});

	it('restores the rows a pre-overhaul archive carries, replacing what is there', async () => {
		await importExportData(
			fullExport({
				salary_expectations: [
					{
						sort: 1,
						job_title: 'Backend Engineer',
						company_type: 'startup',
						employment_type: 'contract',
						work_arrangement: 'remote',
						experience_level: 'senior',
						region: 'nl',
						hourly_rate: 95,
						month_salary: null,
						year_salary: null,
						daily_rate: 760
					}
				]
			}),
			'u1',
			{ overwriteProfileId: 1 }
		);

		expect(deleted).toContain('salary_expectations');
		const rows = inserted.filter((i) => i.table === 'salary_expectations');
		expect(rows).toHaveLength(1);
		expect(rows[0].values).toMatchObject({
			profile_id: 1,
			job_title: 'Backend Engineer',
			region: 'nl',
			hourly_rate: 95,
			daily_rate: 760
		});
	});
});

/**
 * The same defect, found while fixing the one above and strictly worse.
 *
 * `importFullAccountEntities` restores stories, cheat sheets and applications,
 * and it runs for `scope: 'full'` alone — but the delete pass ran for every
 * overwrite import. Importing a profile-scope archive therefore erased the
 * profile's entire application history, letters and answers included, with
 * nothing in the payload able to put a single row back.
 */
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
