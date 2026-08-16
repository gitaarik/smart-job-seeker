/**
 * Tests for the library version editor's `update` and `delete` actions.
 *
 * The subject is one property: a version's slug is a *reference*, not a label.
 * `applications.cv_version_sent` stores a slug and item `tags` name one, and
 * neither is a foreign key — so renaming or deleting a version has to carry
 * them by hand. The tailored path (`promoteToLibrary`, and discarding a draft)
 * has always done this; the library editor did not, and nothing failed when it
 * didn't: the tag stayed on the item, still looking right, while the item
 * stopped printing on the document it named.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';

const mockVersionFindFirst = vi.fn();
const mockProfileFindFirst = vi.fn();
const mockGetSelectedProfileId = vi.fn();
const mockRetagVersionSlug = vi.fn();
const mockGenerateVersionPdfs = vi.fn();

/** Every `update(table).set(values)` the action performs, in order. */
const updates: { table: unknown; values: Record<string, unknown> }[] = [];
const mockUpdate = vi.fn((table: unknown) => ({
	set: (values: Record<string, unknown>) => {
		updates.push({ table, values });
		return { where: vi.fn().mockResolvedValue(undefined) };
	}
}));

const deletes: unknown[] = [];
const mockDelete = vi.fn((table: unknown) => {
	deletes.push(table);
	return { where: vi.fn().mockResolvedValue(undefined) };
});

vi.mock('$lib/server/db', () => ({
	dbDirect: {
		query: {
			profile_versions: {
				findFirst: (...a: unknown[]) => mockVersionFindFirst(...a),
				findMany: vi.fn().mockResolvedValue([])
			},
			profiles: { findFirst: (...a: unknown[]) => mockProfileFindFirst(...a) }
		},
		update: (table: unknown) => mockUpdate(table),
		delete: (table: unknown) => mockDelete(table),
		insert: vi.fn(() => ({ values: vi.fn().mockResolvedValue(undefined) }))
	},
	queryRaw: vi.fn().mockResolvedValue([]),
	sql: Object.assign(vi.fn(), { raw: vi.fn() })
}));

vi.mock('drizzle-orm', () => ({
	eq: vi.fn((c: unknown, v: unknown) => ({ c, v })),
	and: vi.fn((...a: unknown[]) => a),
	ne: vi.fn((c: unknown, v: unknown) => ({ c, v })),
	or: vi.fn((...a: unknown[]) => a),
	asc: vi.fn((c: unknown) => c),
	isNull: vi.fn((c: unknown) => c)
}));

vi.mock('$lib/server/db/schema', () => ({
	profile_versions: { __table: 'profile_versions', id: 'pv.id', profile_id: 'pv.profile_id' },
	profile_version_extensions: { __table: 'profile_version_extensions' },
	profiles: { __table: 'profiles', id: 'p.id' },
	applications: {
		__table: 'applications',
		profile_id: 'a.profile_id',
		cv_version_sent: 'a.cv_version_sent'
	}
}));

vi.mock('../../../utils', () => ({
	getSelectedProfileId: (...a: unknown[]) => mockGetSelectedProfileId(...a)
}));

vi.mock('$lib/server/profile/generate-version-pdfs', () => ({
	generateVersionPdfs: (...a: unknown[]) => mockGenerateVersionPdfs(...a)
}));

vi.mock('$lib/server/profile/tailor-version', () => ({
	retagVersionSlug: (...a: unknown[]) => mockRetagVersionSlug(...a)
}));

vi.mock('$lib/server/billing/credits', () => ({ chargeCredits: vi.fn() }));
vi.mock('$lib/server/billing/require-credits', () => ({ requireCredits: vi.fn() }));
vi.mock('$lib/resume-contact-fields', () => ({ buildToggles: vi.fn(() => []) }));
vi.mock('$lib/version-overrides', () => ({ isTailoredSlug: vi.fn(() => false) }));

import { actions } from '../+page.server';

function tableOf(entry: { table: unknown }): string {
	return (entry.table as { __table: string }).__table;
}

function createEvent(fields: Record<string, string>, id = '7') {
	const fd = new FormData();
	for (const [k, v] of Object.entries(fields)) fd.set(k, v);
	return {
		params: { id },
		locals: { user: { id: 'user-1' } },
		cookies: {} as never,
		request: { formData: async () => fd }
	} as never;
}

