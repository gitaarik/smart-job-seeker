import { json, error } from "@sveltejs/kit";
import type { RequestHandler } from "./$types";
import { dbDirect as db } from "$lib/server/db";
import { uploadFile } from "$lib/server/files";
import { Buffer } from "buffer";

export const POST: RequestHandler = async ({ request, locals }) => {
  const user = locals.user;
  if (!user) error(401, "Not authenticated");

  const formData = await request.formData();
  const message = (formData.get("message") as string)?.trim();
  if (!message) error(400, "Message is required");

  const category = (formData.get("category") as string) || "other";
  const pageUrl = (formData.get("page_url") as string) || null;
  const profileId = formData.get("profile_id")
    ? parseInt(formData.get("profile_id") as string)
    : null;

  const feedback = await db.user_feedback.create({
    data: {
      user_id: user.id,
      profile_id: profileId,
      category,
      message,
      page_url: pageUrl,
      date_created: new Date(),
    },
  });

  // Handle file attachments (up to 5 files, 10MB each)
  const files = formData.getAll("files") as File[];
  for (const file of files.slice(0, 5)) {
    if (!file || file.size === 0) continue;
    if (file.size > 10 * 1024 * 1024) continue;

    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    const uploaded = await uploadFile({
      filename: file.name,
      buffer,
      title: `Feedback #${feedback.id} - ${file.name}`,
    });

    await db.user_feedback_files.create({
      data: {
        user_feedback_id: feedback.id,
        directus_files_id: uploaded.id,
      },
    });
  }

  return json({ success: true, id: feedback.id });
};
