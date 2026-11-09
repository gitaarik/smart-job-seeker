/**
 * The private CV page decides who may read the whole career. It must open for
 * the owner and for the key a portfolio link leaves, and for nobody else; a
 * visitor without the key goes to the public page, which says nothing about
 * what they missed. A link in the URL is counted, leaves its key and comes
 * back without the token. And the page never asks to be indexed or cached.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';

const mockProfile = vi.fn();
const mockValidate = vi.fn();
const mockIncrement = vi.fn();
const mockTouch = vi.fn();
const mockReadKey = vi.fn();
const mockGiveKey = vi.fn();
const mockThemeById = vi.fn();
const mockThemeBySlug = vi.fn();
const mockThemes = vi.fn();
const mockVersionBySlug = vi.fn();

vi.mock('$lib/server/profile/default', () => ({
	getProfileByIdentifier: () => mockProfile()
}));
vi.mock('$lib/server/profile/access-control', () => ({
	getVersionIdBySlug: (...a: unknown[]) => mockVersionBySlug(...a)
}));
vi.mock('$lib/server/auth/token-validation', () => ({
	validateToken: (...a: unknown[]) => mockValidate(...a),
	incrementTokenVisit: (...a: unknown[]) => mockIncrement(...a),
	touchTokenVisit: (...a: unknown[]) => mockTouch(...a)
}));
vi.mock('$lib/server/profile/portfolio-key', () => ({
	readPortfolioKey: (...a: unknown[]) => mockReadKey(...a),
	givePortfolioKey: (...a: unknown[]) => mockGiveKey(...a)
}));
vi.mock('$lib/server/profile/portfolio-themes', () => ({
	getPortfolioThemeById: () => mockThemeById(),
	getPortfolioTheme: (...a: unknown[]) => mockThemeBySlug(...a),
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

const PROFILE = {
	id: 1,
	slug: 'alex',
	user_id: 'owner-1',
	email_address: 'alex@example.com',
	phone_number: null,
	public_portfolio_theme_id: 9,
	public_portfolio_version_id: 5
};

async function run(path: string, user: { id: string } | null = null) {
	const headers: Record<string, string> = {};
	try {
		const data = await (load as unknown as (e: unknown) => Promise<Record<string, unknown>>)({
			params: { slug: 'alex' },
			url: new URL(`https://dev.example${path}`),
			locals: { user },
			cookies: {},
			setHeaders: (h: Record<string, string>) => Object.assign(headers, h),
			getClientAddress: () => '127.0.0.1'
		});
		return { data, headers, status: 200, location: null };
	} catch (e) {
		const thrown = e as { status: number; location?: string };
		return { data: null, headers, status: thrown.status, location: thrown.location ?? null };
	}
}

beforeEach(() => {
	vi.clearAllMocks();
	mockProfile.mockResolvedValue({ ...PROFILE });
	mockThemeById.mockResolvedValue(SPLIT);
	mockThemes.mockResolvedValue([SPLIT]);
	mockReadKey.mockResolvedValue(null);
});

describe('the private CV page', () => {
	it('sends a visitor without the key to the public page, and tells no crawler to index it', async () => {
		const res = await run('/p/alex/portfolio/cv?lang=nl');
		expect(res.status).toBe(303);
		expect(res.location).toBe('/p/alex/portfolio?lang=nl');
		expect(res.headers['X-Robots-Tag']).toBe('noindex, nofollow');
	});

	it('is not found at all for a visitor without the key to a site not published', async () => {
		mockProfile.mockResolvedValue({ ...PROFILE, public_portfolio_theme_id: null });
		expect((await run('/p/alex/portfolio/cv')).status).toBe(404);
	});

	it('opens for the key, with the version its link was made for, and no visit counted', async () => {
		mockReadKey.mockResolvedValue({ token: 'abc', tokenId: 3, versionId: 77 });
		const res = await run('/p/alex/portfolio/cv');
		expect(res.status).toBe(200);
		expect(res.data).toMatchObject({ page: 'cv', versionId: 77, theme: SPLIT });
		expect(res.headers['Cache-Control']).toBe('private, no-store');
		expect(mockTouch).toHaveBeenCalledWith(3, '127.0.0.1');
		expect(mockIncrement).not.toHaveBeenCalled();
	});

	it('keeps the contact details out of the page, behind the gate', async () => {
		mockReadKey.mockResolvedValue({ token: 'abc', tokenId: 3, versionId: 77 });
		const { data } = await run('/p/alex/portfolio/cv');
		expect((data?.profile as { email_address: unknown }).email_address).toBeNull();
		expect(data?.contact).toEqual({ available: true, siteKey: null });
	});

	it('opens for the owner, without a key, with what they preview', async () => {
		mockThemeBySlug.mockResolvedValue(SPLIT);
		mockVersionBySlug.mockResolvedValue(42);
		const res = await run('/p/alex/portfolio/cv?theme=s&version=ai', { id: 'owner-1' });
		expect(res.status).toBe(200);
		expect(res.data).toMatchObject({
			versionId: 42,
			homeHref: '/p/alex/portfolio?theme=s&version=ai'
		});
		expect(mockReadKey).not.toHaveBeenCalled();
	});

	it('takes a portfolio link in the URL: counts it, leaves the key and drops the token', async () => {
		mockValidate.mockResolvedValue({
			valid: true,
			tokenId: 3,
			profileVersionId: 77,
			format: 'portfolio',
			expiresAt: null
		});
		const res = await run('/p/alex/portfolio/cv?t=abc&lang=nl');
		expect(res.status).toBe(303);
		expect(res.location).toBe('/p/alex/portfolio/cv?lang=nl');
		expect(mockIncrement).toHaveBeenCalledWith(3, '127.0.0.1');
		expect(mockGiveKey).toHaveBeenCalledWith(expect.anything(), expect.any(URL), 1, 'abc', null);
	});

	it('does not take a resume link for a portfolio one', async () => {
		mockValidate.mockResolvedValue({
			valid: true,
			tokenId: 3,
			profileVersionId: 77,
			format: 'resume'
		});
		const res = await run('/p/alex/portfolio/cv?t=abc');
		expect(res.location).toBe('/p/alex/portfolio');
		expect(mockGiveKey).not.toHaveBeenCalled();
		expect(mockIncrement).not.toHaveBeenCalled();
	});

	it('sends even a key holder to the one page of a site that keeps its career there', async () => {
		mockThemeById.mockResolvedValue(ONE_PAGE);
		mockReadKey.mockResolvedValue({ token: 'abc', tokenId: 3, versionId: 77 });
		const res = await run('/p/alex/portfolio/cv');
		expect(res.status).toBe(303);
		expect(res.location).toBe('/p/alex/portfolio');
	});

	it('shows a site not yet published to a key holder, in the profile’s first theme', async () => {
		mockProfile.mockResolvedValue({ ...PROFILE, public_portfolio_theme_id: null });
		mockReadKey.mockResolvedValue({ token: 'abc', tokenId: 3, versionId: 77 });
		const res = await run('/p/alex/portfolio/cv');
		expect(res.status).toBe(200);
		expect(res.data?.theme).toBe(SPLIT);
	});
});
