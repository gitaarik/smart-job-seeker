import { error } from "@sveltejs/kit";
import type { RequestHandler } from "./$types";
import { getProfileByIdentifier } from "$lib/server/profile-default";
import { getLatestExportWithFile } from "$lib/server/profile-export-files";

/**
 * Transform version name to export_format
 * Converts "fullstack-django" to "Resume (Fullstack Django)"
 */
function transformVersionToExportFormat(
  versionName: string,
  docType: "Resume" | "CV",
): string {
  const formatted = versionName
    .replace(/-/g, " ")
    .replace(/\b\w/g, (l) => l.toUpperCase());
  return `${docType} (${formatted})`;
}

export const GET: RequestHandler = async ({ params, url }) => {
  const { slug } = params;
  const versionParam = url.searchParams.get("version");

  // Get profile by slug
  const profile = await getProfileByIdentifier(slug);

  if (!profile) {
    throw error(404, `Profile not found: ${slug}`);
  }

  // Query latest resume PDF export from profile_exports
  // Try with raw version name first (new format), then fall back to transformed format (old exports)
  let exportWithFile = null;

  if (versionParam) {
    // Try raw version name first (new format)
    exportWithFile = await getLatestExportWithFile({
      profileId: profile.id,
      exportType: "resume",
      fileType: "pdf",
      exportFormat: versionParam,
    });

    // Fall back to transformed format for backward compatibility
    if (!exportWithFile) {
      const transformedFormat = transformVersionToExportFormat(
        versionParam,
        "Resume",
      );
      exportWithFile = await getLatestExportWithFile({
        profileId: profile.id,
        exportType: "resume",
        fileType: "pdf",
        exportFormat: transformedFormat,
      });
    }
  } else {
    // No version parameter - get latest export
    exportWithFile = await getLatestExportWithFile({
      profileId: profile.id,
      exportType: "resume",
      fileType: "pdf",
    });
  }

  if (!exportWithFile) {
    const versionMsg = versionParam ? ` for version "${versionParam}"` : "";
    throw error(
      404,
      `Resume PDF not found for this profile${versionMsg}. Please generate an export first.`,
    );
  }

  // Serve the PDF file
  const filename = versionParam
    ? `${slug}-resume-${versionParam}.pdf`
    : `${slug}-resume.pdf`;

  return new Response(exportWithFile.buffer, {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `inline; filename="${filename}"`,
      "Cache-Control": "public, max-age=3600",
    },
  });
};
