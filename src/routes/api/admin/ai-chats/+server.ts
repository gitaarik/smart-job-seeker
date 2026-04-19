import { json } from "@sveltejs/kit";
import type { RequestHandler } from "./$types";
import { dbDirect as db } from "$lib/server/db";
import { eq } from "drizzle-orm";
import { ai_chats } from "$lib/server/db/schema";

export const GET: RequestHandler = async ({ url, locals }) => {
  if (!locals.user?.is_admin) {
    return json({ error: "Admin access required" }, { status: 403 });
  }

  const id = parseInt(url.searchParams.get("id") || "");
  if (isNaN(id)) {
    return json({ error: "Invalid ID" }, { status: 400 });
  }

  const chat = await db.query.ai_chats.findFirst({
    where: eq(ai_chats.id, id),
    columns: {
      id: true,
      date_created: true,
      profile_id: true,
      system_prompt: true,
      user_prompt: true,
      full_prompt: true,
      response: true,
      context: true,
      followup_to: true,
      error: true,
      provider: true,
      model: true,
      request_type: true,
    },
    with: {
      ai_chat_template: true,
    },
  });

  if (!chat) {
    return json({ error: "Not found" }, { status: 404 });
  }

  return json(chat);
};
