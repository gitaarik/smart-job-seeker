import type { Actions, PageServerLoad } from "./$types";
import { fail } from "@sveltejs/kit";
import { dbDirect as db } from "$lib/server/db";
import { eq, and, inArray, desc, asc, count } from "drizzle-orm";
import { user_feedback, user_feedback_files, user_feedback_subscribers, feedback_replies, users as usersTable } from "$lib/server/db/schema";
import { deleteFile } from "$lib/server/files";
import { createNotifications } from "$lib/server/notifications";

export const load: PageServerLoad = async ({ url }) => {
  const statusFilter = url.searchParams.get("status") || "";
  const categoryFilter = url.searchParams.get("category") || "";

  const conditions = [];
  if (statusFilter) conditions.push(eq(user_feedback.status, statusFilter));
  if (categoryFilter) conditions.push(eq(user_feedback.category, categoryFilter));
  const whereCondition = conditions.length > 0 ? and(...conditions) : undefined;

  const feedback = await db.query.user_feedback.findMany({
    where: whereCondition,
    orderBy: desc(user_feedback.date_created),
    with: {
      user_feedback_files: {
        with: {
          file: {
            columns: {
              id: true,
              filename_download: true,
              type: true,
              filesize: true,
            },
          },
        },
      },
      feedback_replies: {
        orderBy: asc(feedback_replies.created_at),
      },
      user_feedback_subscribers: {
        columns: { user_id: true },
      },
      user_feedbacks: {
        columns: { id: true, user_id: true },
      },
    },
  });

  // Get user info for all feedback entries + reply authors
  const userIds = new Set<string>();
  for (const f of feedback) {
    userIds.add(f.user_id);
    for (const r of f.feedback_replies) {
      userIds.add(r.user_id);
    }
    for (const m of f.user_feedbacks) {
      userIds.add(m.user_id);
    }
  }
  const users = await db.query.users.findMany({
    where: inArray(usersTable.id, [...userIds]),
    columns: { id: true, name: true, email: true },
  });
  const userMap = Object.fromEntries(users.map((u) => [u.id, u]));

  const [
    [{ allCount }],
    [{ newCount }],
    [{ reviewedCount }],
    [{ waitingCount }],
    [{ resolvedCount }],
  ] = await Promise.all([
    db.select({ allCount: count() }).from(user_feedback),
    db.select({ newCount: count() }).from(user_feedback).where(eq(user_feedback.status, "new")),
    db.select({ reviewedCount: count() }).from(user_feedback).where(eq(user_feedback.status, "reviewed")),
    db.select({ waitingCount: count() }).from(user_feedback).where(eq(user_feedback.status, "waiting")),
    db.select({ resolvedCount: count() }).from(user_feedback).where(eq(user_feedback.status, "resolved")),
  ]);

  const counts = {
    all: allCount,
    new: newCount,
    reviewed: reviewedCount,
    waiting: waitingCount,
    resolved: resolvedCount,
  };

  return {
    feedback: feedback.map((f) => ({
      ...f,
      user: userMap[f.user_id] || { name: null, email: f.user_id },
      feedback_replies: f.feedback_replies.map((r) => ({
        ...r,
        user: userMap[r.user_id] || { name: null, email: r.user_id },
      })),
    })),
    counts,
    statusFilter,
    categoryFilter,
  };
};

