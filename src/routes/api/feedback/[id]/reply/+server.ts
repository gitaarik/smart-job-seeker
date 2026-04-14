import { json, error } from "@sveltejs/kit";
import type { RequestHandler } from "./$types";
import { dbDirect as db } from "$lib/server/db";

export const POST: RequestHandler = async ({ params, request, locals }) => {
  const user = locals.user;
  if (!user) error(401, "Not authenticated");

  const feedbackId = parseInt(params.id);
  if (isNaN(feedbackId)) error(400, "Invalid feedback ID");

  const body = await request.json();
  const message = body.message?.trim();
  if (!message) error(400, "Message is required");

  const feedback = await db.user_feedback.findUnique({
    where: { id: feedbackId },
    include: { subscribers: { select: { user_id: true } } },
  });
  if (!feedback) error(404, "Feedback not found");

  if (feedback.merged_into_id) {
    error(400, `This ticket has been merged into #${feedback.merged_into_id}`);
  }

  // Check authorization: owner, subscriber, or admin
  const isOwner = feedback.user_id === user.id;
  const isSubscriber = feedback.subscribers.some((s) => s.user_id === user.id);
  const isAdmin = user.is_admin === true;

  if (!isOwner && !isSubscriber && !isAdmin) {
    error(403, "Not authorized");
  }

  await db.feedback_replies.create({
    data: {
      feedback_id: feedbackId,
      user_id: user.id,
      is_admin: isAdmin,
      message,
    },
  });

  // Auto-update status based on who replied
  let newStatus: string | undefined;
  if (isAdmin && feedback.status === "new") {
    newStatus = "reviewed";
  } else if (!isAdmin && feedback.status === "waiting") {
    newStatus = "reviewed";
  }

  await db.user_feedback.update({
    where: { id: feedbackId },
    data: {
      date_updated: new Date(),
      ...(newStatus ? { status: newStatus } : {}),
    },
  });

  return json({ success: true });
};
