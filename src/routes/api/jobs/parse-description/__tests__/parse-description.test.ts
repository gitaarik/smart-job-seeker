/**
 * Tests for POST /api/jobs/parse-description — the review step's parse.
 *
 * What matters here is the shape the form relies on: `fields` holds what the
 * posting said, `suggestions` what we offer instead, and the two never blur.
 * A suggested title arriving inside `fields.title` would be shown as an
 * extraction, which is the one thing a suggestion must never be.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';

const mockGetSelectedProfileId = vi.hoisted(() => vi.fn());
const mockParseJobDescription = vi.hoisted(() => vi.fn());
const mockRememberParse = vi.hoisted(() => vi.fn());

vi.mock('$lib/server/profile/selected-profile', () => ({
	getSelectedProfileId: mockGetSelectedProfileId
}));
vi.mock('$lib/server/jobs/parse-job-description', () => ({
	parseJobDescription: mockParseJobDescription
}));
vi.mock('$lib/server/jobs/parse-cache', () => ({
	parseCacheKey: vi.fn(() => 'token-1'),
	rememberParse: mockRememberParse
}));

const { POST } = await import('../+server');

function createEvent(body: unknown, user: unknown = { id: 'user-1' }) {
	return {
		locals: { user },
		cookies: {} as never,
		request: new Request('http://localhost/api/jobs/parse-description', {
			method: 'POST',
			headers: { 'content-type': 'application/json' },
			body: JSON.stringify(body)
		})
	} as never;
}

/** A parse with every field the endpoint reads. */
function parsed(overrides: Record<string, unknown> = {}) {
	return {
		title: 'Semantic AI Engineer',
		suggested_title: null,
		company: 'Alliander',
		job_poster: null,
		location: 'Arnhem',
		remote: 'hybrid',
		job_type: 'full_time',
		experience_levels: ['senior'],
		source_url: null,
		date_posted: null,
		salary_min: null,
		salary_max: null,
		salary_currency: null,
		salary_period: null,
		company_description: null,
		skills_required: ['Python'],
		skills_preferred: [],
		responsibilities: [],
		soft_skills: [],
		...overrides
	};
}

beforeEach(() => {
	vi.clearAllMocks();
	mockGetSelectedProfileId.mockResolvedValue(12);
});

describe('POST /api/jobs/parse-description', () => {
	it('rejects unauthenticated', async () => {
		await expect(POST(createEvent({ description: 'x' }, null))).rejects.toMatchObject({
			status: 401
		});
	});

	it('rejects an empty description', async () => {
		await expect(POST(createEvent({ description: '  ' }))).rejects.toMatchObject({ status: 400 });
	});

	it('asks the parser for the header pass', async () => {
		mockParseJobDescription.mockResolvedValue(parsed());
		await POST(createEvent({ description: 'a posting', source_url: 'https://x.example/1' }));
		expect(mockParseJobDescription).toHaveBeenCalledWith('a posting', {
			profileId: 12,
			sourceUrl: 'https://x.example/1',
			recoverHeader: true
		});
	});

	it('returns the extracted fields, the token, and no suggestion when the title was found', async () => {
		mockParseJobDescription.mockResolvedValue(parsed());
		const body = await (await POST(createEvent({ description: 'a posting' }))).json();
		expect(body).toMatchObject({
			ok: true,
			token: 'token-1',
			fields: { title: 'Semantic AI Engineer', company: 'Alliander', office_location: 'Arnhem' },
			suggestions: { title: null }
		});
		expect(mockRememberParse).toHaveBeenCalledWith('token-1', expect.objectContaining(parsed()));
	});

	it('keeps a suggested title out of the fields', async () => {
		mockParseJobDescription.mockResolvedValue(
			parsed({ title: null, suggested_title: 'Developer AI & procesautomatisering (BZB)' })
		);
		const body = await (await POST(createEvent({ description: 'a posting' }))).json();
		expect(body.fields.title).toBeNull();
		expect(body.suggestions).toEqual({ title: 'Developer AI & procesautomatisering (BZB)' });
	});

	it('degrades to ok:false when extraction returns nothing', async () => {
		mockParseJobDescription.mockResolvedValue(null);
		const body = await (await POST(createEvent({ description: 'a posting' }))).json();
		expect(body.ok).toBe(false);
		expect(mockRememberParse).not.toHaveBeenCalled();
	});

	it('degrades to ok:false when extraction throws', async () => {
		mockParseJobDescription.mockRejectedValue(new Error('provider down'));
		const body = await (await POST(createEvent({ description: 'a posting' }))).json();
		expect(body.ok).toBe(false);
	});
});
