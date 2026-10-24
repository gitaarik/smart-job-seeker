/**
 * `POST /p/<slug>/portfolio/contact`: the only way a showcase's email and
 * phone leave the server for an anonymous visitor. It has to refuse a bad
 * Turnstile token, a site that is not published, and a theme that does not
 * gate contact (whose page would have carried the details anyway, or not be
 * a showcase at all), and the refusals must not depend on the token check
 * having run first.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';

const mockProfile = vi.fn();
const mockAccess = vi.fn();
const mockThemeById = vi.fn();
const mockThemes = vi.fn();
const mockVerify = vi.fn();
const mockVersions = vi.fn();

vi.mock('$lib/server/db', () => ({
	db: {
		query: {
			profiles: { findFirst: () => mockProfile() },
			profile_versions: { findMany: () => mockVersions() }
		}
	}
}));
vi.mock('$lib/server/db/schema', () => ({
	profiles: { slug: 'slug', id: 'id' },
	profile_versions: { profile_id: 'profile_id' }
}));
vi.mock('$lib/server/profile/anonymity', async () => {
	const { isAnonymous } = await import('$lib/resume-anonymity');
	return {
		isAnonymousChain: (versions: { id: number; toggles: unknown }[], id: number) =>
			versions.some((v) => v.id === id && isAnonymous(v.toggles))
	};
});
vi.mock('drizzle-orm', () => ({ eq: () => ({}) }));
vi.mock('$lib/server/profile/access-control', () => ({
	checkProfileAccess: (o: unknown) => mockAccess(o)
}));
vi.mock('$lib/server/profile/portfolio-themes', () => ({
	getPortfolioThemeById: () => mockThemeById(),
	getPortfolioThemesForProfile: () => mockThemes()
}));
vi.mock('$lib/server/auth/turnstile', () => ({
	verifyTurnstileToken: (t: unknown) => mockVerify(t),
	turnstileConfigured: () => true,
	turnstileSiteKey: () => 'k'
}));

import { POST } from '../+server';

const SHOWCASE = { id: 9, name: 'S', slug: 's', config: { layout: 'showcase' } };
const BASIC = { id: 8, name: 'B', slug: 'b', config: {} };

const PROFILE = {
	id: 1,
	slug: 'alex',
	email_address: 'alex@example.com',
	phone_number: '+31 6 1234',
	location_timezone: 'Europe/Amsterdam',
	public_portfolio_theme_id: 9,
	public_portfolio_version_id: 5
};

async function post(body: unknown, user: { id: string } | null = null) {
	try {
		const res = await (POST as unknown as (e: unknown) => Promise<Response>)({
			params: { slug: 'alex' },
			request: new Request('http://x/p/alex/portfolio/contact', {
				method: 'POST',
				body: JSON.stringify(body)
			}),
			locals: { user },
			getClientAddress: () => '127.0.0.1'
		});
		return { status: res.status, body: await res.json() };
	} catch (e) {
		return { status: (e as { status: number }).status, body: null };
	}
}

beforeEach(() => {
	vi.clearAllMocks();
	mockProfile.mockResolvedValue(PROFILE);
	mockAccess.mockResolvedValue({ allowed: true, accessType: 'public', versionId: 5 });
	mockVersions.mockResolvedValue([{ id: 5, toggles: [], extension_links: [] }]);
	mockThemeById.mockResolvedValue(SHOWCASE);
	mockThemes.mockResolvedValue([SHOWCASE]);
	mockVerify.mockResolvedValue({ success: true });
});

describe('portfolio contact endpoint', () => {
	it('answers a passing token on a published showcase with the details', async () => {
		const res = await post({ turnstileToken: 'good' });
		expect(res.status).toBe(200);
		expect(res.body).toEqual({
			email: 'alex@example.com',
			phone: '+31 6 1234',
			timezone: 'Europe/Amsterdam'
		});
		expect(mockVerify).toHaveBeenCalledWith('good');
	});

	it('refuses a token Turnstile does not pass', async () => {
		mockVerify.mockResolvedValue({ success: false, errorCodes: ['invalid-input-response'] });
		expect((await post({ turnstileToken: 'bad' })).status).toBe(403);
	});

	it('refuses an unpublished site before asking Cloudflare', async () => {
		mockProfile.mockResolvedValue({ ...PROFILE, public_portfolio_theme_id: null });
		mockThemeById.mockResolvedValue(null);
		expect((await post({ turnstileToken: 'good' })).status).toBe(404);
		expect(mockVerify).not.toHaveBeenCalled();
	});

	it('refuses a caller access control turns away', async () => {
		mockAccess.mockResolvedValue({ allowed: false, accessType: 'public' });
		expect((await post({ turnstileToken: 'good' })).status).toBe(404);
	});

	it('refuses a basic theme, which never hid the details behind the gate', async () => {
		mockThemeById.mockResolvedValue(BASIC);
		expect((await post({ turnstileToken: 'good' })).status).toBe(404);
	});

	it('lets a share link through on a site not yet published', async () => {
		mockProfile.mockResolvedValue({ ...PROFILE, public_portfolio_theme_id: null });
		mockThemeById.mockResolvedValue(null);
		mockAccess.mockResolvedValue({ allowed: true, accessType: 'token' });
		const res = await post({ turnstileToken: 'good', accessToken: 'share' });
		expect(res.status).toBe(200);
		expect(mockAccess).toHaveBeenCalledWith(expect.objectContaining({ token: 'share' }));
	});

	it('refuses a share link to an anonymous version, whose page shows no details', async () => {
		const { withAnonymous } = await import('$lib/resume-anonymity');
		mockAccess.mockResolvedValue({ allowed: true, accessType: 'token', versionId: 7 });
		mockVersions.mockResolvedValue([
			{ id: 7, toggles: withAnonymous([], true), extension_links: [] }
		]);
		expect((await post({ turnstileToken: 'good', accessToken: 'share' })).status).toBe(404);
		expect(mockVerify).not.toHaveBeenCalled();
	});

	it('404s an unknown profile', async () => {
		mockProfile.mockResolvedValue(undefined);
		expect((await post({ turnstileToken: 'good' })).status).toBe(404);
	});
});
