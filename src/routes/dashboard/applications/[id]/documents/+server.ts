import type { RequestHandler } from "./$types";
import { error } from "@sveltejs/kit";
import { dbDirect as db } from "$lib/server/db";
import { getFile } from "$lib/server/files";
import { getSelectedProfileId } from "../../../profile/utils";

export const GET: RequestHandler = async ({ url, locals, cookies, params }) => {
  const user = locals.user;
  if (!user) error(401, "Not authenticated");

  const profileId = await getSelectedProfileId(cookies, user.id);
  if (!profileId) error(400, "No profile selected");

  const appId = parseInt(params.id);
  if (isNaN(appId)) error(400, "Invalid application ID");

  const application = await db.query.applications.findFirst({
    where: { id: appId, profile_id: profileId },
  });
  if (!application) error(404, "Application not found");

  const fileId = url.searchParams.get("fileId");
  if (!fileId) error(400, "File ID required");

  // Verify file belongs to this application (either as attached file or CV sent)
  const isAttached = await db.query.applications_files.findFirst({
    where: { applications_id: appId, file_id: fileId },
  });
  const isCvFile = application.cv_file_sent_id === fileId;
  if (!isAttached && !isCvFile) error(403, "File not associated with this application");

  const fileMeta = await db.query.files.findFirst({
    where: { id: fileId },
    select: { filename_download: true, type: true },
  });

  const buffer = await getFile(fileId);

  return new Response(buffer, {
    headers: {
      "Content-Type": fileMeta?.type || "application/octet-stream",
      "Content-Disposition": `attachment; filename="${fileMeta?.filename_download || "file"}"`,
    },
  });
};
