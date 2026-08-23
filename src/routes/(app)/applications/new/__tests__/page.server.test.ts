/**
 * Tests for the manual application-create action.
 *
 * The point of this action is the merge between what the user submitted and
 * what the LLM extracted, and that merge has two modes:
 *
 *  - **reviewed** (the parse token matches a hash of the submitted
 *    description): the form was pre-filled from that exact parse, so its
 *    inputs are authoritative and clearing a field must actually clear it.
 *  - **gap-fill** (no/stale token): what the user typed wins, the parser
 *    fills the blanks.
 *
 * Getting that backwards silently resurrects extracted values the user
 * deliberately deleted, which is invisible until you inspect the job row —
 * hence the coverage here.
 *
 * The merge itself now lives in `$lib/server/applications/create.ts`, shared
 * with `add_application` over MCP. These stay end-to-end through the action on
 * purpose: what they assert is the behaviour a person submitting the form gets,
 * and asserting instead that the action called the writer would leave the two
 * free to disagree about what a cleared field means. `create.test.ts` covers
 * the writer's own edges — the ones no form can reach.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';

/** Ids handed back per table, so a blank form (no jobs insert) still works. */
const INSERT_IDS = new Map<string, number>([
	['jobs', 3900],
	['applications', 77]
]);
let insertingTable = '';

const mockValues = vi.fn(() => {
	// `db.insert(x).values(...)` is awaited directly for join tables and
	// chained with `.returning()` for the rest, so it has to be both.
	const table = insertingTable;
	const p: any = Promise.resolve(undefined);
	p.returning = () => Promise.resolve([{ id: INSERT_IDS.get(table) ?? 1 }]);
	return p;
});
const mockInsert = vi.fn((table: any) => {
	insertingTable = table?.__table ?? '';
	return { values: mockValues };
});
const mockPlatformFindFirst = vi.fn();
const mockGetSelectedProfileId = vi.fn();
const mockParseJobDescription = vi.fn();
const mockParseCacheKey = vi.fn();
const mockRecallParse = vi.fn();
const mockTriggerMatchForImport = vi.fn().mockResolvedValue(undefined);

// One handle behind both names. The action reads the form and `create.ts`
// writes the rows, and those two reach the database by different exports —
// `dbDirect` is the route convention, `db` the one every shared writer under
// $lib/server uses. Mocking only the first is how this suite failed when the
// inserts moved: nineteen tests, all reporting that `insert` was undefined.
vi.mock('$lib/server/db', () => {
	const handle = {
		query: {
			job_platforms: {
				findFirst: (...a: any[]) => mockPlatformFindFirst(...a)
			}
		},
		insert: (...a: any[]) => mockInsert(...a)
	};
	return { db: handle, dbDirect: handle, queryRaw: vi.fn(), sql: vi.fn() };
});

vi.mock('drizzle-orm', () => ({
	ilike: vi.fn((_c: any, v: any) => v),
	or: vi.fn((...a: any[]) => a)
}));

vi.mock('$lib/server/db/schema', () => ({
	applications: { __table: 'applications' },
	application_status_log: { __table: 'application_status_log' },
	job_importers: { __table: 'job_importers' },
	job_platforms: { __table: 'job_platforms', url: 'jp.url' },
	jobs: { __table: 'jobs' }
}));

vi.mock('../../../profile/utils', () => ({
	getSelectedProfileId: (...a: any[]) => mockGetSelectedProfileId(...a)
}));
vi.mock('$lib/server/jobs/parse-job-description', () => ({
	parseJobDescription: (...a: any[]) => mockParseJobDescription(...a)
}));
vi.mock('$lib/server/jobs/parse-cache', () => ({
	parseCacheKey: (...a: any[]) => mockParseCacheKey(...a),
	recallParse: (...a: any[]) => mockRecallParse(...a)
}));
vi.mock('$lib/server/job/match-trigger', () => ({
	triggerMatchForImport: (...a: any[]) => mockTriggerMatchForImport(...a)
}));

import { actions } from '../+page.server';
import { applications, jobs } from '$lib/server/db/schema';

const TOKEN = 'matching-token';

function createEvent(fields: Record<string, string | string[]> = {}, opts: { user?: any } = {}) {
	const fd = new FormData();
	for (const [k, v] of Object.entries(fields)) {
		if (Array.isArray(v)) v.forEach((one) => fd.append(k, one));
		else fd.set(k, v);
	}
	return {
		locals: { user: opts.user === undefined ? { id: 'user-1' } : opts.user },
		cookies: {} as any,
		request: { formData: async () => fd }
	} as any;
}

/** Run the action, returning the redirect it throws on success. */
async function run(event: any) {
	try {
		return { redirect: null, result: await actions.default!(event) };
	} catch (e: any) {
		return { redirect: e, result: null };
	}
}

/** The values object passed to `db.insert(<table>)`, or undefined. */
function insertedFor(table: unknown) {
	const idx = mockInsert.mock.calls.findIndex((c: any[]) => c[0] === table);
	return idx === -1 ? undefined : (mockValues.mock.calls[idx] as any[])[0];
}

