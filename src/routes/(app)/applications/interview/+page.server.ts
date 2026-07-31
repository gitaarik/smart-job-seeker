import type { PageServerLoad } from "./$types";
import { redirect } from "@sveltejs/kit";
import { dbDirect as db } from "$lib/server/db";
import { asc, eq } from "drizzle-orm";
import { cheat_sheets, project_stories } from "$lib/server/db/schema";

export const load: PageServerLoad = async ({ parent }) => {
  const layoutData = await parent();

  if (!layoutData.selectedProfile) {
    redirect(302, "/home");
  }

  const profileId = layoutData.selectedProfile.id;

  const [cheatsheets, stories] = await Promise.all([
    db.query.cheat_sheets.findMany({
      where: eq(cheat_sheets.profile_id, profileId),
      orderBy: asc(cheat_sheets.sort),
    }),
    db.query.project_stories.findMany({
      where: eq(project_stories.profile_id, profileId),
      orderBy: asc(project_stories.sort),
    }),
  ]);

  // Label for the assistant's "I can see this page" chip. The context itself is
  // resolved server-side from the route — see ai-chat/chat-context.ts.
  const chatContext = { label: "Interview prep" };

  return {
    cheatsheets,
    stories,
    profileId,
    chatContext,
  };
};
