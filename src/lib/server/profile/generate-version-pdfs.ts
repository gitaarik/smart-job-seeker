import type { Page } from 'playwright';
import { launchBrowser } from '$lib/server/browser/utils';
import { config } from '$lib/server/config';
import { dbDirect as db } from '$lib/server/db';
import { eq } from 'drizzle-orm';
import { profiles } from '$lib/server/db/schema';
import { createProfileExport } from '$lib/server/profile/exports';
import { buildExportUrl } from '$lib/server/utils/export-url-builder';

const APP_INTERNAL_URL = 'http://localhost:5173';

/**
 * Everything that must finish before a page may be printed.
 *
 * `networkidle` is not enough and the difference is a whole page. Images decode
 * after the requests settle, and — the one that actually bit — **webfonts do
 * too**: print before `document.fonts.ready` and the text lays out in a fallback
 * face whose metrics are not the template's, so lines wrap differently and the
 * document gets longer.
 *
 * This lived inline in the export and nowhere else, so `page-fit.ts` printed
 * straight after `networkidle` and counted a fallback-font render. It reported
 * three pages for a document the applicant downloaded as two, and the fit loop
 * trimmed nine years of one role to fix an overflow that existed only in the
 * measurement. Shared now, for the same reason `pdfSettingsFor` is: two renders
 * that must agree cannot be two copies of the steps.
 */
export async function settleForPrint(page: Page): Promise<void> {
	await page.evaluate(async () => {
		const images = Array.from(document.querySelectorAll('img'));
		await Promise.all(
			images.map(
				(img) =>
					new Promise<void>((resolve) => {
						if (img.complete) return resolve();
						img.onload = () => resolve();
						img.onerror = () => resolve();
					})
			)
		);
		await document.fonts.ready;
	});
}

/**
 * The built-in default renderer (ProfileDisplay) has no `@page` rule, so the
 * PDF's page box is defined by these server-side margins.
 */
const DEFAULT_PDF_SETTINGS = {
	format: 'A4' as const,
	waitForFonts: true,
	// Side margins are 0.4in (not 0.5in) so the PDF text column (~717px on A4)
	// matches the on-screen ProfileDisplay width (w-782px minus px-8 = 718px);
	// wider margins made lines wrap in the PDF that don't wrap in the HTML view.
	margin: {
		top: '0.4in',
		right: '0.4in',
		bottom: '0.4in',
		left: '0.4in'
	},
	printBackground: true,
	preferCSSPageSize: false
};

/**
 * DB-backed templates (rendered by StructuredResume) are full-bleed: their
 * decoration paints to the sheet edge, so they render with zero page margin.
 * Margins live here (not in the template's CSS) because an `@page` rule can't
 * be Svelte-scoped — a template's `@page { margin: 0 }` would leak onto the
 * default renderer, which shares the route bundle, and strip its margins.
 */
const TEMPLATE_PDF_SETTINGS = {
	format: 'A4' as const,
	waitForFonts: true,
	margin: { top: '0', right: '0', bottom: '0', left: '0' },
	printBackground: true,
	preferCSSPageSize: false
};

/**
 * Default renderer uses fixed server margins; DB templates use their own CSS @page.
 *
 * Exported because `page-fit.ts` has to render with exactly these settings. A
 * page count taken at different margins is a count of a different document, and
 * for a branded template the gap is 0.8in of usable height — five or six lines a
 * page. It measured three pages where the export produced two, and the fit loop
 * trimmed a career to solve an overflow that only existed in the measurement.
 */
export function pdfSettingsFor(template: string | null) {
	return template ? TEMPLATE_PDF_SETTINGS : DEFAULT_PDF_SETTINGS;
}

const DOC_TYPES = [
	{ type: 'resume', display: 'Resume' },
	{ type: 'cv', display: 'CV' }
] as const;

export async function generateVersionPdfs(
	profileId: number,
	versionSlug: string,
	template: string | null = null,
	locale: string | null = null
): Promise<void> {
	const profile = await db.query.profiles.findFirst({
		where: eq(profiles.id, profileId),
		columns: { slug: true, name: true, user_id: true }
	});

	if (!profile?.slug) {
		console.error(`[generate-version-pdfs] Profile ${profileId} not found or missing slug`);
		return;
	}

	if (!profile.user_id) {
		console.error(`[generate-version-pdfs] Profile ${profileId} has no user_id`);
		return;
	}

	const context = await launchBrowser({ headless: true });

	try {
		const page = await context.newPage();
		await page.setViewportSize({ width: 1200, height: 1600 });

		// Set internal auth headers to bypass access control
		await page.setExtraHTTPHeaders({
			'x-internal-render-secret': config.internalRenderSecret,
			'x-internal-user-id': profile.user_id
		});

		const templateQuery = template ? `&template=${template}` : '';
		const templateLabel = template ? ` [${template}]` : '';
		const localeQuery = locale ? `&lang=${locale}` : '';
		const localeLabel = locale ? ` <${locale}>` : '';

		for (const doc of DOC_TYPES) {
			const route = `p/${profile.slug}/${doc.type}?version=${versionSlug}${templateQuery}${localeQuery}`;
			const url = `${APP_INTERNAL_URL}/${route}`;

			console.log(
				`[generate-version-pdfs] Generating ${doc.display} PDF for "${versionSlug}"${templateLabel}${localeLabel}...`
			);

			await page.goto(url, {
				waitUntil: 'networkidle',
				timeout: 30000
			});

			await settleForPrint(page);

			const pdfBuffer = await page.pdf(pdfSettingsFor(template));
			const buffer = Buffer.from(pdfBuffer);

			const displayName = profile.name || `Profile ${profileId}`;
			const docLabel = doc.type === 'cv' ? 'CV' : 'Resume';
			const filename = `${displayName} - ${docLabel} - ${versionSlug}${
				template ? ` - ${template}` : ''
			}${locale ? ` - ${locale}` : ''}.pdf`;

			const sourceUrl = buildExportUrl({ route });

			await createProfileExport({
				profileId,
				fileBuffer: buffer,
				filename,
				fileType: 'pdf',
				exportType: doc.type,
				exportFormat: versionSlug,
				template,
				locale,
				description: `${doc.display} (${versionSlug})${templateLabel}${localeLabel} - Generated ${new Date().toISOString()}`,
				sourceUrl
			});

			console.log(
				`[generate-version-pdfs] ${doc.display} PDF saved (${(buffer.length / 1024).toFixed(1)} KB)`
			);
		}

		console.log(`[generate-version-pdfs] Done generating PDFs for version "${versionSlug}"`);
	} finally {
		await context.close();
	}
}
