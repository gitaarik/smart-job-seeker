import { json, type RequestHandler } from "@sveltejs/kit";
import { dbDirect as db } from "$lib/server/db";
import { requireAuth } from "$lib/server/utils/api-helpers";
import {
  cheatSheetCreateSchema,
  cheatSheetUpdateSchema,
  cheatSheetDeleteSchema,
  parseBody,
} from "$lib/server/validation/api-schemas";

export const POST: RequestHandler = async ({ request, locals }) => {
  const user = requireAuth(locals);

  const { profile_id, title, content } =
    parseBody(cheatSheetCreateSchema, await request.json());

  const profile = await db.profiles.findFirst({
    where: { id: profile_id, user_id: user.id },
  });

  if (!profile) {
    return json({ error: "Profile not found" }, { status: 404 });
  }

  const lastItem = await db.cheat_sheets.findFirst({
    where: { profile: profile_id },
    orderBy: { sort: "desc" },
  });

  const sheet = await db.cheat_sheets.create({
    data: {
      title: title.trim(),
      content: content?.trim() || null,
      profile: profile_id,
      sort: (lastItem?.sort ?? -1) + 1,
      date_created: new Date(),
    },
  });

  return json({ success: true, sheet });
};

export const PUT: RequestHandler = async ({ request, locals }) => {
  const user = requireAuth(locals);

  const { profile_id, id, title, content } =
    parseBody(cheatSheetUpdateSchema, await request.json());

  const profile = await db.profiles.findFirst({
    where: { id: profile_id, user_id: user.id },
  });

  if (!profile) {
    return json({ error: "Profile not found" }, { status: 404 });
  }

  const existing = await db.cheat_sheets.findFirst({
    where: { id, profile: profile_id },
  });

  if (!existing) {
    return json({ error: "Cheat sheet not found" }, { status: 404 });
  }

  const sheet = await db.cheat_sheets.update({
    where: { id },
    data: {
      title: title.trim(),
      content: content?.trim() || null,
      date_updated: new Date(),
    },
  });

  return json({ success: true, sheet });
};

export const DELETE: RequestHandler = async ({ request, locals }) => {
  const user = requireAuth(locals);

  const { profile_id, id } = parseBody(cheatSheetDeleteSchema, await request.json());

  const profile = await db.profiles.findFirst({
    where: { id: profile_id, user_id: user.id },
  });

  if (!profile) {
    return json({ error: "Profile not found" }, { status: 404 });
  }

  const existing = await db.cheat_sheets.findFirst({
    where: { id, profile: profile_id },
  });

  if (!existing) {
    return json({ error: "Cheat sheet not found" }, { status: 404 });
  }

  await db.cheat_sheets.delete({
    where: { id },
  });

  return json({ success: true });
};
