/**
 * Tests for Education API
 * PATCH /api/education/[id]
 */

import { beforeEach, describe, expect, it, vi } from 'vitest';

const mockFindFirst = vi.fn();

// Mock Drizzle update chain
const mockUpdateWhere = vi.fn().mockResolvedValue({});
const mockUpdateSet = vi.fn().mockReturnValue({ where: mockUpdateWhere });
const mockUpdateFn = vi.fn().mockReturnValue({ set: mockUpdateSet });

vi.mock('$lib/server/db', () => ({
	dbDirect: {
		query: {
			education: {
				findFirst: (...a: any[]) => mockFindFirst(...a)
			}
		},
		update: (...a: any[]) => mockUpdateFn(...a)
	}
}));

vi.mock('drizzle-orm', () => ({
	eq: vi.fn((_col: any, val: any) => val)
}));

// `profiles` too: the route touches the parent row after a successful write,
// because a child edit that leaves profiles.date_updated alone leaves the
// matcher scoring a stale snapshot.
vi.mock('$lib/server/db/schema', () => ({
	education: { id: 'education.id' },
	profiles: { id: 'profiles.id' }
}));

import { PATCH } from '../+server';

function createEvent(
	body: any,
	opts: {
		user?: any;
		params?: Record<string, string>;
	} = {}
) {
	return {
		params: opts.params ?? { id: '1' },
		locals: { user: opts.user === undefined ? { id: 'user-1' } : opts.user, session: null },
		request: new Request('http://localhost/api/education/1', {
			method: 'PATCH',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify(body)
		})
	} as any;
}

describe('PATCH /api/education/[id]', () => {
	beforeEach(() => {
		vi.clearAllMocks();
		mockUpdateWhere.mockResolvedValue({});
	});

	it('rejects unauthenticated', async () => {
		await expect(PATCH(createEvent({}, { user: null }))).rejects.toMatchObject({ status: 401 });
	});

	it('rejects invalid ID', async () => {
		await expect(PATCH(createEvent({}, { params: { id: 'abc' } }))).rejects.toMatchObject({
			status: 400
		});
	});

	it("rejects when user doesn't own education record", async () => {
		mockFindFirst.mockResolvedValueOnce({
			id: 1,
			profile: { user_id: 'other-user' }
		});
		await expect(PATCH(createEvent({ institution: 'MIT' }))).rejects.toMatchObject({ status: 403 });
	});

	it('rejects when education not found', async () => {
		mockFindFirst.mockResolvedValueOnce(null);
		await expect(PATCH(createEvent({ institution: 'MIT' }))).rejects.toMatchObject({ status: 403 });
	});

	it('rejects empty institution', async () => {
		mockFindFirst.mockResolvedValueOnce({
			id: 1,
			profile_id: 7,
			profile: { user_id: 'user-1' }
		});
		await expect(PATCH(createEvent({ institution: '' }))).rejects.toMatchObject({ status: 400 });
	});

	it('updates education with valid data', async () => {
		mockFindFirst.mockResolvedValueOnce({
			id: 1,
			profile_id: 7,
			profile: { user_id: 'user-1' }
		});
		const res = await PATCH(
			createEvent({
				institution: 'MIT',
				area: 'Computer Science',
				graduation_year: '2020'
			})
		);
		const data = await res.json();
		expect(data.success).toBe(true);
		expect(mockUpdateSet).toHaveBeenCalledWith(
			expect.objectContaining({
				institution: 'MIT',
				area: 'Computer Science',
				graduation_year: 2020
			})
		);
	});

	it('converts date fields to Date objects', async () => {
		mockFindFirst.mockResolvedValueOnce({
			id: 1,
			profile_id: 7,
			profile: { user_id: 'user-1' }
		});
		await PATCH(
			createEvent({
				start_date: '2016-09-01',
				end_date: '2020-06-15'
			})
		);
		const setCallData = mockUpdateSet.mock.calls[0][0];
		expect(setCallData.start_date).toBeInstanceOf(Date);
		expect(setCallData.end_date).toBeInstanceOf(Date);
	});

	it('only updates allowed fields', async () => {
		mockFindFirst.mockResolvedValueOnce({
			id: 1,
			profile_id: 7,
			profile: { user_id: 'user-1' }
		});
		await PATCH(
			createEvent({
				institution: 'MIT',
				profile: 999,
				user_id: 'hacker'
			})
		);
		const setCallData = mockUpdateSet.mock.calls[0][0];
		expect(setCallData.institution).toBe('MIT');
		expect(setCallData.profile).toBeUndefined();
		expect(setCallData.user_id).toBeUndefined();
	});
});
