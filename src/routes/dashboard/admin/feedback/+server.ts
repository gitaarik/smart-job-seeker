import type { RequestHandler } from "./$types";
import { error } from "@sveltejs/kit";
import { dbDirect as db } from "$lib/server/db";
import { getFileFromDirectus } from "$lib/server/directus/files";

export const GET: RequestHandler = async ({ url, locals }) => {
  const user = locals.user;
  if (!user || !(user as any).is_admin) error(403, "Forbidden");

  const fileId = url.searchParams.get("fileId");
  if (!fileId) error(400, "File ID required");

  const feedbackId = parseInt(url.searchParams.get("feedbackId") || "");
  if (isNaN(feedbackId)) error(400, "Feedback ID required");

  // Verify file belongs to this feedback entry
  const link = await db.user_feedback_files.findFirst({
    where: { user_feedback_id: feedbackId, directus_files_id: fileId },
  });
  if (!link) error(403, "File not associated with this feedback");

  const fileMeta = await db.directus_files.findUnique({
    where: { id: fileId },
    select: { filename_download: true, type: true },
  });

  const buffer = await getFileFromDirectus(fileId);

  return new Response(new Uint8Array(buffer), {
    headers: {
      "Content-Type": fileMeta?.type || "application/octet-stream",
      "Content-Disposition": `attachment; filename="${fileMeta?.filename_download || "file"}"`,
    },
  });
};
