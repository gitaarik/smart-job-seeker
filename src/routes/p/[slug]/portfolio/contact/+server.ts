/**
 * A showcase portfolio's contact details, for a visitor Turnstile has passed.
 *
 * The page never carries them (see server/profile/portfolio-contact.ts), so
 * this is the only way they leave the server for an anonymous visitor, and it
 * asks the same questions the page does before answering: the profile has to
 * be one the caller may see as a portfolio (published, a share token, or its
 * owner), the version they may see must not be anonymous, and the theme has to
 * be one that gates contact at all.
 *
 * Not under /api/, so the session gate in hooks.server.ts does not apply: the
 * visitor is anonymous by design, and the Turnstile check is the whole of what
 * stands in front of it.
 */

import { error, json } from '@sveltejs/kit';
import { eq } from 'drizzle-orm';
import { db } from '$lib/server/db';
import { profile_versions, profiles } from '$lib/server/db/schema';
import { checkProfileAccess } from '$lib/server/profile/access-control';
import { isAnonymousChain } from '$lib/server/profile/anonymity';
import {
	getPortfolioThemeById,
	getPortfolioThemesForProfile
} from '$lib/server/profile/portfolio-themes';
import { gatesContact, type PortfolioContact } from '$lib/server/profile/portfolio-contact';
import { verifyTurnstileToken } from '$lib/server/auth/turnstile';
import type { RequestHandler } from './$types';

export const POST: RequestHandler = async ({ params, request, locals, getClientAddress }) => {
	const body = (await request.json().catch(() => null)) as {
		turnstileToken?: unknown;
		accessToken?: unknown;
	} | null;
	const turnstileToken = typeof body?.turnstileToken === 'string' ? body.turnstileToken : null;
	const accessToken = typeof body?.accessToken === 'string' ? body.accessToken : null;

	const id = parseInt(params.slug, 10);
	const profile = await db.query.profiles.findFirst({
		where: isNaN(id) ? eq(profiles.slug, params.slug) : eq(profiles.id, id)
	});
	if (!profile) throw error(404, 'Not found');

	const access = await checkProfileAccess({
		profile,
		token: accessToken,
		userId: locals.user?.id,
		clientIp: getClientAddress(),
		routeType: 'portfolio'
	});
	if (!access.allowed) throw error(404, 'Not found');

	// An anonymous version prints no name, email or phone (anonymiseTree), so
	// its page offers no button; a share link to one must not reach the
	// details here either, or the link holder learns who it is by asking. The
	// version is the one access control resolved: the published one, or the
	// token's. The owner is asking about themselves.
	if (access.accessType !== 'owner') {
		const versions = await db.query.profile_versions.findMany({
			where: eq(profile_versions.profile_id, profile.id),
			columns: { id: true, toggles: true },
			with: { extension_links: { columns: { extended_id: true } } }
		});
		if (isAnonymousChain(versions, access.versionId)) throw error(404, 'Not found');
	}

	// The theme the page would have rendered with: the published one, or for a
	// share link of a site not yet published, the first one, as s/[token] picks.
	const published = profile.public_portfolio_theme_id
		? await getPortfolioThemeById(profile.id, profile.public_portfolio_theme_id)
		: null;
	// The owner is let through on any theme, since `?theme=` previews one that is
	// not published, and the details are their own.
	if (access.accessType === 'public' && !published) throw error(404, 'Not found');
	const theme = published ?? (await getPortfolioThemesForProfile(profile.id))[0] ?? null;
	if (access.accessType !== 'owner' && !gatesContact(theme)) throw error(404, 'Not found');

	const verdict = await verifyTurnstileToken(turnstileToken, getClientAddress());
	if (!verdict.success) {
		console.warn('[portfolio-contact] Turnstile refused:', verdict.errorCodes);
		throw error(403, 'Human verification failed');
	}

	const contact: PortfolioContact = {
		email: profile.email_address ?? null,
		phone: profile.phone_number ?? null,
		timezone: profile.location_timezone ?? null
	};
	return json(contact, { headers: { 'Cache-Control': 'no-store' } });
};
