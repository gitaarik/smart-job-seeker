import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { sectionRows } from './section-rows.svelte';

/**
 * The store behind every auto-saving child collection.
 *
 * What is worth pinning is the part that is not "call fetch": a row that does
 * not exist yet must be created exactly once however fast the user types, a row
 * that holds nothing must not be created at all, and a PATCH must carry only
 * what changed — including not carrying a tag array that was merely rebuilt.
 *
 * Runs in the client project (jsdom) because the store uses runes.
 */

interface Sent {
	url: string;
	method: string;
	body: Record<string, unknown> | null;
}

let sent: Sent[] = [];
let respond: (req: Sent) => { ok: boolean; status?: number; body?: unknown };

function mockFetch() {
	vi.stubGlobal('fetch', (url: string, init?: RequestInit) => {
		const req: Sent = {
			url,
			method: init?.method ?? 'GET',
			body: init?.body ? JSON.parse(init.body as string) : null
		};
		sent.push(req);
		const { ok, status = ok ? 200 : 500, body = { success: true } } = respond(req);
		return Promise.resolve({
			ok,
			status,
			json: () => Promise.resolve(body)
		} as Response);
	});
}

/** Let the awaits inside a save settle. */
const settle = async () => {
	for (let i = 0; i < 6; i++) await Promise.resolve();
};

function makeStore(initial: Array<{ id: number; name: string | null }> = []) {
	return sectionRows({
		resource: 'work_experience_project',
		parentKey: 'work_experience_id',
		parentId: 8,
		profileId: 3,
		initial,
		toData: (r) => ({ name: r.name ?? '', tags: [] as string[] }),
		blank: () => ({ name: '', tags: [] as string[] }),
		toBody: (v: { name: string; tags: string[] }) => ({
			name: v.name.trim(),
			tags: v.tags.length > 0 ? v.tags : null
		}),
		canCreate: (v: { name: string }) => v.name.trim().length > 0,
		debounceMs: 0
	});
}

