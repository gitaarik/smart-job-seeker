import type { PageServerLoad } from "./$types";
import { dbDirect as db } from "$lib/server/db";

export const load: PageServerLoad = async ({ parent }) => {
  const { user } = await parent();

  // Get IDs of tickets the user is subscribed to (from merged tickets)
  const subscriptions = await db.user_feedback_subscribers.findMany({
    where: { user_id: user.id },
    select: { feedback_id: true },
  });
  const subscribedIds = subscriptions.map((s) => s.feedback_id);

  // Load tickets: owned by user OR subscribed to, excluding merged-away tickets
  const feedback = await db.user_feedback.findMany({
    where: {
      merged_into_id: null,
      OR: [
        { user_id: user.id },
        ...(subscribedIds.length > 0 ? [{ id: { in: subscribedIds } }] : []),
      ],
    },
    orderBy: { date_updated: { sort: "desc", nulls: "last" } },
    include: {
      feedback_replies: {
        orderBy: { created_at: "asc" },
      },
      user_feedback_files: {
        include: {
          files: {
            select: {
              id: true,
              filename_download: true,
              type: true,
              filesize: true,
            },
          },
        },
      },
      _count: { select: { feedback_replies: true } },
    },
  });

  // Get user info for reply authors
  const replyUserIds = new Set<string>();
  for (const f of feedback) {
    for (const r of f.feedback_replies) {
      replyUserIds.add(r.user_id);
    }
  }
  const users = replyUserIds.size > 0
    ? await db.users.findMany({
        where: { id: { in: [...replyUserIds] } },
        select: { id: true, name: true, email: true },
      })
    : [];
  const userMap = Object.fromEntries(users.map((u) => [u.id, u]));

  return {
    feedback: feedback.map((f) => ({
      ...f,
      feedback_replies: f.feedback_replies.map((r) => ({
        ...r,
        user: userMap[r.user_id] || { name: null, email: r.user_id },
      })),
    })),
  };
};
