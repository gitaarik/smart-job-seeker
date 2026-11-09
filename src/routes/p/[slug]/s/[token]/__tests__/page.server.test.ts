/**
 * A portfolio share link is not rendered where it lands: it is checked like
 * any link, counted, leaves its key in the visitor's browser, and goes on to
 * the site, to the private CV page when the theme has one. A resume or CV
 * link renders here as before, and leaves no key.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';

const mockProfile = vi.fn();
const mockToken = vi.fn();
const mockVersion = vi.fn();
const mockIncrement = vi.fn();
const mockGiveKey = vi.fn();
const mockThemeById = vi.fn();
const mockThemes = vi.fn();

vi.mock('$lib/server/profile/default', () => ({
	getProfileByIdentifier: () => mockProfile()
}));
vi.mock('$lib/server/db', () => ({
	db: {
		query: {
			profile_tokens: { findFirst: () => mockToken() },
			profile_versions: { findFirst: () => mockVersion() }
		}
	}
}));
vi.mock('drizzle-orm', () => ({ eq: () => ({}) }));
vi.mock('$lib/server/db/schema', () => ({ profile_tokens: {}, profile_versions: {} }));
vi.mock('$lib/server/auth/token-validation', () => ({
	incrementTokenVisit: (...a: unknown[]) => mockIncrement(...a)
}));
vi.mock('$lib/server/profile/portfolio-key', () => ({
	givePortfolioKey: (...a: unknown[]) => mockGiveKey(...a)
}));
vi.mock('$lib/server/profile/portfolio-themes', () => ({
	getPortfolioThemeById: () => mockThemeById(),
	getPortfolioThemesForProfile: () => mockThemes()
}));
vi.mock('$lib/server/profile/translations', () => ({
	loadTranslator: async () => ({ locale: null }),
	applyTranslations: () => {}
}));
vi.mock('$lib/server/profile/field-variants', () => ({
	loadFieldVariants: async () => [],
	applyFieldVariants: () => {}
}));
vi.mock('$lib/server/profile/skill-words', () => ({
	loadDocumentSkillWords: async () => [],
	applySkillWords: () => {},
	renderedVersionId: (_p: unknown, id: number) => id
}));
vi.mock('$lib/server/profile/page-profile', () => ({
	pageProfile: (profile: unknown) => profile
}));

import { load } from '../+page.server';

const SPLIT = { id: 9, name: 'S', slug: 's', config: { layout: 'showcase', privateCv: true } };
const ONE_PAGE = { id: 9, name: 'S', slug: 's', config: { layout: 'showcase' } };

const LINK = {
	id: 3,
	status: 'published',
	profile_version: 5,
	expires_at: null,
	visit_limit: null,
	visit_count: 0,
	format: 'portfolio',
	view_mode: 'html'
};

async function run(path = '/p/alex/s/abc') {
	try {
		const data = await (load as unknown as (e: unknown) => Promise<Record<string, unknown>>)({
			params: { slug: 'alex', token: 'abc' },
			url: new URL(`https://dev.example${path}`),
			locals: {},
			cookies: {},
			getClientAddress: () => '127.0.0.1'
		});
		return { data, status: 200, location: null };
	} catch (e) {
		const thrown = e as { status: number; location?: string };
		return { data: null, status: thrown.status, location: thrown.location ?? null };
	}
}

beforeEach(() => {
	vi.clearAllMocks();
	mockProfile.mockResolvedValue({ id: 1, slug: 'alex', public_portfolio_theme_id: 9 });
	mockToken.mockResolvedValue(LINK);
	mockVersion.mockResolvedValue({ profile_id: 1 });
	mockThemeById.mockResolvedValue(SPLIT);
	mockThemes.mockResolvedValue([SPLIT]);
});

describe('a portfolio share link', () => {
	it('counts the visit, leaves the key and goes to the private CV page', async () => {
		const res = await run('/p/alex/s/abc?lang=nl');
		expect(res.status).toBe(303);
		expect(res.location).toBe('/p/alex/portfolio/cv?lang=nl');
		expect(mockIncrement).toHaveBeenCalledWith(3, '127.0.0.1');
		expect(mockGiveKey).toHaveBeenCalledWith(expect.anything(), expect.any(URL), 1, 'abc', null);
	});

	it('goes to the one page of a site that keeps its career there', async () => {
		mockThemeById.mockResolvedValue(ONE_PAGE);
		expect((await run()).location).toBe('/p/alex/portfolio');
	});

	it('picks the first theme for a site not yet published, as the site does', async () => {
		mockProfile.mockResolvedValue({ id: 1, slug: 'alex', public_portfolio_theme_id: null });
		expect((await run()).location).toBe('/p/alex/portfolio/cv');
	});

	it('leaves no key for a link that is disabled, expired or used up', async () => {
		for (const over of [
			{ status: 'draft' },
			{ expires_at: new Date('2020-01-01') },
			{ visit_limit: 1, visit_count: 1 }
		]) {
			mockToken.mockResolvedValue({ ...LINK, ...over });
			expect((await run()).status).toBe(403);
		}
		expect(mockGiveKey).not.toHaveBeenCalled();
	});

	it('leaves no key for a link to another profile', async () => {
		mockVersion.mockResolvedValue({ profile_id: 2 });
		expect((await run()).status).toBe(404);
		expect(mockGiveKey).not.toHaveBeenCalled();
	});
});

describe('a resume link', () => {
	it('still renders where it lands, and leaves no key', async () => {
		mockToken.mockResolvedValue({ ...LINK, format: 'resume' });
		const res = await run();
		expect(res.status).toBe(200);
		expect(res.data?.format).toBe('resume');
		expect(mockGiveKey).not.toHaveBeenCalled();
	});
});
