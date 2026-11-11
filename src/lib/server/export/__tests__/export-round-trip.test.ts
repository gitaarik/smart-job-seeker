/**
 * Every column the export reads leaves in the payload and comes back on import.
 *
 * export-columns.ts names every column of every table the export reads, and
 * the type check holds those lists to the schema. What it cannot see is the two
 * hand-written steps after the query: the mapping that writes the payload and
 * the importer that writes rows from it. A column read and never written out,
 * or written out and never imported, is how a role's headline and every
 * skill's tags went missing from every restored profile and demo copy until
 * 2026-11-03.
 *
 * So this builds a profile with a value in every column the lists carry,
 * exports it, imports the payload, and checks each one arrived. The schema is
 * real and the database is not: what is asserted is what the importer asks to
 * insert.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { getTableName, type Table } from 'drizzle-orm';

/** Rows the importer asked to insert, by table. */
const inserted: { table: string; values: Record<string, unknown> }[] = [];
/** The profile the export reads; the import side sees no existing rows. */
let stored: Record<string, unknown> | undefined;
let nextId = 1000;

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

vi.mock('$lib/server/db', () => ({
	dbDirect: {
		query: new Proxy(
			{},
			{
				get: (_target, table) => ({
					findFirst: () => Promise.resolve(table === 'profiles' ? stored : undefined),
					findMany: () => Promise.resolve([])
				})
			}
		),
		insert: (table: Table) => ({
			values: (values: Record<string, unknown>) => {
				inserted.push({ table: getTableName(table), values });
				return chain([{ id: nextId++ }]);
			}
		}),
		update: () => chain([]),
		delete: () => chain([])
	}
}));

// The sidecars have tests of their own (export-sidecars.test.ts); here they
// carry nothing.
vi.mock('$lib/server/files', () => ({ getFile: vi.fn(), uploadFile: vi.fn() }));
vi.mock('../export-translations', async (original) => ({
	...(await original<typeof import('../export-translations')>()),
	buildTranslationExport: () => Promise.resolve([])
}));
vi.mock('../export-templates', () => ({
	buildTemplateExport: () => Promise.resolve({ templates: [], assetPayloads: [] })
}));
vi.mock('../import-translations', async (original) => ({
	...(await original<typeof import('../import-translations')>()),
	deleteProfileTranslations: () => Promise.resolve(),
	importTranslations: () => Promise.resolve(0)
}));
vi.mock('../import-documents', async (original) => ({
	...(await original<typeof import('../import-documents')>()),
	deleteProfileDocuments: () => Promise.resolve(),
	importDocuments: () => Promise.resolve(0)
}));
vi.mock('../import-templates', () => ({
	deleteProfilePresentationTemplates: () => Promise.resolve(),
	importResumeTemplates: () => Promise.resolve({ imported: 0 })
}));
vi.mock('$lib/server/profile/certificate-file', () => ({
	certificateFilesByName: () => Promise.resolve(new Map()),
	restoreCertificateFiles: () => Promise.resolve()
}));
vi.mock('$lib/server/profile/generate-version-pdfs', () => ({
	generateVersionPdfs: () => Promise.resolve()
}));

const COLUMNS = await import('../export-columns');
const { buildProfileExport } = await import('../export-profile');
const { importExportData } = await import('../import-data');

type Columns = Record<string, boolean>;
type Row = Record<string, unknown>;

/** A value every step keeps: truthy, and the shape its column holds. */
function sample(column: string): unknown {
	if (column === 'id') return nextId++;
	if (column === 'tags') return ['resume'];
	if (column === 'featured') return true;
	if (column === 'toggles') return { summary: true };
	if (['sort', 'stars', 'years_experience', 'featured_sort'].includes(column)) return 2;
	if (/(^|_)date$/.test(column)) return '2020-01-02';
	if (/_year$/.test(column)) return 2010;
	return `${column} value`;
}

