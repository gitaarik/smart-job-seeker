import type { PageServerLoad } from "./$types";
import { dbDirect as db } from "$lib/server/db";
import { and, isNotNull, asc, inArray } from "drizzle-orm";
import { search_tasks, users as usersTable } from "$lib/server/db/schema";

export const load: PageServerLoad = async () => {
  // Pre-load search tasks with platform and user info
  const searchTasks = await db.query.search_tasks.findMany({
    where: and(isNotNull(search_tasks.search_url), isNotNull(search_tasks.platform_id)),
    orderBy: asc(search_tasks.id),
    columns: {
      id: true,
      note: true,
      browser_provider: true,
    },
    with: {
      profile: {
        columns: {
          name: true,
          user_id: true,
        },
      },
      job_platform: {
        columns: {
          name: true,
        },
      },
    },
  });

  // Fetch users for the filter dropdown
  const userIds = [
    ...new Set(
      searchTasks
        .map((t) => t.profile.user_id)
        .filter(Boolean) as string[],
    ),
  ];
  const users =
    userIds.length > 0
      ? await db.query.users.findMany({
          where: inArray(usersTable.id, userIds),
          columns: { id: true, name: true, email: true },
        })
      : [];

  const userMap = new Map(users.map((u) => [u.id, u]));

  return {
    searchTasks: searchTasks.map((t) => {
      const user = userMap.get(t.profile.user_id ?? "");
      return {
        id: t.id,
        note: t.note,
        profileName: t.profile.name,
        platformName: t.job_platform?.name ?? null,
        browserProvider: t.browser_provider,
        userId: t.profile.user_id,
        userName: user?.name || user?.email || null,
      };
    }),
    users: users.map((u) => ({
      id: u.id,
      name: u.name || u.email,
    })),
  };
};
