/**
 * Tests for Scraper Respond API
 * POST /api/import-tasks/[id]/runs/[runId]/respond
 */

import { beforeEach, describe, expect, it, vi } from 'vitest';

const mockSearchTasksFindFirst = vi.fn();
const mockRunsFindFirst = vi.fn();

// Mock Drizzle update chain
const mockUpdateWhere = vi.fn().mockResolvedValue({});
const mockUpdateSet = vi.fn().mockReturnValue({ where: mockUpdateWhere });
const mockUpdateFn = vi.fn().mockReturnValue({ set: mockUpdateSet });

vi.mock('$lib/server/db', () => ({
	dbDirect: {
		query: {
			search_tasks: {
				findFirst: (...a: any[]) => mockSearchTasksFindFirst(...a)
			},
			search_task_runs: {
				findFirst: (...a: any[]) => mockRunsFindFirst(...a)
			}
		},
		update: (...a: any[]) => mockUpdateFn(...a)
	}
}));

vi.mock('drizzle-orm', () => ({
	eq: vi.fn((_col: any, val: any) => val),
	and: vi.fn((...args: any[]) => args)
}));

vi.mock('$lib/server/db/schema', () => ({
	search_tasks: {
		id: 'search_tasks.id',
		profile_id: 'search_tasks.profile_id'
	},
	search_task_runs: {
		id: 'search_task_runs.id',
		search_task_id: 'search_task_runs.search_task_id'
	}
}));

import { POST } from '../+server';

function createEvent(
	body: any,
	opts: {
		user?: any;
		params?: Record<string, string>;
	} = {}
) {
	return {
		params: opts.params ?? { id: '1', runId: '10' },
		locals: { user: opts.user === undefined ? { id: 'user-1' } : opts.user, session: null },
		request: new Request('http://localhost/api/import-tasks/1/runs/10/respond', {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify(body)
		})
	} as any;
}

describe('POST /api/import-tasks/[id]/runs/[runId]/respond', () => {
	beforeEach(() => {
		vi.clearAllMocks();
		mockUpdateWhere.mockResolvedValue({});
	});

	it('rejects unauthenticated', async () => {
		await expect(POST(createEvent({ response: 'continue' }, { user: null }))).rejects.toMatchObject(
			{ status: 401 }
		);
	});

	it('rejects invalid IDs', async () => {
		await expect(
			POST(createEvent({ response: 'continue' }, { params: { id: 'abc', runId: '10' } }))
		).rejects.toMatchObject({ status: 400 });
	});

	it('rejects invalid response value', async () => {
		await expect(POST(createEvent({ response: 'hack' }))).rejects.toMatchObject({ status: 400 });
	});

	it('rejects missing response', async () => {
		await expect(POST(createEvent({}))).rejects.toMatchObject({ status: 400 });
	});

	it("rejects when user doesn't own job search", async () => {
		mockSearchTasksFindFirst.mockResolvedValueOnce({
			id: 1,
			profile: { user_id: 'other-user' }
		});
		await expect(POST(createEvent({ response: 'continue' }))).rejects.toMatchObject({
			status: 403
		});
	});

	it('rejects when job search not found', async () => {
		mockSearchTasksFindFirst.mockResolvedValueOnce(null);
		await expect(POST(createEvent({ response: 'continue' }))).rejects.toMatchObject({
			status: 404
		});
	});

	it('rejects when run not found', async () => {
		mockSearchTasksFindFirst.mockResolvedValueOnce({
			id: 1,
			profile: { user_id: 'user-1' }
		});
		mockRunsFindFirst.mockResolvedValueOnce(null);
		await expect(POST(createEvent({ response: 'continue' }))).rejects.toMatchObject({
			status: 404
		});
	});

	it('rejects when run is not active', async () => {
		mockSearchTasksFindFirst.mockResolvedValueOnce({
			id: 1,
			profile: { user_id: 'user-1' }
		});
		mockRunsFindFirst.mockResolvedValueOnce({ id: 10, status: 'completed' });
		await expect(POST(createEvent({ response: 'continue' }))).rejects.toMatchObject({
			status: 400
		});
	});

	it("records 'continue' response", async () => {
		mockSearchTasksFindFirst.mockResolvedValueOnce({
			id: 1,
			profile: { user_id: 'user-1' }
		});
		mockRunsFindFirst.mockResolvedValueOnce({ id: 10, status: 'running' });

		const res = await POST(createEvent({ response: 'continue' }));
		const data = await res.json();
		expect(data.success).toBe(true);
		expect(data.response).toBe('continue');
		// Verify update was called for the run
		expect(mockUpdateFn).toHaveBeenCalledTimes(1);
		expect(mockUpdateSet).toHaveBeenCalledWith(
			expect.objectContaining({
				user_response: 'continue'
			})
		);
	});

	it("records 'skip' response", async () => {
		mockSearchTasksFindFirst.mockResolvedValueOnce({
			id: 1,
			profile: { user_id: 'user-1' }
		});
		mockRunsFindFirst.mockResolvedValueOnce({ id: 10, status: 'blocked' });

		const res = await POST(createEvent({ response: 'skip' }));
		const data = await res.json();
		expect(data.success).toBe(true);
		expect(data.response).toBe('skip');
	});

	it("cancels run and job search on 'cancel'", async () => {
		mockSearchTasksFindFirst.mockResolvedValueOnce({
			id: 1,
			profile: { user_id: 'user-1' }
		});
		mockRunsFindFirst.mockResolvedValueOnce({ id: 10, status: 'running' });

		const res = await POST(createEvent({ response: 'cancel' }));
		const data = await res.json();
		expect(data.success).toBe(true);
		expect(data.message).toBe('Run cancelled');

		// Both run and search task should be updated
		expect(mockUpdateFn).toHaveBeenCalledTimes(2);

		// First call: update the run
		expect(mockUpdateSet).toHaveBeenCalledWith(
			expect.objectContaining({
				user_response: 'cancel',
				status: 'cancelled'
			})
		);

		// Second call: update the search task
		expect(mockUpdateSet).toHaveBeenCalledWith(
			expect.objectContaining({
				status: 'cancelled',
				status_message: 'Cancelled by user'
			})
		);
	});
});