/** A stored row with a value in every column the list carries, plus its relations. */
function row(columns: Columns, relations: Row = {}): Row {
	const carried = Object.entries(columns).filter(([, isCarried]) => isCarried);
	return {
		...Object.fromEntries(carried.map(([column]) => [column, sample(column)])),
		...relations
	};
}

function profileWithEverything(): Row {
	const role = row(COLUMNS.ROLE_COLUMNS, {
		work_experience_achievements: [row(COLUMNS.ROLE_ACHIEVEMENT_COLUMNS)],
		work_experience_technologies: [row(COLUMNS.ROLE_TECHNOLOGY_COLUMNS)],
		work_experience_projects: [
			row(COLUMNS.ROLE_PROJECT_COLUMNS, {
				work_experience_project_technologies: [row(COLUMNS.ROLE_PROJECT_TECHNOLOGY_COLUMNS)]
			})
		]
	});
	return row(COLUMNS.PROFILE_COLUMNS, {
		profile_versions: [row(COLUMNS.VERSION_COLUMNS, { extension_links: [] })],
		highlights: [row(COLUMNS.HIGHLIGHT_COLUMNS)],
		tech_skill_categories: [
			row(COLUMNS.SKILL_CATEGORY_COLUMNS, {
				tech_skills: [row(COLUMNS.SKILL_COLUMNS, { tech_skill_type: { slug: 'framework' } })]
			})
		],
		work_experiences: [role],
		side_projects: [
			row(COLUMNS.SIDE_PROJECT_COLUMNS, {
				side_project_achievements: [row(COLUMNS.SIDE_PROJECT_ACHIEVEMENT_COLUMNS)],
				side_project_technologies: [row(COLUMNS.SIDE_PROJECT_TECHNOLOGY_COLUMNS)]
			})
		],
		educations: [row(COLUMNS.EDUCATION_COLUMNS)],
		languages: [row(COLUMNS.LANGUAGE_COLUMNS)],
		// A role's wording, so its role travels as a position.
		field_variants: [row(COLUMNS.FIELD_VARIANT_COLUMNS, { work_experience_id: role.id })],
		references: [row(COLUMNS.REFERENCE_COLUMNS)],
		certificates: [
			row(COLUMNS.CERTIFICATE_COLUMNS, {
				certificate_skills: [row(COLUMNS.CERTIFICATE_SKILL_COLUMNS)]
			})
		]
	});
}

/**
 * Carried, but not by the row's insert: a media path is set once its file is
 * restored, and a slot's rendition once the media library is
 * (export-media-library.test.ts covers that half).
 */
const SET_AFTER_INSERT: Record<string, string[]> = {
	profiles: ['profile_photo_path', 'profile_photo_id'],
	work_experiences: ['logo_path', 'banner_path', 'logo_id', 'banner_id'],
	education: ['logo_path', 'banner_path', 'logo_id', 'banner_id'],
	side_projects: ['image_path', 'banner_path', 'image_id', 'banner_id', 'logo_id']
};

/** Carried under another name in the payload. */
const PAYLOAD_NAME: Record<string, Record<string, string>> = {
	profile_field_variants: { work_experience_id: 'work_experience_index' }
};

