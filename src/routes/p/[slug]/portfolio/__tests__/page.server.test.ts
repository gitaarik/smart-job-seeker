/**
 * The portfolio's public page, as far as the private CV page changes it: the
 * page of a site with one carries none of the career, offers the way to it
 * only to a visitor who may open it, and lets the key a portfolio link left
 * open a site that is not published yet, as the link itself could.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';

const mockProfile = vi.fn();
const mockAccess = vi.fn();
const mockIncrement = vi.fn();
const mockTouch = vi.fn();
const mockReadKey = vi.fn();
const mockGiveKey = vi.fn();
const mockThemeById = vi.fn();
const mockThemes = vi.fn();

vi.mock('$lib/server/profile/default', () => ({
	getProfileByIdentifier: () => mockProfile()
}));
vi.mock('$lib/server/profile/access-control', () => ({
	checkProfileAccess: (...a: unknown[]) => mockAccess(...a),
	getVersionIdBySlug: async () => null
}));
vi.mock('$lib/server/auth/token-validation', () => ({
	incrementTokenVisit: (...a: unknown[]) => mockIncrement(...a),
	touchTokenVisit: (...a: unknown[]) => mockTouch(...a)
}));
vi.mock('$lib/server/profile/portfolio-key', () => ({
	readPortfolioKey: (...a: unknown[]) => mockReadKey(...a),
	givePortfolioKey: (...a: unknown[]) => mockGiveKey(...a)
}));
vi.mock('$lib/server/profile/portfolio-themes', () => ({
	getPortfolioThemeById: () => mockThemeById(),
	getPortfolioTheme: async () => null,
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
	applySkillWords: () => {}
}));
vi.mock('$lib/server/profile/page-profile', () => ({
	pageProfile: (profile: unknown) => profile
}));
vi.mock('$lib/server/auth/turnstile', () => ({
	turnstileConfigured: () => false,
	turnstileSiteKey: () => null
}));

import { load } from '../+page.server';

const SPLIT = { id: 9, name: 'S', slug: 's', config: { layout: 'showcase', privateCv: true } };
const ONE_PAGE = { id: 9, name: 'S', slug: 's', config: { layout: 'showcase' } };

function profile(over: Record<string, unknown> = {}) {
	return {
		id: 1,
		slug: 'alex',
		user_id: 'owner-1',
		email_address: null,
		phone_number: null,
		public_portfolio_theme_id: 9,
		public_portfolio_version_id: 5,
		profile_versions: [],
		highlights: [],
		references: [],
		side_projects: [],
		work_experiences: [
			{
				id: 10,
				name: 'NowCorp',
				work_experience_achievements: [{ id: 100, description: 'Cut costs 40%' }],
				work_experience_projects: [
					{ id: 11, name: 'Payments rewrite', featured: true },
					{ id: 12, name: 'Admin cleanup' }
				]
			}
		],
		...over
	};
}

const PUBLIC = { allowed: true, statusCode: 200, accessType: 'public', versionId: 5 };
const REFUSED = { allowed: false, statusCode: 401, message: 'nope', accessType: 'public' };

async function run(path = '/p/alex/portfolio') {
	try {
		const data = await (load as unknown as (e: unknown) => Promise<Record<string, unknown>>)({
			params: { slug: 'alex' },
			url: new URL(`https://dev.example${path}`),
			locals: { user: null },
			cookies: {},
			getClientAddress: () => '127.0.0.1'
		});
		return { data, status: 200 };
	} catch (e) {
		return { data: null, status: (e as { status: number }).status };
	}
}

const json = (data: unknown) => JSON.stringify(data);

beforeEach(() => {
	vi.clearAllMocks();
	mockProfile.mockResolvedValue(profile());
	mockAccess.mockResolvedValue(PUBLIC);
	mockThemeById.mockResolvedValue(SPLIT);
	mockThemes.mockResolvedValue([SPLIT]);
	mockReadKey.mockResolvedValue(null);
});

describe('the public page of a site with a private CV page', () => {
	it('carries the featured project and none of the rest of the career', async () => {
		const { data } = await run();
		expect(data?.page).toBe('home');
		expect(json(data?.profile)).toContain('Payments rewrite');
		expect(json(data?.profile)).not.toContain('Admin cleanup');
		expect(json(data?.profile)).not.toContain('Cut costs 40%');
	});

	it('names no way to the CV page to a visitor without the key', async () => {
		const { data } = await run();
		expect(data?.cvHref).toBeNull();
		expect(data?.homeHref).toBeNull();
	});

	it('names it to one holding the key, and counts nothing for a published page', async () => {
		mockReadKey.mockResolvedValue({ token: 'abc', tokenId: 3, versionId: 77 });
		const { data } = await run('/p/alex/portfolio?lang=nl');
		expect(data?.cvHref).toBe('/p/alex/portfolio/cv?lang=nl');
		expect(data?.versionId).toBe(5);
		expect(mockTouch).not.toHaveBeenCalled();
		expect(mockIncrement).not.toHaveBeenCalled();
	});

	it('opens a site not yet published to the key, in the profile’s first theme', async () => {
		mockProfile.mockResolvedValue(profile({ public_portfolio_theme_id: null }));
		mockAccess.mockResolvedValue(REFUSED);
		mockThemeById.mockResolvedValue(null);
		mockReadKey.mockResolvedValue({ token: 'abc', tokenId: 3, versionId: 77 });
		const { data, status } = await run();
		expect(status).toBe(200);
		expect(data).toMatchObject({ versionId: 77, theme: SPLIT, accessType: 'token' });
		expect(mockTouch).toHaveBeenCalledWith(3, '127.0.0.1');
	});

	it('stays closed to a visitor with neither', async () => {
		mockProfile.mockResolvedValue(profile({ public_portfolio_theme_id: null }));
		mockAccess.mockResolvedValue(REFUSED);
		expect((await run()).status).toBe(401);
	});

	it('does not let a key stand in for a token in the URL that was refused', async () => {
		mockAccess.mockResolvedValue({ ...REFUSED, accessType: 'token' });
		mockReadKey.mockResolvedValue({ token: 'abc', tokenId: 3, versionId: 77 });
		expect((await run('/p/alex/portfolio?t=revoked')).status).toBe(401);
	});

	it('takes a portfolio link in the URL as a key too, so its menu works', async () => {
		mockAccess.mockResolvedValue({
			allowed: true,
			statusCode: 200,
			accessType: 'token',
			versionId: 77,
			tokenId: 3,
			tokenFormat: 'portfolio',
			tokenExpiresAt: null
		});
		const { data } = await run('/p/alex/portfolio?t=abc');
		expect(mockIncrement).toHaveBeenCalledWith(3, '127.0.0.1');
		expect(mockGiveKey).toHaveBeenCalledWith(expect.anything(), expect.any(URL), 1, 'abc', null);
		expect(data?.cvHref).toBe('/p/alex/portfolio/cv');
	});
});

describe('a site on one page', () => {
	it('carries the whole career and names no CV page, key or not', async () => {
		mockThemeById.mockResolvedValue(ONE_PAGE);
		mockReadKey.mockResolvedValue({ token: 'abc', tokenId: 3, versionId: 77 });
		const { data } = await run();
		expect(data?.page).toBe('site');
		expect(data?.cvHref).toBeNull();
		expect(json(data?.profile)).toContain('Admin cleanup');
	});
});