describe('library version editor', () => {
	beforeEach(() => {
		vi.clearAllMocks();
		updates.length = 0;
		deletes.length = 0;
		mockGetSelectedProfileId.mockResolvedValue(12);
		mockProfileFindFirst.mockResolvedValue({
			public_resume_version_id: null,
			public_cv_version_id: null
		});
		mockRetagVersionSlug.mockResolvedValue(0);
		mockGenerateVersionPdfs.mockReturnValue(Promise.resolve());
		// Default: the version exists, and no other version claims the new slug.
		mockVersionFindFirst.mockResolvedValue(undefined);
		mockVersionFindFirst.mockResolvedValueOnce({
			id: 7,
			profile_id: 12,
			slug: 'frontend',
			name: 'Frontend',
			application_id: null,
			toggles: []
		});
	});

	describe('update', () => {
		it('carries the sent-record and the item tags when the slug changes', async () => {
			await actions.update(createEvent({ slug: 'frontend-eu', name: 'Frontend EU' }));

			const appUpdate = updates.find((u) => tableOf(u) === 'applications');
			expect(appUpdate?.values).toMatchObject({ cv_version_sent: 'frontend-eu' });
			expect(mockRetagVersionSlug).toHaveBeenCalledWith(12, 'frontend', 'frontend-eu');
		});

		it('leaves both alone when the slug is unchanged', async () => {
			await actions.update(createEvent({ slug: 'frontend', name: 'Renamed only' }));

			expect(updates.some((u) => tableOf(u) === 'applications')).toBe(false);
			expect(mockRetagVersionSlug).not.toHaveBeenCalled();
			// The name still gets written — only the reference-carrying is skipped.
			expect(updates.find((u) => tableOf(u) === 'profile_versions')?.values).toMatchObject({
				slug: 'frontend',
				name: 'Renamed only'
			});
		});

		it('surrounding whitespace is not a rename', async () => {
			await actions.update(createEvent({ slug: '  frontend  ', name: 'Frontend' }));

			expect(mockRetagVersionSlug).not.toHaveBeenCalled();
		});

		it('refuses a slug another version already uses, and writes nothing', async () => {
			mockVersionFindFirst.mockResolvedValueOnce({ id: 9 }); // the clash lookup

			const result = (await actions.update(createEvent({ slug: 'backend', name: 'Frontend' }))) as {
				status: number;
				data: { error: string };
			};

			expect(result.status).toBe(400);
			expect(result.data.error).toContain('backend');
			expect(updates).toHaveLength(0);
			expect(mockRetagVersionSlug).not.toHaveBeenCalled();
		});

		it('checks for a clash when a version gets its first slug, but retags nothing', async () => {
			mockVersionFindFirst.mockReset();
			mockVersionFindFirst.mockResolvedValue(undefined);
			mockVersionFindFirst.mockResolvedValueOnce({
				id: 7,
				profile_id: 12,
				slug: null,
				name: null,
				application_id: null,
				toggles: []
			});

			await actions.update(createEvent({ slug: 'frontend', name: 'Frontend' }));

			// Two lookups: the version itself, then the clash check.
			expect(mockVersionFindFirst).toHaveBeenCalledTimes(2);
			expect(mockRetagVersionSlug).not.toHaveBeenCalled();
			expect(updates.some((u) => tableOf(u) === 'applications')).toBe(false);
		});
	});

	describe('delete', () => {
		async function runDelete() {
			try {
				await actions.delete(createEvent({}));
			} catch (e) {
				// The action ends in a redirect, which throws by design.
				return e;
			}
		}

		it('drops item tags naming the retired slug', async () => {
			await runDelete();

			expect(mockRetagVersionSlug).toHaveBeenCalledWith(12, 'frontend', null);
		});

		it('keeps the record of having sent it', async () => {
			await runDelete();

			// Deleting a library document does not un-send it. A tailored draft is
			// cleared on delete because it belonged to one application and was
			// never sent; this may have gone to many, and nulling the column would
			// erase a true statement on every one of them.
			expect(updates.some((u) => tableOf(u) === 'applications')).toBe(false);
		});
	});
});
