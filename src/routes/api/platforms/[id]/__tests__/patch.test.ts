/**
 * Tests for PATCH /api/platforms/[id]
 *
 * The rule under test is who may rewrite `job_platforms.login_page_url`. The
 * row is global and the column is where "auto" mode types every account's
 * stored password, so the question is not "is this user allowed to edit
 * platforms" but "could this edit redirect someone else's credentials".
 */

import { beforeEach, describe, expect, it, vi } from 'vitest';

// Hoisted so the mock factories below, which vitest lifts above the imports,
// can hand these out before this file's own statements have run.
const mocks = vi.hoisted(() => {
	const updateWhere = vi.fn();
	const updateSet = vi.fn(() => ({ where: updateWhere }));
	const update = vi.fn(() => ({ set: updateSet }));
	return {
		platformsFindFirst: vi.fn(),
		searchTasksFindMany: vi.fn(),
		updateWhere,
		updateSet,
		update
	};
});

vi.mock('$lib/server/db', () => ({
	dbDirect: {
		query: {
			job_platforms: { findFirst: mocks.platformsFindFirst },
			search_tasks: { findMany: mocks.searchTasksFindMany }
		},
		update: mocks.update
	}
}));

vi.mock('drizzle-orm', () => ({
	eq: (_col: unknown, val: unknown) => val
}));

vi.mock('$lib/server/db/schema', () => ({
	job_platforms: { id: 'job_platforms.id' },
	search_tasks: { platform_id: 'search_tasks.platform_id' }
}));

import { PATCH } from '../+server';

type Event = Parameters<typeof PATCH>[0];
type User = { id: string; is_staff?: boolean } | null;

const ME = 'user-1';
const SOMEONE_ELSE = 'user-2';

/** An admin-curated platform: no owner. */
const curated = { id: 7, name: 'Glassdoor', created_by_user_id: null, login_page_url: null };
/** A site this user pasted into the add form. */
const mine = { ...curated, id: 8, name: 'Acme Careers', created_by_user_id: ME };
/** A site another user pasted. */
const theirs = { ...curated, id: 9, name: 'Other Careers', created_by_user_id: SOMEONE_ELSE };

const taskOwnedBy = (userId: string) => ({ id: 1, profile: { user_id: userId } });

function patchEvent(body: unknown, user: User = { id: ME }): Event {
	return {
		params: { id: '7' },
		locals: { user, session: null },
		request: new Request('http://localhost/api/platforms/7', {
			method: 'PATCH',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify(body)
		})
	} as unknown as Event;
}

const GOOD_URL = { login_page_url: 'https://acme.example.com/login' };

describe('PATCH /api/platforms/[id]', () => {
	beforeEach(() => {
		vi.clearAllMocks();
		mocks.platformsFindFirst.mockReset();
		mocks.searchTasksFindMany.mockReset();
		mocks.searchTasksFindMany.mockResolvedValue([]);
		mocks.updateWhere.mockResolvedValue({});
	});

	it('rejects unauthenticated', async () => {
		await expect(PATCH(patchEvent(GOOD_URL, null))).rejects.toMatchObject({ status: 401 });
	});

	it('404s when the platform does not exist', async () => {
		mocks.platformsFindFirst.mockResolvedValueOnce(null);
		await expect(PATCH(patchEvent(GOOD_URL))).rejects.toMatchObject({ status: 404 });
	});

	// The hole the ownership rule closes. Under the old "no other account uses
	// it" rule, a curated platform nobody had a task on yet could have its
	// sign-in page pointed anywhere by the first user to try.
	it('refuses a curated platform to a normal user even when nobody else uses it', async () => {
		mocks.platformsFindFirst.mockResolvedValueOnce(curated);
		mocks.searchTasksFindMany.mockResolvedValueOnce([taskOwnedBy(ME)]);
		await expect(PATCH(patchEvent(GOOD_URL))).rejects.toMatchObject({ status: 403 });
		expect(mocks.update).not.toHaveBeenCalled();
	});

	it("refuses another user's custom site", async () => {
		mocks.platformsFindFirst.mockResolvedValueOnce(theirs);
		await expect(PATCH(patchEvent(GOOD_URL))).rejects.toMatchObject({ status: 403 });
		expect(mocks.update).not.toHaveBeenCalled();
	});

	it('refuses an owned site once another account has a task on it', async () => {
		mocks.platformsFindFirst.mockResolvedValueOnce(mine);
		mocks.searchTasksFindMany.mockResolvedValueOnce([taskOwnedBy(ME), taskOwnedBy(SOMEONE_ELSE)]);
		await expect(PATCH(patchEvent(GOOD_URL))).rejects.toMatchObject({ status: 403 });
		expect(mocks.update).not.toHaveBeenCalled();
	});

	it('lets the owner edit a site nobody else uses, even with no task of their own yet', async () => {
		mocks.platformsFindFirst.mockResolvedValueOnce(mine);
		mocks.searchTasksFindMany.mockResolvedValueOnce([]);
		const res = await PATCH(patchEvent(GOOD_URL));
		expect(await res.json()).toEqual({ ok: true });
		expect(mocks.updateSet).toHaveBeenCalledWith(
			expect.objectContaining({ login_page_url: GOOD_URL.login_page_url })
		);
	});

	it('lets the owner clear the sign-in page', async () => {
		mocks.platformsFindFirst.mockResolvedValueOnce({
			...mine,
			login_page_url: 'https://x.example/l'
		});
		const res = await PATCH(patchEvent({ login_page_url: null }));
		expect(await res.json()).toEqual({ ok: true });
		expect(mocks.updateSet).toHaveBeenCalledWith(expect.objectContaining({ login_page_url: null }));
	});

	it('lets staff edit a curated platform', async () => {
		mocks.platformsFindFirst.mockResolvedValueOnce(curated);
		const res = await PATCH(patchEvent(GOOD_URL, { id: 'staff-1', is_staff: true }));
		expect(await res.json()).toEqual({ ok: true });
		// Staff skip the usage check entirely.
		expect(mocks.searchTasksFindMany).not.toHaveBeenCalled();
	});

	// The URL becomes a navigation target for a real browser on our network.
	it('refuses a private address', async () => {
		mocks.platformsFindFirst.mockResolvedValueOnce(mine);
		await expect(
			PATCH(patchEvent({ login_page_url: 'http://localhost:5432/login' }))
		).rejects.toMatchObject({ status: 400 });
		expect(mocks.update).not.toHaveBeenCalled();
	});

	it('refuses a URL longer than the column', async () => {
		mocks.platformsFindFirst.mockResolvedValueOnce(mine);
		await expect(
			PATCH(patchEvent({ login_page_url: 'https://acme.example.com/' + 'a'.repeat(300) }))
		).rejects.toMatchObject({ status: 400 });
		expect(mocks.update).not.toHaveBeenCalled();
	});
});
