import type { Actions, PageServerLoad } from "./$types";
import { fail } from "@sveltejs/kit";
import { dbDirect as db } from "$lib/server/db";
import { deleteFile } from "$lib/server/files";
import { createNotifications } from "$lib/server/notifications";

export const load: PageServerLoad = async ({ url }) => {
  const statusFilter = url.searchParams.get("status") || "";
  const categoryFilter = url.searchParams.get("category") || "";

  const where: Record<string, unknown> = {};
  if (statusFilter) where.status = statusFilter;
  if (categoryFilter) where.category = categoryFilter;

  const feedback = await db.query.user_feedback.findMany({
    where,
    orderBy: { date_created: "desc" },
    with: {
      user_feedback_files: {
        with: {
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
      feedback_replies: {
        orderBy: { created_at: "asc" },
      },
      subscribers: {
        select: { user_id: true },
      },
      merged_from: {
        select: { id: true, user_id: true },
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
    for (const m of f.merged_from) {
      userIds.add(m.user_id);
    }
  }
  const users = await db.query.users.findMany({
    where: { id: { in: [...userIds] } },
    select: { id: true, name: true, email: true },
  });
  const userMap = Object.fromEntries(users.map((u) => [u.id, u]));

  const counts = {
    all: await db.user_feedback.count(),
    new: await db.user_feedback.count({ where: { status: "new" } }),
    reviewed: await db.user_feedback.count({ where: { status: "reviewed" } }),
    waiting: await db.user_feedback.count({ where: { status: "waiting" } }),
    resolved: await db.user_feedback.count({ where: { status: "resolved" } }),
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

    await db.user_feedback.update({
      where: { id },
      data: { status, date_updated: new Date() },
    });
    return { success: true };
  },

  addNote: async ({ request }) => {
    const formData = await request.formData();
    const id = parseInt(formData.get("id") as string);
    const note = (formData.get("note") as string) || null;
    if (isNaN(id)) return fail(400, { error: "Invalid request" });

    await db.user_feedback.update({
      where: { id },
      data: { admin_note: note, date_updated: new Date() },
    });
    return { success: true };
  },

  reply: async ({ request, locals }) => {
    const formData = await request.formData();
    const id = parseInt(formData.get("id") as string);
    const message = (formData.get("message") as string)?.trim();
    if (isNaN(id) || !message) return fail(400, { error: "Invalid request" });

    await db.feedback_replies.create({
      data: {
        feedback_id: id,
        user_id: locals.user!.id,
        is_admin: true,
        message,
      },
    });

    // Auto-set status to reviewed if it was new
    const feedback = await db.query.user_feedback.findFirst({
      where: { id },
      with: { subscribers: { select: { user_id: true } } },
    });
    const newStatus = feedback?.status === "new" ? "reviewed" : undefined;

    await db.user_feedback.update({
      where: { id },
      data: {
        date_updated: new Date(),
        ...(newStatus ? { status: newStatus } : {}),
      },
    });

    // Notify ticket owner + subscribers
    if (feedback) {
      const recipientIds = new Set([feedback.user_id, ...feedback.subscribers.map((s) => s.user_id)]);
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
        where: { id: sourceId },
        with: { subscribers: true },
      }),
      db.query.user_feedback.findFirst({ where: { id: targetId } }),
    ]);
    if (!source) return fail(404, { error: "Source ticket not found" });
    if (!target) return fail(404, { error: "Target ticket not found" });
    if (target.merged_into_id) return fail(400, { error: "Target ticket is itself merged" });

    // Subscribe source ticket's owner to the target ticket
    await db.user_feedback_subscribers.upsert({
      where: {
        feedback_id_user_id: { feedback_id: targetId, user_id: source.user_id },
      },
      create: { feedback_id: targetId, user_id: source.user_id },
      update: {},
    });

    // Move any existing subscribers from source to target
    for (const sub of source.subscribers) {
      await db.user_feedback_subscribers.upsert({
        where: {
          feedback_id_user_id: { feedback_id: targetId, user_id: sub.user_id },
        },
        create: { feedback_id: targetId, user_id: sub.user_id },
        update: {},
      });
    }

    // Mark source as merged
    await db.user_feedback.update({
      where: { id: sourceId },
      data: {
        merged_into_id: targetId,
        status: "resolved",
        date_updated: new Date(),
      },
    });

    // Update target's timestamp
    await db.user_feedback.update({
      where: { id: targetId },
      data: { date_updated: new Date() },
    });

    return { success: true };
  },

  delete: async ({ request }) => {
    const formData = await request.formData();
    const id = parseInt(formData.get("id") as string);
    if (isNaN(id)) return fail(400, { error: "Invalid request" });

    const entry = await db.query.user_feedback.findFirst({
      where: { id },
      with: { user_feedback_files: true },
    });
    if (!entry) return fail(404, { error: "Not found" });

    // Delete files
    for (const file of entry.user_feedback_files) {
      await deleteFile(file.file_id).catch(() => {});
    }

    await db.user_feedback.delete({ where: { id } });
    return { success: true };
  },
};
