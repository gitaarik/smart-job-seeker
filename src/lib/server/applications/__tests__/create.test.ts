/**
 * Tests for creating an application and the manual job behind it.
 *
 * The behaviours worth pinning are the ones that fail silently:
 *
 *  - a job is created with its `job_importers` row AND its match enqueued, or
 *    the posting exists owned by nobody and never scores;
 *  - "the caller said nothing about the role" is an explicit field list, not
 *    "any field is set" — a form posts a currency from a select that always has
 *    a value, so counting every field turns the blank application into one
 *    carrying an untitled job;
 *  - the gap-fill semantics: without a reviewed parse what the caller sent wins
 *    and the parser fills the blanks, and WITH one a cleared field stays
 *    cleared rather than resurrecting the parsed value.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { applications, application_status_log, job_importers, jobs } from '$lib/server/db/schema';

const captured = vi.hoisted(() => ({
	inserts: [] as Array<{ table: unknown; values: Record<string, unknown> }>,
	nextId: 1000
}));

vi.mock('$lib/server/db', () => {
	const insert = (table: unknown) => ({
		values: (values: Record<string, unknown>) => {
			captured.inserts.push({ table, values });
			// Awaited directly by the callers that don't need an id, and given a
			// `.returning()` by the two that do.
			return Object.assign(Promise.resolve(undefined), {
				returning: () => Promise.resolve([{ id: ++captured.nextId }])
			});
		}
	});
	return { db: { insert }, dbDirect: { insert } };
});

const mockTriggerMatch = vi.hoisted(() => vi.fn().mockResolvedValue(undefined));
vi.mock('$lib/server/job/match-trigger', () => ({ triggerMatchForImport: mockTriggerMatch }));

const mockParse = vi.hoisted(() => vi.fn());
vi.mock('$lib/server/jobs/parse-job-description', () => ({ parseJobDescription: mockParse }));

// Only `detectPlatformId` is replaced: it reads the platform table, where
// `datePostedOrNull` beside it is pure and is part of what this is testing.
vi.mock('$lib/server/jobs/job-fields', async (importOriginal) => ({
	...(await importOriginal<typeof import('$lib/server/jobs/job-fields')>()),
	detectPlatformId: vi.fn().mockResolvedValue(null)
}));

const { createApplication, parseForNewApplication } = await import('../create');

/** The values a table was inserted with, or undefined if it never was. */
function insertedInto(table: unknown): Record<string, unknown> | undefined {
	return captured.inserts.find((row) => row.table === table)?.values;
}

beforeEach(() => {
	captured.inserts.length = 0;
	captured.nextId = 1000;
	mockTriggerMatch.mockClear();
	mockParse.mockReset();
});

describe('createApplication', () => {
	it('makes a blank application when the caller knows nothing about the role', async () => {
		const result = await createApplication({ profileId: 7 });

		expect(insertedInto(jobs)).toBeUndefined();
		expect(insertedInto(job_importers)).toBeUndefined();
		expect(mockTriggerMatch).not.toHaveBeenCalled();
		expect(result.jobId).toBeNull();
		expect(insertedInto(applications)).toMatchObject({ job_id: null, profile_id: 7 });
	});

	it('treats a currency with nothing else as knowing nothing', async () => {
		// The trap this guards: a form's currency select always posts a value, so
		// "any field is set" would give every blank application an untitled job.
		const result = await createApplication({
			profileId: 7,
			job: { salary_currency: 'EUR', salary_period: 'year' }
		});

		expect(insertedInto(jobs)).toBeUndefined();
		expect(result.jobId).toBeNull();
	});

	it('links the job to the profile and enqueues its match', async () => {
		const result = await createApplication({
			profileId: 7,
			job: { company: 'Citrus Flex B.V.', title: 'Software Engineer' }
		});

		expect(insertedInto(jobs)).toMatchObject({
			company: 'Citrus Flex B.V.',
			title: 'Software Engineer',
			created_manually: true
		});
		// Both, or the row belongs to nobody and never scores.
		expect(insertedInto(job_importers)).toEqual({ job_id: result.jobId, profile_id: 7 });
		expect(mockTriggerMatch).toHaveBeenCalledWith(7, result.jobId);
		expect(insertedInto(applications)).toMatchObject({ job_id: result.jobId });
	});

	it('starts at the top of the pipeline, with a log row that agrees', async () => {
		const result = await createApplication({ profileId: 7 });

		expect(insertedInto(applications)).toMatchObject({
			status: 'applying',
			status_step: 'Preparing',
			status_action: 'Send application'
		});
		expect(insertedInto(application_status_log)).toMatchObject({
			application: result.applicationId,
			from_status: null,
			to_status: 'applying',
			step: 'Preparing',
			action: 'Send application'
		});
	});

	it('fills the blanks from the parse, without overwriting what was sent', async () => {
		await createApplication({
			profileId: 7,
			job: { company: 'Citrus Flex B.V.', job_description: 'a posting' },
			parsed: {
				title: 'Parsed Title',
				company: 'Parsed Company',
				skills_required: ['Python']
			} as never
		});

		const job = insertedInto(jobs);
		expect(job).toMatchObject({
			// Sent wins.
			company: 'Citrus Flex B.V.',
			// Blank is filled.
			title: 'Parsed Title',
			// A structured field the caller has no way to send survives.
			skills_required: ['Python'],
			// The paste is kept verbatim.
			job_description: 'a posting'
		});
	});

	it('keeps a reviewed field cleared rather than resurrecting the parse', async () => {
		await createApplication({
			profileId: 7,
			job: { company: 'Citrus Flex B.V.', title: null },
			parsed: { title: 'Parsed Title' } as never,
			reviewed: true
		});

		// The user saw "Parsed Title" in the review step and emptied the box.
		expect(insertedInto(jobs)?.title).toBeNull();
	});
});

describe('parseForNewApplication', () => {
	it('returns null rather than throwing, so a parse failure cannot block a write', async () => {
		mockParse.mockRejectedValueOnce(new Error('no credits'));

		await expect(parseForNewApplication('a posting', { profileId: 7 })).resolves.toBeNull();
	});

	it('passes the source url through, so the parser can place the posting', async () => {
		mockParse.mockResolvedValueOnce({ title: 'Parsed' });

		const parsed = await parseForNewApplication('a posting', {
			profileId: 7,
			sourceUrl: 'https://example.com/job'
		});

		expect(mockParse).toHaveBeenCalledWith('a posting', {
			profileId: 7,
			sourceUrl: 'https://example.com/job'
		});
		expect(parsed).toEqual({ title: 'Parsed' });
	});
});
