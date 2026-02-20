import { launchBrowser } from "$lib/server/browser/utils";
import { config } from "$lib/server/config";
import { dbDirect as db } from "$lib/server/db";
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
  versionName: string,
): Promise<void> {
  const profile = await db.profiles.findUnique({
    where: { id: profileId },
    select: { slug: true, name: true, user_id: true },
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

    for (const doc of DOC_TYPES) {
      const route = `p/${profile.slug}/${doc.type}?version=${versionName}`;
      const url = `${APP_INTERNAL_URL}/${route}`;

      console.log(
        `[generate-version-pdfs] Generating ${doc.display} PDF for "${versionName}"...`,
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
      const filename = `${displayName} - ${docLabel} - ${versionName}.pdf`;

      const sourceUrl = buildExportUrl({ route });

      await createProfileExport({
        profileId,
        fileBuffer: buffer,
        filename,
        fileType: "pdf",
        exportType: doc.type,
        exportFormat: versionName,
        description: `${doc.display} (${versionName}) - Generated ${
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
      `[generate-version-pdfs] Done generating PDFs for version "${versionName}"`,
    );
  } finally {
    await context.close();
  }
}
