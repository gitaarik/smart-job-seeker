import type { PageServerLoad } from "./$types";
import { redirect } from "@sveltejs/kit";
import { dbDirect as db } from "$lib/server/db";

export const load: PageServerLoad = async ({ parent }) => {
  const layoutData = await parent();

  if (!layoutData.selectedProfile) {
    redirect(302, "/dashboard");
  }

  const profileId = layoutData.selectedProfile.id;

  const [cheatsheets, stories] = await Promise.all([
    db.cheat_sheets.findMany({
      where: { profile_id: profileId },
      orderBy: { sort: "asc" },
    }),
    db.project_stories.findMany({
      where: { profile_id: profileId },
      orderBy: { sort: "asc" },
    }),
  ]);

  return {
    cheatsheets,
    stories,
    profileId,
  };
};
