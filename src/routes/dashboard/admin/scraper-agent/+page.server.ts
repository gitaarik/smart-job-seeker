import type { PageServerLoad } from "./$types";
import { dbDirect as db } from "$lib/server/db";

export const load: PageServerLoad = async () => {
  // Pre-load search tasks with platform and user info
  const searchTasks = await db.search_tasks.findMany({
    where: {
      search_url: { not: null },
      platform: { not: null },
    },
    orderBy: { id: "asc" },
    select: {
      id: true,
      note: true,
      browser_provider: true,
      profiles: {
        select: {
          name: true,
          user_id: true,
        },
      },
      job_platforms: {
        select: {
          name: true,
        },
      },
    },
  });

  // Fetch users for the filter dropdown
  const userIds = [
    ...new Set(
      searchTasks
        .map((t) => t.profiles.user_id)
        .filter(Boolean) as string[],
    ),
  ];
  const users =
    userIds.length > 0
      ? await db.users.findMany({
          where: { id: { in: userIds } },
          select: { id: true, name: true, email: true },
        })
      : [];

  const userMap = new Map(users.map((u) => [u.id, u]));

  return {
    searchTasks: searchTasks.map((t) => {
      const user = userMap.get(t.profiles.user_id ?? "");
      return {
        id: t.id,
        note: t.note,
        profileName: t.profiles.name,
        platformName: t.job_platforms?.name ?? null,
        browserProvider: t.browser_provider,
        userId: t.profiles.user_id,
        userName: user?.name || user?.email || null,
      };
    }),
    users: users.map((u) => ({
      id: u.id,
      name: u.name || u.email,
    })),
  };
};
