import type { RequestHandler } from "./$types";
import { error } from "@sveltejs/kit";
import { dbDirect as db } from "$lib/server/db";
import { getSelectedProfileId } from "../../../profile/utils";
import { getFileFromDirectus } from "$lib/server/directus/files";

export const GET: RequestHandler = async ({ url, locals, cookies }) => {
  const user = locals.user;
  if (!user) {
    error(401, "Not authenticated");
  }

  const profileId = await getSelectedProfileId(cookies, user.id);
  if (!profileId) {
    error(400, "No profile selected");
  }

  const exportId = url.searchParams.get("id");
  if (!exportId) {
    error(400, "Missing export ID");
  }

  const exp = await db.profile_exports.findFirst({
    where: {
      id: parseInt(exportId, 10),
      profile: profileId,
    },
    include: {
      directus_files: true,
    },
  });

  if (!exp) {
    error(404, "Export not found");
  }

  const fileBuffer = await getFileFromDirectus(exp.file);
  const filename =
    exp.directus_files?.filename_download || `export-${exp.id}.${exp.file_type}`;

  // Determine content type based on file type
  let contentType: string;
  switch (exp.file_type) {
    case "zip":
      contentType = "application/zip";
      break;
    case "json":
      contentType = "application/json";
      break;
    case "pdf":
      contentType = "application/pdf";
      break;
    default:
      contentType = "application/octet-stream";
  }

  return new Response(fileBuffer, {
    headers: {
      "Content-Type": contentType,
      "Content-Disposition": `attachment; filename="${filename}"`,
    },
  });
};
