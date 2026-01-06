import { error } from "@sveltejs/kit";
import type { RequestHandler } from "./$types";
import { getProfileByIdentifier } from "$lib/server/profile-default";
import { getLatestExportWithFile } from "$lib/server/profile-export-files";

export const GET: RequestHandler = async ({ params }) => {
  const { slug } = params;

  // Get profile by slug
  const profile = await getProfileByIdentifier(slug);

  if (!profile) {
    throw error(404, `Profile not found: ${slug}`);
  }

  // Query latest resume PDF export from profile_exports
  const exportWithFile = await getLatestExportWithFile({
    profileId: profile.id,
    exportType: "resume",
    fileType: "pdf",
  });

  if (!exportWithFile) {
    throw error(
      404,
      "Resume PDF not found for this profile. Please generate an export first.",
    );
  }

  // Serve the PDF file
  return new Response(exportWithFile.buffer, {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `inline; filename="${slug}-resume.pdf"`,
      "Cache-Control": "public, max-age=3600",
    },
  });
};
