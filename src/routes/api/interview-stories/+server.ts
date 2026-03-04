import { json, type RequestHandler } from "@sveltejs/kit";
import { dbDirect as db } from "$lib/server/db";
import { requireAuth } from "$lib/server/utils/api-helpers";

export const POST: RequestHandler = async ({ request, locals }) => {
  const user = requireAuth(locals);

  const body = await request.json();
  const { profile_id, title, category, situation, task, action, result, reflection } = body;

  if (!profile_id) {
    return json({ error: "No profile specified" }, { status: 400 });
  }

  // Verify the profile belongs to this user
  const profile = await db.profiles.findFirst({
    where: { id: profile_id, user_id: user.id },
  });

  if (!profile) {
    return json({ error: "Profile not found" }, { status: 404 });
  }

  if (!title || title.trim().length === 0) {
    return json({ error: "Title is required" }, { status: 400 });
  }

  // Get the highest sort value
  const lastItem = await db.project_stories.findFirst({
    where: { profile: profile_id },
    orderBy: { sort: "desc" },
  });

  const story = await db.project_stories.create({
    data: {
      title: title.trim(),
      category: category?.trim() || null,
      situation: situation?.trim() || null,
      task: task?.trim() || null,
      action: action?.trim() || null,
      result: result?.trim() || null,
      reflection: reflection?.trim() || null,
      profile: profile_id,
      sort: (lastItem?.sort ?? -1) + 1,
      date_created: new Date(),
    },
  });

  return json({ success: true, story });
};

export const PUT: RequestHandler = async ({ request, locals }) => {
  const user = requireAuth(locals);

  const body = await request.json();
  const { profile_id, id, title, category, situation, task, action, result, reflection } = body;

  if (!profile_id) {
    return json({ error: "No profile specified" }, { status: 400 });
  }

  if (!id) {
    return json({ error: "Story ID is required" }, { status: 400 });
  }

  // Verify the profile belongs to this user
  const profile = await db.profiles.findFirst({
    where: { id: profile_id, user_id: user.id },
  });

  if (!profile) {
    return json({ error: "Profile not found" }, { status: 404 });
  }

  if (!title || title.trim().length === 0) {
    return json({ error: "Title is required" }, { status: 400 });
  }

  // Verify the story belongs to this profile
  const existing = await db.project_stories.findFirst({
    where: { id, profile: profile_id },
  });

  if (!existing) {
    return json({ error: "Story not found" }, { status: 404 });
  }

  const story = await db.project_stories.update({
    where: { id },
    data: {
      title: title.trim(),
      category: category?.trim() || null,
      situation: situation?.trim() || null,
      task: task?.trim() || null,
      action: action?.trim() || null,
      result: result?.trim() || null,
      reflection: reflection?.trim() || null,
      date_updated: new Date(),
    },
  });

  return json({ success: true, story });
};

export const DELETE: RequestHandler = async ({ request, locals }) => {
  const user = requireAuth(locals);

  const body = await request.json();
  const { profile_id, id } = body;

  if (!profile_id) {
    return json({ error: "No profile specified" }, { status: 400 });
  }

  if (!id) {
    return json({ error: "Story ID is required" }, { status: 400 });
  }

  // Verify the profile belongs to this user
  const profile = await db.profiles.findFirst({
    where: { id: profile_id, user_id: user.id },
  });

  if (!profile) {
    return json({ error: "Profile not found" }, { status: 404 });
  }

  // Verify the story belongs to this profile
  const existing = await db.project_stories.findFirst({
    where: { id, profile: profile_id },
  });

  if (!existing) {
    return json({ error: "Story not found" }, { status: 404 });
  }

  await db.project_stories.delete({
    where: { id },
  });

  return json({ success: true });
};