/** A parse result with every field the action reads. */
function parsedStub(overrides: Record<string, unknown> = {}) {
	return {
		title: 'Parsed Title',
		job_description: 'parser rewrite (must never be stored)',
		company_description: 'Parsed company blurb',
		company: 'Parsed Co',
		job_poster: 'Parsed Recruiter',
		date_posted: new Date('2026-03-04T00:00:00Z'),
		location: 'Berlin',
		remote: 'hybrid',
		experience_levels: ['senior'],
		job_type: 'full_time',
		salary_min: 50000,
		salary_max: 70000,
		salary_currency: 'USD',
		salary_period: 'year',
		salary_duration_weeks: null,
		skills_required: ['Svelte'],
		skills_preferred: ['Rust'],
		responsibilities: ['Ship things'],
		soft_skills: ['Curiosity'],
		status: 'hiring',
		source_url: 'https://parsed.example/job/1',
		source_html_stripped: 'stripped',
		ai_chat_extraction: 42,
		...overrides
	};
}

describe('create-application action', () => {
	beforeEach(() => {
		vi.clearAllMocks();
		mockValues.mockImplementation(() => {
			const table = insertingTable;
			const p: any = Promise.resolve(undefined);
			p.returning = () => Promise.resolve([{ id: INSERT_IDS.get(table) ?? 1 }]);
			return p;
		});
		mockInsert.mockImplementation((table: any) => {
			insertingTable = table?.__table ?? '';
			return { values: mockValues };
		});
		mockGetSelectedProfileId.mockResolvedValue(12);
		mockPlatformFindFirst.mockResolvedValue(undefined);
		mockParseCacheKey.mockReturnValue(TOKEN);
		mockRecallParse.mockReturnValue(null);
		mockParseJobDescription.mockResolvedValue(null);
		mockTriggerMatchForImport.mockResolvedValue(undefined);
	});

	it('rejects unauthenticated', async () => {
		const { result } = await run(createEvent({ title: 'x' }, { user: null }));
		expect(result).toMatchObject({ status: 401 });
	});

	it('rejects when no profile is selected', async () => {
		mockGetSelectedProfileId.mockResolvedValue(null);
		const { result } = await run(createEvent({ title: 'x' }));
		expect(result).toMatchObject({ status: 400 });
	});

	it('creates a bare application when nothing is filled in', async () => {
		const { redirect } = await run(createEvent({}));
		expect(insertedFor(jobs)).toBeUndefined();
		expect(insertedFor(applications)).toMatchObject({ job_id: null });
		expect(redirect).toMatchObject({ location: '/applications/77' });
	});

	describe('reviewed (token matches the submitted description)', () => {
		beforeEach(() => {
			mockRecallParse.mockReturnValue(parsedStub());
		});

		it("takes the form's values over the parser's", async () => {
			await run(
				createEvent({
					parse_token: TOKEN,
					job_description: 'posting',
					title: 'Corrected Title',
					company: 'Corrected Co',
					salary_min: '90000',
					salary_currency: 'GBP'
				})
			);
			expect(insertedFor(jobs)).toMatchObject({
				title: 'Corrected Title',
				company: 'Corrected Co',
				salary_min: 90000,
				salary_currency: 'GBP'
			});
		});

		// The whole reason `reviewed` exists: a field the user emptied must stay
		// empty rather than being refilled from the parse behind their back.
		it('keeps a cleared field cleared', async () => {
			await run(
				createEvent({
					parse_token: TOKEN,
					job_description: 'posting',
					title: 'Kept',
					company: '',
					job_poster: ''
				})
			);
			expect(insertedFor(jobs)).toMatchObject({
				company: null,
				job_poster: null
			});
		});

		it("still stores the fields the form doesn't expose", async () => {
			await run(createEvent({ parse_token: TOKEN, job_description: 'posting' }));
			expect(insertedFor(jobs)).toMatchObject({
				company_description: 'Parsed company blurb',
				skills_required: ['Svelte'],
				skills_preferred: ['Rust'],
				responsibilities: ['Ship things'],
				soft_skills: ['Curiosity'],
				source_html_stripped: 'stripped',
				ai_chat_extraction: 42
			});
		});

		it("stores the paste verbatim, never the parser's rewrite", async () => {
			await run(
				createEvent({
					parse_token: TOKEN,
					job_description: 'the original paste'
				})
			);
			expect(insertedFor(jobs)).toMatchObject({
				job_description: 'the original paste'
			});
		});

		it('does not re-run the LLM', async () => {
			await run(createEvent({ parse_token: TOKEN, job_description: 'posting' }));
			expect(mockParseJobDescription).not.toHaveBeenCalled();
		});

		it('canonicalizes taxonomy values posted by the form', async () => {
			await run(
				createEvent({
					parse_token: TOKEN,
					job_description: 'posting',
					work_location: ['Remote'],
					job_types: ['Full-time'],
					experience_levels: ['Junior', 'bogus-level']
				})
			);
			expect(insertedFor(jobs)).toMatchObject({
				work_location: ['remote'],
				job_types: ['full_time'],
				experience_levels: ['junior']
			});
		});

		it("ignores a date_posted that isn't a plain ISO date", async () => {
			await run(
				createEvent({
					parse_token: TOKEN,
					job_description: 'posting',
					date_posted: '04/03/2026'
				})
			);
			expect(insertedFor(jobs)).toMatchObject({ date_posted: null });
		});
	});

	describe('gap-fill (no token)', () => {
		beforeEach(() => {
			mockParseJobDescription.mockResolvedValue(parsedStub());
		});

		it('parses the description and fills the blanks', async () => {
			await run(createEvent({ job_description: 'posting' }));
			expect(mockParseJobDescription).toHaveBeenCalled();
			expect(insertedFor(jobs)).toMatchObject({
				title: 'Parsed Title',
				company: 'Parsed Co',
				salary_min: 50000,
				salary_currency: 'USD',
				date_posted: '2026-03-04'
			});
		});

		it('lets what the user typed win over the parse', async () => {
			await run(
				createEvent({
					job_description: 'posting',
					title: 'Typed Title'
				})
			);
			expect(insertedFor(jobs)).toMatchObject({
				title: 'Typed Title',
				company: 'Parsed Co'
			});
		});

		// A stale token means the description was edited after being parsed, so
		// the cached extraction no longer describes it.
		it('re-parses when the token no longer matches the description', async () => {
			await run(
				createEvent({
					parse_token: 'stale-token',
					job_description: 'an edited posting'
				})
			);
			expect(mockRecallParse).not.toHaveBeenCalled();
			expect(mockParseJobDescription).toHaveBeenCalled();
		});

		it('recovers the structured fields when the cache entry has aged out', async () => {
			mockRecallParse.mockReturnValue(null);
			await run(createEvent({ parse_token: TOKEN, job_description: 'posting' }));
			expect(mockParseJobDescription).toHaveBeenCalled();
			expect(insertedFor(jobs)).toMatchObject({ skills_required: ['Svelte'] });
		});

		it('skips the LLM when extraction already failed on this paste', async () => {
			await run(createEvent({ job_description: 'posting', parse_failed: '1' }));
			expect(mockParseJobDescription).not.toHaveBeenCalled();
			expect(insertedFor(jobs)).toMatchObject({ title: null });
		});

		it('still creates the job when extraction fails', async () => {
			mockParseJobDescription.mockResolvedValue(null);
			const { redirect } = await run(
				createEvent({
					job_description: 'posting',
					title: 'Typed'
				})
			);
			expect(insertedFor(jobs)).toMatchObject({
				title: 'Typed',
				skills_required: null
			});
			expect(redirect).toMatchObject({ location: '/applications/77' });
		});

		it('still creates the job when extraction throws', async () => {
			mockParseJobDescription.mockRejectedValue(new Error('provider down'));
			const { redirect } = await run(createEvent({ job_description: 'posting' }));
			expect(redirect).toMatchObject({ location: '/applications/77' });
		});
	});

	describe('location and URL handling', () => {
		it('folds a work arrangement typed in the location box into work_location', async () => {
			await run(createEvent({ office_location: 'Remote' }));
			expect(insertedFor(jobs)).toMatchObject({
				office_location: null,
				work_location: ['remote'],
				region: null
			});
		});

		it('keeps a real location and classifies its region', async () => {
			await run(createEvent({ office_location: 'Amsterdam' }));
			expect(insertedFor(jobs)).toMatchObject({
				office_location: 'Amsterdam',
				region: 'western_europe'
			});
		});

		it('falls back to a job URL recovered from the posting text', async () => {
			mockParseJobDescription.mockResolvedValue(parsedStub());
			await run(createEvent({ job_description: 'posting' }));
			expect(insertedFor(jobs)).toMatchObject({
				source_url: 'https://parsed.example/job/1'
			});
		});

		// Platform detection has to run on the merged URL, not the raw form field,
		// or a parser-recovered URL would never be linked to its platform.
		it('detects the platform from a parser-recovered URL', async () => {
			mockParseJobDescription.mockResolvedValue(parsedStub());
			mockPlatformFindFirst.mockResolvedValue({ id: 9 });
			await run(createEvent({ job_description: 'posting' }));
			expect(mockPlatformFindFirst).toHaveBeenCalled();
			expect(insertedFor(jobs)).toMatchObject({ job_platform_id: 9 });
		});

		it('leaves the platform unset for an unparseable URL', async () => {
			await run(createEvent({ source_url: 'not a url' }));
			expect(mockPlatformFindFirst).not.toHaveBeenCalled();
			expect(insertedFor(jobs)).toMatchObject({ job_platform_id: null });
		});
	});

	it('registers the job as imported by the profile and queues matching', async () => {
		await run(createEvent({ title: 'x' }));
		expect(mockTriggerMatchForImport).toHaveBeenCalledWith(12, 3900);
	});
});