/** Each table the export reads: its list, and where its first row sits in the payload. */
const TABLES: { table: string; columns: Columns; inPayload: (p: Row) => Row }[] = (() => {
	const first = (p: Row, key: string) => (p[key] as Row[])[0];
	const role = (p: Row) => first(p, 'work_experiences');
	const project = (p: Row) => first(role(p), 'projects');
	const sideProject = (p: Row) => first(p, 'side_projects');
	const category = (p: Row) => first(p, 'tech_skill_categories');
	const certificate = (p: Row) => first(p, 'certificates');
	return [
		{ table: 'profiles', columns: COLUMNS.PROFILE_COLUMNS, inPayload: (p) => p },
		{
			table: 'profile_versions',
			columns: COLUMNS.VERSION_COLUMNS,
			inPayload: (p) => first(p, 'profile_versions')
		},
		{
			table: 'highlights',
			columns: COLUMNS.HIGHLIGHT_COLUMNS,
			inPayload: (p) => first(p, 'highlights')
		},
		{
			table: 'tech_skill_categories',
			columns: COLUMNS.SKILL_CATEGORY_COLUMNS,
			inPayload: category
		},
		{
			table: 'tech_skills',
			columns: COLUMNS.SKILL_COLUMNS,
			inPayload: (p) => first(category(p), 'tech_skills')
		},
		{ table: 'work_experiences', columns: COLUMNS.ROLE_COLUMNS, inPayload: role },
		{
			table: 'work_experience_achievements',
			columns: COLUMNS.ROLE_ACHIEVEMENT_COLUMNS,
			inPayload: (p) => first(role(p), 'achievements')
		},
		{
			table: 'work_experience_technologies',
			columns: COLUMNS.ROLE_TECHNOLOGY_COLUMNS,
			inPayload: (p) => first(role(p), 'technologies')
		},
		{
			table: 'work_experience_projects',
			columns: COLUMNS.ROLE_PROJECT_COLUMNS,
			inPayload: project
		},
		{
			table: 'work_experience_project_technologies',
			columns: COLUMNS.ROLE_PROJECT_TECHNOLOGY_COLUMNS,
			inPayload: (p) => first(project(p), 'technologies')
		},
		{ table: 'side_projects', columns: COLUMNS.SIDE_PROJECT_COLUMNS, inPayload: sideProject },
		{
			table: 'side_project_achievements',
			columns: COLUMNS.SIDE_PROJECT_ACHIEVEMENT_COLUMNS,
			inPayload: (p) => first(sideProject(p), 'achievements')
		},
		{
			table: 'side_project_technologies',
			columns: COLUMNS.SIDE_PROJECT_TECHNOLOGY_COLUMNS,
			inPayload: (p) => first(sideProject(p), 'technologies')
		},
		{
			table: 'education',
			columns: COLUMNS.EDUCATION_COLUMNS,
			inPayload: (p) => first(p, 'education')
		},
		{
			table: 'languages',
			columns: COLUMNS.LANGUAGE_COLUMNS,
			inPayload: (p) => first(p, 'languages')
		},
		{
			table: 'profile_field_variants',
			columns: COLUMNS.FIELD_VARIANT_COLUMNS,
			inPayload: (p) => first(p, 'field_variants')
		},
		{
			table: 'references',
			columns: COLUMNS.REFERENCE_COLUMNS,
			inPayload: (p) => first(p, 'references')
		},
		{ table: 'certificates', columns: COLUMNS.CERTIFICATE_COLUMNS, inPayload: certificate },
		{
			table: 'certificate_skills',
			columns: COLUMNS.CERTIFICATE_SKILL_COLUMNS,
			inPayload: (p) => first(certificate(p), 'skills')
		}
	];
})();

/** The columns a list carries as content: an `id` read only to number the payload is not. */
const carried = (columns: Columns) =>
	Object.entries(columns)
		.filter(([column, isCarried]) => isCarried && column !== 'id')
		.map(([column]) => column);

describe('a profile, exported and imported again', () => {
	let payload: Row;

	beforeEach(async () => {
		inserted.length = 0;
		stored = profileWithEverything();
		const { data } = await buildProfileExport(1);
		payload = data.profile as unknown as Row;
		stored = undefined;
		await importExportData(data, 'u1');
	});

	it.each(TABLES)(
		'carries every column of $table into the payload',
		({ table, columns, inPayload }) => {
			const entry = inPayload(payload);
			const missing = carried(columns).filter((column) => {
				const key = PAYLOAD_NAME[table]?.[column] ?? column;
				return entry[key] === undefined;
			});
			expect(missing).toEqual([]);
		}
	);

	it.each(TABLES)('writes every column of $table back', ({ table, columns }) => {
		const values = inserted.find((row) => row.table === table)?.values;
		expect(values, `no ${table} row was inserted`).toBeDefined();
		const missing = carried(columns).filter(
			(column) => !SET_AFTER_INSERT[table]?.includes(column) && values?.[column] === undefined
		);
		expect(missing).toEqual([]);
	});
});
