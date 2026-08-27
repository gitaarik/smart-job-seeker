/**
 * How many pages a version actually renders to.
 *
 * The selector budgets in characters, which is a proxy for space and a poor one
 * across profiles: what fits a page depends on the fixed height of the template
 * around the prose — role headers, the skills block, education — and that
 * differs per applicant. Measured on this instance, one page held 1,150
 * characters of one profile's prose and 741 of another's.
 *
 * So the only way to know is to render it. This is the reason a tailored
 * version can promise a page count at all; see fitToPages in tailor-version.ts.
 *
 * And it has to be rendered in the template it will be SENT in. That sentence
 * above — what fits a page depends on the fixed height of the template — was
 * written here while this function always rendered the default one, so a version
 * fitted to two pages came out of a branded template at three. Measured on
 * `app-62`: two pages plain, three with `template=citrus`, same version, same
 * content. Nothing errored; the promise was simply about a different document.
 */

import { templateForStorage } from '$lib/resume-templates';
import { pdfSettingsFor, settleForPrint } from '$lib/server/profile/generate-version-pdfs';
import { launchBrowser } from '$lib/server/browser/utils';
import { config } from '$lib/server/config';
import { dbDirect as db } from '$lib/server/db';
import { eq } from 'drizzle-orm';
import { profiles } from '$lib/server/db/schema';

const APP_INTERNAL_URL = 'http://localhost:5173';

/**
 * A page object in a PDF is `/Type /Page`; the tree root is `/Type /Pages`, so
 * the trailing character keeps the root out of the count. Verified against
 * documents known to be one and two pages.
 */
function pageCount(pdf: Buffer): number {
	return (pdf.toString('latin1').match(/\/Type\s*\/Page[^s]/g) ?? []).length;
}

/**
 * The URL the counter renders.
 *
 * Exported because it is a pure string and it is where the bug was: it used to
 * omit `template` entirely, which is not visible in any test that mocks the
 * browser and is not visible in the page count either — the number returned was
 * simply about a different document.
 *
 * `templateForStorage` normalises, so "default" and "" both mean the plain
 * renderer here exactly as they do on `profile_exports.template`.
 */
export function renderRoute(
	profileSlug: string,
	docType: string,
	versionSlug: string,
	template: string | null = null
): string {
	const slug = templateForStorage(template);
	return (
		`${APP_INTERNAL_URL}/p/${profileSlug}/${docType === 'cv' ? 'cv' : 'resume'}` +
		`?version=${encodeURIComponent(versionSlug)}` +
		(slug ? `&template=${encodeURIComponent(slug)}` : '')
	);
}

/**
 * Render one version and count its pages, or null when it cannot be rendered.
 *
 * Null is a real answer and every caller has to treat it as "unknown" rather
 * than as a number: the browser is a separate container, and a tailored version
 * that fails to fit is far better than one that fails to generate.
 */
export async function countVersionPages(
	profileId: number,
	versionSlug: string,
	docType: string,
	/** Presentation template to render in; null (or 'default') is the plain one. */
	template: string | null = null
): Promise<number | null> {
	const profile = await db.query.profiles.findFirst({
		where: eq(profiles.id, profileId),
		columns: { slug: true, user_id: true }
	});
	if (!profile?.slug || !profile.user_id) return null;

	let context;
	try {
		context = await launchBrowser({ headless: true });
		const page = await context.newPage();
		await page.setViewportSize({ width: 1200, height: 1600 });
		// The render routes are public but version-aware; these headers are how
		// the PDF generator asks for the owner's view of one.
		await page.setExtraHTTPHeaders({
			'x-internal-render-secret': config.internalRenderSecret,
			'x-internal-user-id': profile.user_id
		});
		const route = renderRoute(profile.slug, docType, versionSlug, template);
		await page.goto(route, { waitUntil: 'networkidle', timeout: 30_000 });
		await settleForPrint(page);
		// The export's own settings, not a copy of them. This used to be a copy
		// commented "matches generate-version-pdfs" and it did not: a DB-backed
		// template renders full-bleed with zero page margin, while the copy forced
		// 0.4in on every side. Nearly an inch of lost height per page, so the
		// counter saw three pages where the applicant downloaded two — and the fit
		// loop cut a nine-year role to fix an overflow nobody had.
		return pageCount(Buffer.from(await page.pdf(pdfSettingsFor(templateForStorage(template)))));
	} catch (err) {
		console.warn('[page-fit] could not render', versionSlug, err);
		return null;
	} finally {
		await context?.close();
	}
}
