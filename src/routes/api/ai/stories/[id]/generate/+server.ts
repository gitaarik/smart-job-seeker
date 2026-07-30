import { json } from "@sveltejs/kit";
import type { RequestHandler } from "./$types";
import { dbDirect as db } from "$lib/server/db";
import { eq } from "drizzle-orm";
import { profiles, project_stories } from "$lib/server/db/schema";
import { parseIntParam, requireAuth } from "$lib/server/utils/api-helpers";
import {
  parseBody,
  storyGenerateSchema,
} from "$lib/server/validation/api-schemas";
import { generateProfileStory } from "$lib/server/ai-chat/profile-story";
import { requireCredits } from "$lib/server/billing/require-credits";

export const POST: RequestHandler = async ({ params, request, locals }) => {
  const user = requireAuth(locals);
  const storyId = parseIntParam(params.id, "story");

  // Verify ownership: story -> profile -> user.
  const story = await db.query.project_stories.findFirst({
    where: eq(project_stories.id, storyId),
    columns: { id: true, profile_id: true },
  });
  const profile = story
    ? await db.query.profiles.findFirst({
      where: eq(profiles.id, story.profile_id),
      columns: { user_id: true },
    })
    : null;
  if (!story || profile?.user_id !== user.id) {
    return json({ success: false, message: "Story not found" }, {
      status: 404,
    });
  }

  const { mode, instructions } = parseBody(
    storyGenerateSchema,
    await request.json().catch(() => ({})),
  );

  await requireCredits(user.id, 5);

  const result = await generateProfileStory(storyId, { mode, instructions });
  if (!result.success) return json(result, { status: 422 });
  return json(result);
};
