/**
 * The media library leaves in the archive and comes back on import, column by
 * column, the way export-round-trip.test.ts checks the rest of the profile.
 *
 * export-columns.ts decides each column of the three library tables; this
 * fills every carried one, exports, imports the payload, and names any column
 * that is missing from the payload or from what the importer inserts. It also
 * checks the remapping the library depends on: a rendition names its item and
 * its preset by source id or key, and a slot names its rendition.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { getTableName, type Table } from 'drizzle-orm';
import sharp from 'sharp';

const inserted: { table: string; values: Record<string, unknown> }[] = [];
const updated: { sql: string; values: unknown[] }[] = [];
let stored: Record<string, unknown[]> = {};
let nextId = 5000;
let nextUuid = 1;

const uuid = (n: number) => `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`;

function chain(result: unknown) {
	const obj: Record<string, unknown> = {};
	const self = () => obj;
	Object.assign(obj, {
		where: self,
		set: self,
		onConflictDoNothing: self,
		returning: () => Promise.resolve(result),
		then: (res: (v: unknown) => unknown, rej: (e: unknown) => unknown) =>
			Promise.resolve(result).then(res, rej)
	});
	return obj;
}

vi.mock('$lib/server/db', () => {
	const dbDirect: Record<string, unknown> = {
		query: new Proxy(
			{},
			{
				get: (_target, table: string) => ({
					findMany: () => Promise.resolve(stored[table] ?? []),
					findFirst: () => Promise.resolve((stored[table] ?? [])[0])
				})
			}
		),
		insert: (table: Table) => ({
			values: (values: Record<string, unknown>) => {
				const name = getTableName(table);
				inserted.push({ table: name, values });
				const id = name === 'media_renditions' ? uuid(nextUuid++) : nextId++;
				return chain([{ id }]);
			}
		}),
		update: () => chain([]),
		delete: () => chain([]),
		// insertWithinBudget's transaction and advisory lock: the same object
		// stands in for the transaction, and the lock is a no-op.
		execute: () => Promise.resolve(),
		transaction: (fn: (tx: unknown) => unknown) => fn(dbDirect)
	};
	return {
		dbDirect,
		queryRawDirect: (query: { queryChunks?: unknown[] }) => {
			updated.push({ sql: JSON.stringify(query.queryChunks ?? []), values: [] });
			return Promise.resolve([]);
		}
	};
});

let png: Buffer;
vi.mock('$lib/server/files', () => ({
	getFile: () => Promise.resolve(png),
	uploadFile: () =>
		Promise.resolve({
			id: uuid(9000 + nextUuid++),
			filename_disk: 'x',
			type: 'image/png',
			filesize: 1
		}),
	deleteFile: () => Promise.resolve()
}));

const COLUMNS = await import('../export-columns');
const { buildMediaLibraryExport } = await import('../export-media-library');
const { importMediaLibrary, restoreSlotRenditions } = await import('../import-media-library');

type Row = Record<string, unknown>;

/** A value for every carried column, in the shape the column holds. */
function sample(column: string): unknown {
	switch (column) {
		case 'kind':
			return 'banner';
		case 'format':
			return 'png';
		case 'mask':
			return 'circle';
		case 'formats':
			return ['jpeg', 'png'];
		case 'safe_zone':
			return [{ kind: 'covered', x: 0, y: 0, w: 2, h: 2 }];
		case 'has_alpha':
			return true;
		case 'orientation':
			return 1;
		case 'date_created':
			return new Date('2026-11-08T00:00:00Z');
		case 'verified_on':
			return '2026-11-08';
		case 'source_url':
			return 'https://example.com/help';
		default:
			return /^(width|height|crop_[xywh]|max_bytes|sort|quality)$/.test(column)
				? 4
				: `${column} value`;
	}
}

function row(columns: Record<string, boolean>, overrides: Row = {}): Row {
	const carried = Object.entries(columns).filter(([, isCarried]) => isCarried);
	return { ...Object.fromEntries(carried.map(([c]) => [c, sample(c)])), ...overrides };
}

const carried = (columns: Record<string, boolean>) =>
	Object.entries(columns)
		.filter(([column, isCarried]) => isCarried && column !== 'id')
		.map(([column]) => column);

beforeEach(async () => {
	inserted.length = 0;
	updated.length = 0;
	nextUuid = 1;
	png = await sharp({ create: { width: 4, height: 4, channels: 4, background: '#ff000080' } })
		.png()
		.toBuffer();
	const item = row(COLUMNS.MEDIA_ITEM_COLUMNS, {
		id: 11,
		width: 4,
		height: 4,
		replaces_id: 10,
		file: { id: uuid(100) },
		template: { kind: 'banner', slug: 'linkedin' }
	});
	const older = row(COLUMNS.MEDIA_ITEM_COLUMNS, {
		id: 10,
		width: 4,
		height: 4,
		replaces_id: null,
		file: { id: uuid(101) },
		template: null
	});
	const ownPreset = row(COLUMNS.MEDIA_PRESET_COLUMNS, { id: 21 });
	stored = {
		media_items: [older, item],
		media_presets: [ownPreset],
		media_renditions: [
			row(COLUMNS.MEDIA_RENDITION_COLUMNS, {
				id: uuid(31),
				item_id: 11,
				preset: { id: 21, key: null, profile_id: 1 },
				file: { id: uuid(102) }
			}),
			row(COLUMNS.MEDIA_RENDITION_COLUMNS, {
				id: uuid(32),
				item_id: 11,
				format: 'jpeg',
				preset: { id: 3, key: 'linkedin-background', profile_id: null },
				file: null
			})
		]
	};
});