export const actions: Actions = {
  updateStatus: async ({ request }) => {
    const formData = await request.formData();
    const id = parseInt(formData.get("id") as string);
    const status = formData.get("status") as string;
    if (isNaN(id) || !status) return fail(400, { error: "Invalid request" });

    await db.update(user_feedback).set({ status, date_updated: new Date() }).where(eq(user_feedback.id, id));
    return { success: true };
  },

  addNote: async ({ request }) => {
    const formData = await request.formData();
    const id = parseInt(formData.get("id") as string);
    const note = (formData.get("note") as string) || null;
    if (isNaN(id)) return fail(400, { error: "Invalid request" });

    await db.update(user_feedback).set({ admin_note: note, date_updated: new Date() }).where(eq(user_feedback.id, id));
    return { success: true };
  },

  reply: async ({ request, locals }) => {
    const formData = await request.formData();
    const id = parseInt(formData.get("id") as string);
    const message = (formData.get("message") as string)?.trim();
    if (isNaN(id) || !message) return fail(400, { error: "Invalid request" });

    await db.insert(feedback_replies).values({
      feedback_id: id,
      user_id: locals.user!.id,
      is_admin: true,
      message,
    });

    // Auto-set status to reviewed if it was new
    const feedbackEntry = await db.query.user_feedback.findFirst({
      where: eq(user_feedback.id, id),
      with: { user_feedback_subscribers: { columns: { user_id: true } } },
    });
    const newStatus = feedbackEntry?.status === "new" ? "reviewed" : undefined;

    await db.update(user_feedback).set({
      date_updated: new Date(),
      ...(newStatus ? { status: newStatus } : {}),
    }).where(eq(user_feedback.id, id));

    // Notify ticket owner + subscribers
    if (feedbackEntry) {
      const recipientIds = new Set([feedbackEntry.user_id, ...feedbackEntry.user_feedback_subscribers.map((s) => s.user_id)]);
      // Don't notify the admin who replied
      recipientIds.delete(locals.user!.id);
      if (recipientIds.size > 0) {
        const preview = message.length > 80 ? message.slice(0, 80) + "..." : message;
        await createNotifications(
          [...recipientIds].map((userId) => ({
            userId,
            type: "feedback_reply",
            title: `Reply on feedback #${id}`,
            message: preview,
            link: "/dashboard/feedback",
          })),
        );
      }
    }

    return { success: true };
  },

  merge: async ({ request }) => {
    const formData = await request.formData();
    const sourceId = parseInt(formData.get("sourceId") as string);
    const targetId = parseInt(formData.get("targetId") as string);
    if (isNaN(sourceId) || isNaN(targetId)) return fail(400, { error: "Invalid request" });
    if (sourceId === targetId) return fail(400, { error: "Cannot merge a ticket into itself" });

    const [source, target] = await Promise.all([
      db.query.user_feedback.findFirst({
        where: eq(user_feedback.id, sourceId),
        with: { user_feedback_subscribers: true },
      }),
      db.query.user_feedback.findFirst({ where: eq(user_feedback.id, targetId) }),
    ]);
    if (!source) return fail(404, { error: "Source ticket not found" });
    if (!target) return fail(404, { error: "Target ticket not found" });
    if (target.merged_into_id) return fail(400, { error: "Target ticket is itself merged" });

    // Subscribe source ticket's owner to the target ticket
    await db.insert(user_feedback_subscribers)
      .values({ feedback_id: targetId, user_id: source.user_id })
      .onConflictDoNothing();

    // Move any existing subscribers from source to target
    for (const sub of source.user_feedback_subscribers) {
      await db.insert(user_feedback_subscribers)
        .values({ feedback_id: targetId, user_id: sub.user_id })
        .onConflictDoNothing();
    }

    // Mark source as merged
    await db.update(user_feedback).set({
      merged_into_id: targetId,
      status: "resolved",
      date_updated: new Date(),
    }).where(eq(user_feedback.id, sourceId));

    // Update target's timestamp
    await db.update(user_feedback).set({ date_updated: new Date() }).where(eq(user_feedback.id, targetId));

    return { success: true };
  },

  delete: async ({ request }) => {
    const formData = await request.formData();
    const id = parseInt(formData.get("id") as string);
    if (isNaN(id)) return fail(400, { error: "Invalid request" });

    const entry = await db.query.user_feedback.findFirst({
      where: eq(user_feedback.id, id),
      with: { user_feedback_files: true },
    });
    if (!entry) return fail(404, { error: "Not found" });

    // Delete files
    for (const file of entry.user_feedback_files) {
      await deleteFile(file.file_id).catch(() => {});
    }

    await db.delete(user_feedback).where(eq(user_feedback.id, id));
    return { success: true };
  },
};
