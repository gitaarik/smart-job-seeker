import { error } from "@sveltejs/kit";
import type { RequestHandler } from "./$types";
import { getProfileByIdentifier } from "$lib/server/profile/default";
import { getLatestExportWithFile } from "$lib/server/profile/export-files";
import {
  checkProfileAccess,
  getVersionSlugById,
} from "$lib/server/profile/access-control";
import { incrementTokenVisit } from "$lib/server/auth/token-validation";

/**
 * Transform version slug to export_format
 * Converts "fullstack-django" to "CV (Fullstack Django)"
 */
function transformVersionToExportFormat(
  versionSlug: string,
  docType: "Resume" | "CV",
): string {
  const formatted = versionSlug
    .replace(/-/g, " ")
    .replace(/\b\w/g, (l) => l.toUpperCase());
  return `${docType} (${formatted})`;
}

export const GET: RequestHandler = async (
  { params, url, locals, getClientAddress, request },
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
    userId: locals.user?.id,
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

  // Determine version from access control, or from ?version= query param for owner access
  let effectiveVersion: string | null = null;
  if (accessResult.versionId) {
    effectiveVersion = await getVersionSlugById(accessResult.versionId);
  } else if (accessResult.accessType === "owner") {
    effectiveVersion = url.searchParams.get("version");
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

  // The file_id is a fresh UUID on every regeneration, so it doubles as a
  // content hash. `no-cache` forces the browser (and Caddy) to revalidate on
  // every request — a regenerated PDF is served immediately instead of a stale
  // copy — while an unchanged file still returns a cheap 304.
  const etag = `"${exportWithFile.export.file_id}"`;
  const cacheControl = "private, no-cache, must-revalidate";

  if (request.headers.get("if-none-match") === etag) {
    return new Response(null, {
      status: 304,
      headers: { "ETag": etag, "Cache-Control": cacheControl },
    });
  }

  return new Response(new Uint8Array(exportWithFile.buffer), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `inline; filename="${filename}"`,
      "Cache-Control": cacheControl,
      "ETag": etag,
    },
  });
};
