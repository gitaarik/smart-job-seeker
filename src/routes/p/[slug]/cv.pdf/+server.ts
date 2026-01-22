import { error } from "@sveltejs/kit";
import type { RequestHandler } from "./$types";
import { getProfileByIdentifier } from "$lib/server/profile/default";
import { getLatestExportWithFile } from "$lib/server/profile/export-files";
import {
  checkProfileAccess,
  getVersionNameById,
} from "$lib/server/profile/access-control";
import { incrementTokenVisit } from "$lib/server/auth/token-validation";

/**
 * Transform version name to export_format
 * Converts "fullstack-django" to "CV (Fullstack Django)"
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

export const GET: RequestHandler = async (
  { params, url, locals, getClientAddress },
) => {
  const { slug } = params;
  const token = url.searchParams.get("t");
  const versionParam = url.searchParams.get("version");

  // Get profile by slug
  const profile = await getProfileByIdentifier(slug);

  if (!profile) {
    throw error(404, `Profile not found: ${slug}`);
  }

  // Check access control
  const accessResult = await checkProfileAccess({
    profile,
    user: locals.user,
    token,
    clientIp: getClientAddress(),
    routeType: "cv",
  });

  if (!accessResult.allowed) {
    throw error(accessResult.statusCode, accessResult.message);
  }

  // Increment visit counter if token was used
  if (accessResult.accessType === "token" && accessResult.tokenId) {
    await incrementTokenVisit(accessResult.tokenId, getClientAddress());
  }

  // Determine version priority:
  // 1. Token version (highest priority)
  // 2. Public version (if accessing via public route)
  // 3. URL ?version= parameter (owner only)
  // 4. Latest version (fallback)
  let effectiveVersion: string | null = null;
  if (accessResult.versionId) {
    // Access control already determined the version (from token or public version)
    effectiveVersion = await getVersionNameById(accessResult.versionId);
  } else if (versionParam && accessResult.accessType === "owner") {
    // Owner can specify version via URL parameter
    effectiveVersion = versionParam;
  }

  // Query latest CV PDF export from profile_exports
  // Try with raw version name first (new format), then fall back to transformed format (old exports)
  let exportWithFile = null;

  if (effectiveVersion) {
    // Try raw version name first (new format)
    exportWithFile = await getLatestExportWithFile({
      profileId: profile.id,
      exportType: "cv",
      fileType: "pdf",
      exportFormat: effectiveVersion,
    });

    // Fall back to transformed format for backward compatibility
    if (!exportWithFile) {
      const transformedFormat = transformVersionToExportFormat(
        effectiveVersion,
        "CV",
      );
      exportWithFile = await getLatestExportWithFile({
        profileId: profile.id,
        exportType: "cv",
        fileType: "pdf",
        exportFormat: transformedFormat,
      });
    }
  } else {
    // No version specified - get latest export
    exportWithFile = await getLatestExportWithFile({
      profileId: profile.id,
      exportType: "cv",
      fileType: "pdf",
    });
  }

  if (!exportWithFile) {
    const versionMsg = effectiveVersion
      ? ` for version "${effectiveVersion}"`
      : "";
    throw error(
      404,
      `CV PDF not found for this profile${versionMsg}. Please generate an export first.`,
    );
  }

  // Serve the PDF file
  const filename = effectiveVersion
    ? `${slug}-cv-${effectiveVersion}.pdf`
    : `${slug}-cv.pdf`;

  return new Response(exportWithFile.buffer, {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `inline; filename="${filename}"`,
      "Cache-Control": "public, max-age=3600",
    },
  });
};
