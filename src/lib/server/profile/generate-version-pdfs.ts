import { launchBrowser } from "$lib/server/browser/utils";
import { config } from "$lib/server/config";
import { dbDirect as db } from "$lib/server/db";
import { eq } from "drizzle-orm";
import { profiles } from "$lib/server/db/schema";
import { createProfileExport } from "$lib/server/profile/exports";
import { buildExportUrl } from "$lib/server/utils/export-url-builder";

const APP_INTERNAL_URL = "http://localhost:5173";

const PDF_SETTINGS = {
  format: "A4" as const,
  waitForFonts: true,
  margin: {
    top: "0.4in",
    right: "0.5in",
    bottom: "0.4in",
    left: "0.5in",
  },
  printBackground: true,
  preferCSSPageSize: false,
};

const DOC_TYPES = [
  { type: "resume", display: "Resume" },
  { type: "cv", display: "CV" },
] as const;

export async function generateVersionPdfs(
  profileId: number,
  versionSlug: string,
  template: string | null = null,
  locale: string | null = null,
): Promise<void> {
  const profile = await db.query.profiles.findFirst({
    where: eq(profiles.id, profileId),
    columns: { slug: true, name: true, user_id: true },
  });

  if (!profile?.slug) {
    console.error(
      `[generate-version-pdfs] Profile ${profileId} not found or missing slug`,
    );
    return;
  }

  if (!profile.user_id) {
    console.error(
      `[generate-version-pdfs] Profile ${profileId} has no user_id`,
    );
    return;
  }

  const context = await launchBrowser({ headless: true });

  try {
    const page = await context.newPage();
    await page.setViewportSize({ width: 1200, height: 1600 });

    // Set internal auth headers to bypass access control
    await page.setExtraHTTPHeaders({
      "x-internal-render-secret": config.internalRenderSecret,
      "x-internal-user-id": profile.user_id,
    });

    const templateQuery = template ? `&template=${template}` : "";
    const templateLabel = template ? ` [${template}]` : "";
    const localeQuery = locale ? `&lang=${locale}` : "";
    const localeLabel = locale ? ` <${locale}>` : "";

    for (const doc of DOC_TYPES) {
      const route =
        `p/${profile.slug}/${doc.type}?version=${versionSlug}${templateQuery}${localeQuery}`;
      const url = `${APP_INTERNAL_URL}/${route}`;

      console.log(
        `[generate-version-pdfs] Generating ${doc.display} PDF for "${versionSlug}"${templateLabel}${localeLabel}...`,
      );

      await page.goto(url, {
        waitUntil: "networkidle",
        timeout: 30000,
      });

      await page.evaluate(async () => {
        const images = Array.from(document.querySelectorAll("img"));
        await Promise.all(
          images.map((img) => {
            return new Promise<void>((resolve) => {
              if (img.complete) {
                resolve();
              } else {
                img.onload = () => resolve();
                img.onerror = () => resolve();
              }
            });
          }),
        );
      });

      const pdfBuffer = await page.pdf(PDF_SETTINGS);
      const buffer = Buffer.from(pdfBuffer);

      const displayName = profile.name || `Profile ${profileId}`;
      const docLabel = doc.type === "cv" ? "CV" : "Resume";
      const filename = `${displayName} - ${docLabel} - ${versionSlug}${
        template ? ` - ${template}` : ""
      }${locale ? ` - ${locale}` : ""}.pdf`;

      const sourceUrl = buildExportUrl({ route });

      await createProfileExport({
        profileId,
        fileBuffer: buffer,
        filename,
        fileType: "pdf",
        exportType: doc.type,
        exportFormat: versionSlug,
        template,
        locale,
        description: `${doc.display} (${versionSlug})${templateLabel}${localeLabel} - Generated ${
          new Date().toISOString()
        }`,
        sourceUrl,
      });

      console.log(
        `[generate-version-pdfs] ${doc.display} PDF saved (${
          (buffer.length / 1024).toFixed(1)
        } KB)`,
      );
    }

    console.log(
      `[generate-version-pdfs] Done generating PDFs for version "${versionSlug}"`,
    );
  } finally {
    await context.close();
  }
}
