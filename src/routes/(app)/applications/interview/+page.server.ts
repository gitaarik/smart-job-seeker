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

  // Snapshot for the personal AI assistant — the user's STAR stories and
  // cheat sheets, so they can ask it to sharpen a specific story or note.
  const chatContext = {
    label: "Interview prep",
    data: {
      stories: stories.map((s) => ({
        title: s.title,
        category: s.category,
        situation: s.situation,
        task: s.task,
        action: s.action,
        result: s.result,
        reflection: s.reflection,
      })),
      cheatsheets: cheatsheets.map((c) => ({
        title: c.title,
        content: c.content,
      })),
    },
  };

  return {
    cheatsheets,
    stories,
    profileId,
    chatContext,
  };
};