describe('sectionRows', () => {
	beforeEach(() => {
		sent = [];
		respond = () => ({ ok: true, body: { success: true, id: 99 } });
		mockFetch();
	});
	afterEach(() => vi.unstubAllGlobals());

	it('loads the rows the page gave it', () => {
		const store = makeStore([{ id: 1, name: 'Migration' }]);
		expect(store.rows.map((r) => [r.id, r.data.name])).toEqual([[1, 'Migration']]);
		expect(sent).toHaveLength(0);
	});

	it('does not create a draft that holds nothing', async () => {
		const store = makeStore();
		const row = store.add();
		store.update(row, { name: '   ' });
		await settle();

		// A row the user opened and did not fill in is not a failed save; it is
		// not a save. Posting it would be a validation error at best and a
		// nameless entry on their CV at worst.
		expect(sent).toHaveLength(0);
		expect(row.field.status).toBe('idle');
	});

	it('creates a draft once it holds enough, and patches after that', async () => {
		const store = makeStore();
		const row = store.add();

		store.update(row, { name: 'Migration' });
		await settle();
		expect(sent).toEqual([
			{
				url: '/api/profile-section/work_experience_project',
				method: 'POST',
				body: { name: 'Migration', tags: null, work_experience_id: 8, profile_id: 3 }
			}
		]);
		expect(row.id).toBe(99);

		store.update(row, { name: 'Migration II' });
		await settle();
		expect(sent[1]).toEqual({
			url: '/api/profile-section/work_experience_project/99',
			method: 'PATCH',
			body: { name: 'Migration II' }
		});
	});

	it('creates a row once however fast the edits arrive', async () => {
		// autoSaveField starts a newer save while an older one is in flight and
		// discards the older RESULT — right for a patch, and two rows for a post.
		const store = makeStore();
		const row = store.add();

		store.update(row, { name: 'M' });
		store.update(row, { name: 'Mi' });
		store.update(row, { name: 'Mig' });
		await settle();

		expect(sent.filter((r) => r.method === 'POST')).toHaveLength(1);
	});

	it('patches only what changed', async () => {
		const store = makeStore([{ id: 1, name: 'Migration' }]);
		const [row] = store.rows;

		store.update(row, { tags: ['resume'] });
		await settle();

		// Not the name, which nobody touched — and the body is built fresh on both
		// sides of the diff, so this is also the array-comparison test.
		expect(sent[0].body).toEqual({ tags: ['resume'] });

		store.update(row, { name: 'Migration II' });
		await settle();
		expect(sent[1].body).toEqual({ name: 'Migration II' });
	});

	it('reports a failed save on the row that failed', async () => {
		respond = () => ({ ok: false, status: 400, body: { message: 'Project name is required' } });
		const store = makeStore([{ id: 1, name: 'Migration' }]);
		const [row] = store.rows;

		store.update(row, { name: 'x' });
		await settle();

		expect(row.field.status).toBe('error');
		expect(row.field.error).toBe('Project name is required');
	});

	it('deletes a created row on the server and a draft only locally', async () => {
		const store = makeStore([{ id: 1, name: 'Migration' }]);
		const draft = store.add();

		await store.remove(draft);
		expect(sent).toHaveLength(0);
		expect(store.rows).toHaveLength(1);

		await store.remove(store.rows[0]);
		expect(sent).toEqual([
			{ url: '/api/profile-section/work_experience_project/1', method: 'DELETE', body: null }
		]);
		expect(store.rows).toHaveLength(0);
	});

	it('keeps the row when a delete fails', async () => {
		respond = () => ({ ok: false, status: 403, body: { error: 'Access denied' } });
		const store = makeStore([{ id: 1, name: 'Migration' }]);

		await expect(store.remove(store.rows[0])).rejects.toThrow('Access denied');
		expect(store.rows).toHaveLength(1);
	});

	it('reorders locally first, and sends only the rows that exist', async () => {
		const store = makeStore([
			{ id: 1, name: 'A' },
			{ id: 2, name: 'B' }
		]);
		const draft = store.add();
		const [a, b] = store.rows;

		await store.reorder([b, draft, a]);

		expect(store.rows.map((r) => r.data.name)).toEqual(['B', '', 'A']);
		expect(sent).toEqual([
			{
				url: '/api/profile-section/work_experience_project/reorder',
				method: 'POST',
				body: { profile_id: 3, order: [2, 1] }
			}
		]);
		expect(draft.id).toBeNull();
	});

	describe('the section summary', () => {
		// A chip is too small for a pill of its own, so the section gets one. What
		// it must never do is under-report: a page that has just lost its Save
		// buttons is answering "is this saving?" with this, and silence reads as
		// "no".
		it('is idle with nothing happening', () => {
			const store = makeStore([{ id: 1, name: 'A' }]);
			expect(store.summary.status).toBe('idle');
			expect(store.summary.error).toBeNull();
		});

		it('reports saving while any row is in flight', async () => {
			const store = makeStore([{ id: 1, name: 'A' }]);
			store.update(store.rows[0], { name: 'B' });
			expect(store.summary.status).toBe('saving');

			await settle();
			expect(store.summary.status).toBe('saved');
		});

		it('lets a failure outrank a success elsewhere', async () => {
			const store = makeStore([
				{ id: 1, name: 'A' },
				{ id: 2, name: 'B' }
			]);
			respond = (req) => (req.url.endsWith('/2') ? { ok: false, status: 400 } : { ok: true });

			store.update(store.rows[0], { name: 'A2' });
			store.update(store.rows[1], { name: 'B2' });
			await settle();

			expect(store.summary.status).toBe('error');
			expect(store.summary.error).toBe('Save failed (400)');
		});

		it('retries every row that failed, and only those', async () => {
			const store = makeStore([
				{ id: 1, name: 'A' },
				{ id: 2, name: 'B' }
			]);
			respond = (req) => (req.url.endsWith('/2') ? { ok: false, status: 500 } : { ok: true });

			store.update(store.rows[0], { name: 'A2' });
			store.update(store.rows[1], { name: 'B2' });
			await settle();
			expect(sent).toHaveLength(2);

			respond = () => ({ ok: true });
			store.summary.retry();
			await settle();

			expect(sent).toHaveLength(3);
			expect(sent[2].url).toContain('/2');
			expect(store.summary.status).toBe('saved');
		});

		it('offers no undo, because a section has no single previous value', () => {
			const store = makeStore([{ id: 1, name: 'A' }]);
			expect(store.summary.canUndo).toBe(false);
		});
	});

	it('reports whether anything is still in flight', async () => {
		const store = makeStore([{ id: 1, name: 'Migration' }]);
		expect(store.busy).toBe(false);

		store.update(store.rows[0], { name: 'Migration II' });
		expect(store.busy).toBe(true);

		await settle();
		expect(store.busy).toBe(false);
	});
});
