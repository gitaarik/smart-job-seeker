/**
 * The rules every caller of a version change keeps (versions.ts): a slug is
 * unique on its profile and never reserved, a renamed slug is carried to what
 * names the version by it, and a delete retires the slug without widening an
 * item, unpublishing and unlinking what pointed at the version.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';

const { mockFindFirst, mockFindMany, mockProfileFindFirst, writes, mockRetag } = vi.hoisted(() => ({
	mockFindFirst: vi.fn(),
	mockFindMany: vi.fn(),
	mockProfileFindFirst: vi.fn(),
	writes: [] as { op: string; table: string; values?: Record<string, unknown> }[],
	mockRetag: vi.fn()
}));

const tableName = (t: unknown) => (t as { __table: string }).__table;

vi.mock('$lib/server/db', () => ({
	dbDirect: {
		query: {
			profile_versions: { findFirst: mockFindFirst, findMany: mockFindMany },
			profiles: { findFirst: mockProfileFindFirst }
		},
		insert: (table: unknown) => ({
			values: (values: Record<string, unknown>) => {
				writes.push({ op: 'insert', table: tableName(table), values });
				return { returning: async () => [{ id: 300 }] };
			}
		}),
		update: (table: unknown) => ({
			set: (values: Record<string, unknown>) => {
				writes.push({ op: 'update', table: tableName(table), values });
				return { where: async () => undefined };
			}
		}),
		delete: (table: unknown) => {
			writes.push({ op: 'delete', table: tableName(table) });
			return { where: async () => undefined };
		}
	}
}));

vi.mock('$lib/server/db/schema', () => ({
	profile_versions: {
		__table: 'profile_versions',
		id: 'id',
		slug: 'slug',
		profile_id: 'profile_id'
	},
	profile_version_extensions: { __table: 'profile_version_extensions' },
	profiles: { __table: 'profiles', id: 'id' },
	applications: { __table: 'applications', profile_id: 'profile_id', cv_version_sent: 'sent' }
}));

vi.mock('../version-tags', () => ({ retagVersionSlug: mockRetag }));

import {
	createVersion,
	deleteVersion,
	renameVersion,
	restorePublicVersions,
	setPublicVersion,
	slugFromName,
	VersionError
} from '../versions';

const frontend = { id: 7, slug: 'frontend', name: 'Frontend', application_id: null };

beforeEach(() => {
	vi.clearAllMocks();
	writes.length = 0;
	mockFindFirst.mockResolvedValue(undefined);
	mockFindMany.mockResolvedValue([]);
	mockProfileFindFirst.mockResolvedValue({
		public_resume_version_id: null,
		public_cv_version_id: null
	});
});

describe('createVersion', () => {
	it('takes its slug from the name when none is given', async () => {
		expect(slugFromName('AI Engineer')).toBe('ai-engineer');
		const made = await createVersion(1, { name: 'AI Engineer' });
		expect(made).toEqual({ id: 300, slug: 'ai-engineer', name: 'AI Engineer' });
		expect(writes[0]).toMatchObject({
			op: 'insert',
			// Published: a draft renders as the plain document, its tags ignored.
			values: { slug: 'ai-engineer', profile_id: 1, status: 'published' }
		});
	});

	it('refuses a reserved slug and one already used, and writes nothing', async () => {
		await expect(createVersion(1, { name: 'x', slug: 'app-12' })).rejects.toThrow(VersionError);
		await expect(createVersion(1, { name: 'x', slug: 'cv' })).rejects.toThrow('reserved');
		mockFindFirst.mockResolvedValueOnce({ id: 9 });
		await expect(createVersion(1, { name: 'Frontend' })).rejects.toThrow('already uses');
		expect(writes).toHaveLength(0);
	});
});

describe('renameVersion', () => {
	it('carries a new slug to the sent-records and the item tags', async () => {
		mockFindFirst.mockResolvedValueOnce(frontend); // the version; no clash after it
		await renameVersion(1, 7, { name: 'Full-stack Engineer', slug: 'full-stack' });

		expect(writes.find((w) => w.table === 'profile_versions')?.values).toMatchObject({
			slug: 'full-stack',
			name: 'Full-stack Engineer'
		});
		expect(writes.find((w) => w.table === 'applications')?.values).toMatchObject({
			cv_version_sent: 'full-stack'
		});
		expect(mockRetag).toHaveBeenCalledWith(1, 'frontend', 'full-stack');
	});

	it('changes only the name when the slug stays', async () => {
		mockFindFirst.mockResolvedValueOnce(frontend);
		await renameVersion(1, 7, { name: 'Front' });
		expect(writes.some((w) => w.table === 'applications')).toBe(false);
		expect(mockRetag).not.toHaveBeenCalled();
	});

	it('refuses a slug another version uses', async () => {
		mockFindFirst.mockResolvedValueOnce(frontend).mockResolvedValueOnce({ id: 8 });
		await expect(renameVersion(1, 7, { slug: 'backend' })).rejects.toThrow('already uses');
		expect(writes).toHaveLength(0);
	});
});

describe('deleteVersion', () => {
	it('unpublishes it, unlinks it, and retires its slug into the version named', async () => {
		mockFindFirst.mockResolvedValueOnce(frontend);
		mockFindMany.mockResolvedValue([
			{ id: 7, slug: 'frontend', name: 'Frontend' },
			{ id: 8, slug: 'Full-stack', name: 'Full-stack Engineer' }
		]);
		mockProfileFindFirst.mockResolvedValue({
			public_resume_version_id: 7,
			public_cv_version_id: 8
		});

		await deleteVersion(1, 7, 'full-stack');

		expect(writes.find((w) => w.table === 'profiles')?.values).toEqual({
			public_resume_version_id: null
		});
		expect(writes.filter((w) => w.op === 'delete').map((w) => w.table)).toEqual([
			'profile_version_extensions',
			'profile_versions'
		]);
		// The version's own spelling of the target slug.
		expect(mockRetag).toHaveBeenCalledWith(1, 'frontend', null, 'Full-stack');
	});

	it('keeps items tagged for it alone off when no version is named', async () => {
		mockFindFirst.mockResolvedValueOnce(frontend);
		await deleteVersion(1, 7);
		expect(mockRetag).toHaveBeenCalledWith(1, 'frontend', null, null);
	});

	it('refuses to move them to a version that is not there, before deleting anything', async () => {
		mockFindFirst.mockResolvedValueOnce(frontend);
		await expect(deleteVersion(1, 7, 'nowhere')).rejects.toThrow('no other version');
		expect(writes).toHaveLength(0);
	});
});

describe('public versions', () => {
	it('sets the slots asked for and says what they were', async () => {
		mockFindFirst.mockResolvedValueOnce(frontend);
		mockProfileFindFirst.mockResolvedValue({
			public_resume_version_id: 90,
			public_cv_version_id: 90
		});

		expect(await setPublicVersion(1, 7, { resume: true })).toEqual({ resume: 90, cv: 90 });
		expect(writes[0].values).toEqual({ public_resume_version_id: 7 });
	});

	it('will not make a version for one application the public one', async () => {
		mockFindFirst.mockResolvedValueOnce({ ...frontend, application_id: 16 });
		await expect(setPublicVersion(1, 7, { resume: true })).rejects.toThrow(VersionError);
	});

	it('puts back only the slots it is given', async () => {
		await restorePublicVersions(1, { resume: 90 });
		expect(writes[0].values).toEqual({ public_resume_version_id: 90 });
		await restorePublicVersions(1, {});
		expect(writes).toHaveLength(1);
	});
});