describe('the media library, exported and imported again', () => {
	it('carries every decided column into the payload', async () => {
		const { library, files } = await buildMediaLibraryExport(1);
		const missing = (
			entry: Row,
			columns: Record<string, boolean>,
			renamed: Record<string, string> = {}
		) => carried(columns).filter((column) => entry[renamed[column] ?? column] === undefined);

		expect(missing(library.items[1] as unknown as Row, COLUMNS.MEDIA_ITEM_COLUMNS)).toEqual([]);
		expect(missing(library.presets[0] as unknown as Row, COLUMNS.MEDIA_PRESET_COLUMNS)).toEqual([]);
		expect(
			missing(library.renditions[0] as unknown as Row, COLUMNS.MEDIA_RENDITION_COLUMNS, {
				preset_id: 'preset'
			})
		).toEqual([]);
		// Originals always, a rendition's bytes when it had been drawn.
		expect(files.map((f) => f.archivePath).sort()).toEqual([
			'media-library/originals/10.png',
			'media-library/originals/11.png',
			`media-library/renditions/${uuid(31)}.png`
		]);
		expect(library.renditions[0].preset).toEqual({ own: 21 });
		expect(library.renditions[1].preset).toEqual({ key: 'linkedin-background' });
		expect(library.items[1].template).toEqual({ kind: 'banner', slug: 'linkedin' });
	});

	it('writes every carried column back and maps the ids', async () => {
		const { library, files } = await buildMediaLibraryExport(1);
		const archive = new Map(files.map((f) => [f.archivePath, f.buffer]));
		// The import side: the shared preset this database has under that key.
		stored = { media_presets: [{ id: 77, key: 'linkedin-background' }] };

		const maps = await importMediaLibrary(2, library, archive);

		const first = (table: string) => inserted.find((r) => r.table === table)?.values;
		const notWritten = (table: string, columns: Record<string, boolean>, setLater: string[]) =>
			carried(columns).filter(
				(column) => !setLater.includes(column) && first(table)?.[column] === undefined
			);
		// replaces_id is set once both items exist; template_id once templates do.
		expect(notWritten('media_items', COLUMNS.MEDIA_ITEM_COLUMNS, ['replaces_id'])).toEqual([]);
		expect(notWritten('media_presets', COLUMNS.MEDIA_PRESET_COLUMNS, [])).toEqual([]);
		expect(notWritten('media_renditions', COLUMNS.MEDIA_RENDITION_COLUMNS, [])).toEqual([]);

		expect(maps.items.size).toBe(2);
		expect(maps.renditions.size).toBe(2);
		const renditions = inserted.filter((r) => r.table === 'media_renditions').map((r) => r.values);
		// The own preset is the one this import made; the shared one is found by key.
		const madePreset = inserted.find((r) => r.table === 'media_presets');
		expect(madePreset?.values.profile_id).toBe(2);
		expect(renditions.map((r) => r.preset_id)).toEqual([expect.any(Number), 77]);
		expect(renditions[0].preset_id).not.toBe(21);
		// Drawn bytes came along for the first; the second is drawn after import.
		expect(renditions[0].file_id).toBeTruthy();
		expect(renditions[1].file_id).toBeNull();
		expect(maps.itemTemplates.get(11)).toEqual({ kind: 'banner', slug: 'linkedin' });
	});

	it('points slots at the restored renditions, and only those', async () => {
		const { library, files } = await buildMediaLibraryExport(1);
		stored = { media_presets: [] };
		const maps = await importMediaLibrary(
			2,
			library,
			new Map(files.map((f) => [f.archivePath, f.buffer]))
		);
		updated.length = 0;
		await restoreSlotRenditions(maps, [
			{ table: 'profiles', column: 'profile_photo_id', id: 2, source: uuid(31) },
			{ table: 'work_experiences', column: 'logo_id', id: 9, source: uuid(999) },
			{ table: 'education', column: 'logo_id', id: 8, source: null }
		]);
		// One write: the unknown source and the empty one change nothing.
		expect(updated).toHaveLength(1);
		expect(updated[0].sql).toContain('profile_photo_id');
	});

	it('keeps a rendition whose shared preset this database lacks, as a free crop', async () => {
		const { library, files } = await buildMediaLibraryExport(1);
		stored = { media_presets: [] };
		await importMediaLibrary(2, library, new Map(files.map((f) => [f.archivePath, f.buffer])));
		const renditions = inserted.filter((r) => r.table === 'media_renditions').map((r) => r.values);
		expect(renditions[1].preset_id).toBeNull();
	});
});

describe('a restored banner drawing', () => {
	it('finds the template it was drawn from by the key the template import writes', async () => {
		const { restoreItemTemplates, templateKey, emptyMediaLibraryIdMaps } =
			await import('../import-media-library');
		const maps = emptyMediaLibraryIdMaps();
		maps.items.set(11, 501);
		maps.itemTemplates.set(11, { kind: 'banner', slug: 'linkedin' });
		updated.length = 0;
		const writes: unknown[] = [];
		const db = (await import('$lib/server/db')).dbDirect as unknown as {
			update: (t: unknown) => unknown;
		};
		const original = db.update;
		db.update = (t: unknown) => {
			writes.push(t);
			return original(t);
		};
		await restoreItemTemplates(maps, new Map([[templateKey('banner', 'linkedin'), 900]]));
		db.update = original;
		expect(writes).toHaveLength(1);
	});
});
