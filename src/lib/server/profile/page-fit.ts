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
 */

import { launchBrowser } from '$lib/server/browser/utils';
import { config } from '$lib/server/config';
import { dbDirect as db } from '$lib/server/db';
import { eq } from 'drizzle-orm';
import { profiles } from '$lib/server/db/schema';

const APP_INTERNAL_URL = 'http://localhost:5173';

/**
 * Matches generate-version-pdfs, so a page count here answers about the file
 * the applicant downloads rather than about a differently-margined render.
 */
const PDF_SETTINGS = {
	format: 'A4' as const,
	margin: { top: '0.4in', right: '0.4in', bottom: '0.4in', left: '0.4in' },
	printBackground: true
};

/**
 * A page object in a PDF is `/Type /Page`; the tree root is `/Type /Pages`, so
 * the trailing character keeps the root out of the count. Verified against
 * documents known to be one and two pages.
 */
function pageCount(pdf: Buffer): number {
	return (pdf.toString('latin1').match(/\/Type\s*\/Page[^s]/g) ?? []).length;
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
	docType: string
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
		const route = `${APP_INTERNAL_URL}/p/${profile.slug}/${docType === 'cv' ? 'cv' : 'resume'}?version=${encodeURIComponent(versionSlug)}`;
		await page.goto(route, { waitUntil: 'networkidle', timeout: 30_000 });
		return pageCount(Buffer.from(await page.pdf(PDF_SETTINGS)));
	} catch (err) {
		console.warn('[page-fit] could not render', versionSlug, err);
		return null;
	} finally {
		await context?.close();
	}
}
