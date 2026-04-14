import type { RequestHandler } from "./$types";
import { error } from "@sveltejs/kit";
import { dbDirect as db } from "$lib/server/db";
import { getFileFromDirectus } from "$lib/server/directus/files";

export const GET: RequestHandler = async ({ params, url, locals }) => {
  const user = locals.user;
  if (!user) error(401, "Not authenticated");

  const feedbackId = parseInt(params.id);
  if (isNaN(feedbackId)) error(400, "Invalid feedback ID");

  const fileId = url.searchParams.get("fileId");
  if (!fileId) error(400, "File ID required");

  // Load feedback and check ownership/subscription
  const feedback = await db.user_feedback.findUnique({
    where: { id: feedbackId },
    include: { subscribers: { select: { user_id: true } } },
  });
  if (!feedback) error(404, "Feedback not found");

  const isOwner = feedback.user_id === user.id;
  const isSubscriber = feedback.subscribers.some((s) => s.user_id === user.id);
  const isAdmin = (user as any).is_admin === true;

  if (!isOwner && !isSubscriber && !isAdmin) {
    error(403, "Not authorized");
  }

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
