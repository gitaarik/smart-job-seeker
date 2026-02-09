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

export const GET: RequestHandler = async (
  { params, url, getClientAddress },
) => {
  const { slug } = params;
  const token = url.searchParams.get("t");

  // Get profile by slug
  const profile = await getProfileByIdentifier(slug);

  if (!profile) {
    throw error(404, `Profile not found: ${slug}`);
  }

  // Check access control
  const accessResult = await checkProfileAccess({
    profile,
    token,
    clientIp: getClientAddress(),
    routeType: "resume",
  });

  if (!accessResult.allowed) {
    throw error(accessResult.statusCode, accessResult.message);
  }

  // Increment visit counter if token was used
  if (accessResult.accessType === "token" && accessResult.tokenId) {
    await incrementTokenVisit(accessResult.tokenId, getClientAddress());
  }

  // Determine version from access control (token or public version)
  let effectiveVersion: string | null = null;
  if (accessResult.versionId) {
    effectiveVersion = await getVersionNameById(accessResult.versionId);
  }

  // Query latest resume PDF export from profile_exports
  // Try with raw version name first (new format), then fall back to transformed format (old exports)
  let exportWithFile = null;

  if (effectiveVersion) {
    // Try raw version name first (new format)
    exportWithFile = await getLatestExportWithFile({
      profileId: profile.id,
      exportType: "resume",
      fileType: "pdf",
      exportFormat: effectiveVersion,
    });

    // Fall back to transformed format for backward compatibility
    if (!exportWithFile) {
      const transformedFormat = transformVersionToExportFormat(
        effectiveVersion,
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
    // No version specified - get latest export
    exportWithFile = await getLatestExportWithFile({
      profileId: profile.id,
      exportType: "resume",
      fileType: "pdf",
    });
  }

  if (!exportWithFile) {
    const versionMsg = effectiveVersion
      ? ` for version "${effectiveVersion}"`
      : "";
    throw error(
      404,
      `Resume PDF not found for this profile${versionMsg}. Please generate an export first.`,
    );
  }

  // Serve the PDF file
  const filename = effectiveVersion
    ? `${slug}-resume-${effectiveVersion}.pdf`
    : `${slug}-resume.pdf`;

  return new Response(exportWithFile.buffer, {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `inline; filename="${filename}"`,
      "Cache-Control": "public, max-age=3600",
    },
  });
};
