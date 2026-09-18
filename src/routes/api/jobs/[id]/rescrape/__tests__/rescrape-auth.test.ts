/**
 * Who may drive a rescrape.
 *
 * Rescrape is a staff tool: the button lives in the Staff Tools card on
 * /jobs/[id] and nowhere else. The endpoint behind it asked only `requireAuth`,
 * so any signed-in caller could POST an arbitrary job id and spend a real
 * browser run on the shared scraper queue, or DELETE one that somebody else was
 * watching — `rescrape_status` is a column on the `jobs` row, which is shared
 * between every profile the posting matched.
 *
 * The assertions here are as much about the queue as about the status code:
 * a 403 that still enqueued the run would be no gate at all.
 */

import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
	jobsFindFirst: vi.fn(),
	updateWhere: vi.fn(),
	execute: vi.fn(),
	addRescrapeJob: vi.fn(),
	isJobRescraping: vi.fn(),
	removeWaitingRescrapeJob: vi.fn(),
	removeActiveRescrapeJob: vi.fn()
}));

vi.mock('$lib/server/db', () => ({
	db: {
		query: { jobs: { findFirst: mocks.jobsFindFirst } },
		update: () => ({ set: () => ({ where: mocks.updateWhere }) }),
		execute: mocks.execute
	}
}));

vi.mock('$lib/server/queue/rescrape-queue', () => ({
	addRescrapeJob: mocks.addRescrapeJob,
	isJobRescraping: mocks.isJobRescraping,
	removeWaitingRescrapeJob: mocks.removeWaitingRescrapeJob,
	removeActiveRescrapeJob: mocks.removeActiveRescrapeJob
}));

const { POST, GET, DELETE } = await import('../+server');

type Event = Parameters<typeof POST>[0];
type User = Record<string, unknown> | null;

const SCRAPED_JOB = {
	id: 5,
	source_url: 'https://acme.example.com/jobs/5',
	job_platform_id: 3,
	title: 'Backend Engineer',
	rescrape_status: null
};

function event(user: User, adminUser: User = null): Event {
	return {
		params: { id: '5' },
		locals: { user, adminUser, session: null },
		request: new Request('http://localhost/api/jobs/5/rescrape', { method: 'POST' })
	} as unknown as Event;
}

const applicant = { id: 'user-1' };
const staff = { id: 'user-2', is_staff: true };
const admin = { id: 'user-3', is_admin: true };

beforeEach(() => {
	vi.clearAllMocks();
	mocks.jobsFindFirst.mockResolvedValue(SCRAPED_JOB);
	mocks.isJobRescraping.mockResolvedValue(false);
	mocks.removeWaitingRescrapeJob.mockResolvedValue(false);
	mocks.execute.mockResolvedValue({ rows: [] });
	mocks.addRescrapeJob.mockResolvedValue({ id: 'bull-1' });
});

describe('POST /api/jobs/[id]/rescrape', () => {
	it('refuses an anonymous caller', async () => {
		await expect(POST(event(null))).rejects.toMatchObject({ status: 401 });
		expect(mocks.addRescrapeJob).not.toHaveBeenCalled();
	});

	it('refuses a signed-in applicant, who never sees the button', async () => {
		await expect(POST(event(applicant))).rejects.toMatchObject({ status: 403 });
		// The point of the gate: nothing was queued and nothing was written to
		// the shared job row.
		expect(mocks.addRescrapeJob).not.toHaveBeenCalled();
		expect(mocks.updateWhere).not.toHaveBeenCalled();
	});

	it('lets staff queue one', async () => {
		const res = await POST(event(staff));
		expect(await res.json()).toMatchObject({ status: 'queued' });
		expect(mocks.addRescrapeJob).toHaveBeenCalledWith(expect.objectContaining({ jobId: 5 }));
	});

	it('lets an admin impersonating an applicant keep the tool', async () => {
		// isStaffViewer's third clause: during impersonation `locals.user` is the
		// applicant and the admin is in `locals.adminUser`.
		const res = await POST(event(applicant, { id: 'user-3', is_admin: true }));
		expect(await res.json()).toMatchObject({ status: 'queued' });
	});
});

describe('GET /api/jobs/[id]/rescrape', () => {
	it('refuses an applicant the run history', async () => {
		await expect(GET(event(applicant))).rejects.toMatchObject({ status: 403 });
	});

	it('answers staff', async () => {
		mocks.jobsFindFirst.mockResolvedValueOnce({ ...SCRAPED_JOB, rescrape_status: 'scraping' });
		const res = await GET(event(admin));
		expect(await res.json()).toMatchObject({ status: 'scraping' });
	});
});

describe('DELETE /api/jobs/[id]/rescrape', () => {
	it("refuses an applicant cancelling somebody else's run", async () => {
		await expect(DELETE(event(applicant))).rejects.toMatchObject({ status: 403 });
		expect(mocks.removeWaitingRescrapeJob).not.toHaveBeenCalled();
		expect(mocks.removeActiveRescrapeJob).not.toHaveBeenCalled();
	});

	it('lets staff cancel', async () => {
		mocks.jobsFindFirst.mockResolvedValueOnce({ rescrape_status: 'scraping' });
		const res = await DELETE(event(staff));
		expect(await res.json()).toMatchObject({ status: 'cancelled' });
	});
});
