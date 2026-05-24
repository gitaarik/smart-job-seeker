import type { PageServerLoad } from "./$types";
import { dbDirect as db } from "$lib/server/db";
import { isNotNull, asc, inArray } from "drizzle-orm";
import { profiles as profilesTable, search_tasks, users as usersTable } from "$lib/server/db/schema";

export const load: PageServerLoad = async () => {
  // Pre-load search tasks with platform and user info. A task is runnable by
  // the scraper agent if it has a platform AND either its own search_url
  // (legacy) or a search_page_url on the platform (new search-form flow).
  const allTasks = await db.query.search_tasks.findMany({
    where: isNotNull(search_tasks.platform_id),
    orderBy: asc(search_tasks.id),
    columns: {
      id: true,
      note: true,
      search_url: true,
      browser_provider: true,
      profile_id: true,
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
          search_page_url: true,
        },
      },
    },
  });

  const searchTasks = allTasks.filter(
    (t) => t.search_url || t.job_platform?.search_page_url,
  );

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

  // Load all profiles for these users, not just the ones with eligible
  // search tasks — admins want to see every profile in the user's account
  // when filtering, even ones without tasks yet.
  const profiles = userIds.length > 0
    ? await db.query.profiles.findMany({
        where: inArray(profilesTable.user_id, userIds),
        columns: { id: true, name: true, user_id: true },
        orderBy: asc(profilesTable.id),
      })
    : [];

  return {
    searchTasks: searchTasks.map((t) => {
      const user = userMap.get(t.profile.user_id ?? "");
      return {
        id: t.id,
        note: t.note,
        profileId: t.profile_id,
        profileName: t.profile.name,
        platformName: t.job_platform?.name ?? null,
        browserProvider: t.browser_provider,
        userId: t.profile.user_id,
        userName: user?.name || user?.email || null,
      };
    }),
    profiles: profiles.map((p) => {
      const user = userMap.get(p.user_id ?? "");
      return {
        id: p.id,
        name: p.name ?? `Profile ${p.id}`,
        userId: p.user_id,
        userName: user?.name || user?.email || null,
      };
    }),
    users: users.map((u) => ({
      id: u.id,
      name: u.name || u.email,
    })),
  };
};
