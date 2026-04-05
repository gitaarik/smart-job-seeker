import type { Actions, PageServerLoad } from "./$types";
import { fail } from "@sveltejs/kit";
import { dbDirect as db } from "$lib/server/db";
import { deleteFileFromDirectus } from "$lib/server/directus/files";

export const load: PageServerLoad = async ({ url }) => {
  const statusFilter = url.searchParams.get("status") || "";
  const categoryFilter = url.searchParams.get("category") || "";

  const where: Record<string, unknown> = {};
  if (statusFilter) where.status = statusFilter;
  if (categoryFilter) where.category = categoryFilter;

  const feedback = await db.user_feedback.findMany({
    where,
    orderBy: { date_created: "desc" },
    include: {
      user_feedback_files: {
        include: {
          directus_files: {
            select: {
              id: true,
              filename_download: true,
              type: true,
              filesize: true,
            },
          },
        },
      },
    },
  });

  // Get user info for all feedback entries
  const userIds = [...new Set(feedback.map((f) => f.user_id))];
  const users = await db.users.findMany({
    where: { id: { in: userIds } },
    select: { id: true, name: true, email: true },
  });
  const userMap = Object.fromEntries(users.map((u) => [u.id, u]));

  const counts = {
    all: await db.user_feedback.count(),
    new: await db.user_feedback.count({ where: { status: "new" } }),
    reviewed: await db.user_feedback.count({ where: { status: "reviewed" } }),
    resolved: await db.user_feedback.count({ where: { status: "resolved" } }),
  };

  return {
    feedback: feedback.map((f) => ({
      ...f,
      user: userMap[f.user_id] || { name: null, email: f.user_id },
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

  delete: async ({ request }) => {
    const formData = await request.formData();
    const id = parseInt(formData.get("id") as string);
    if (isNaN(id)) return fail(400, { error: "Invalid request" });

    const entry = await db.user_feedback.findUnique({
      where: { id },
      include: { user_feedback_files: true },
    });
    if (!entry) return fail(404, { error: "Not found" });

    // Delete files from Directus
    for (const file of entry.user_feedback_files) {
      await deleteFileFromDirectus(file.directus_files_id).catch(() => {});
    }

    await db.user_feedback.delete({ where: { id } });
    return { success: true };
  },
};
