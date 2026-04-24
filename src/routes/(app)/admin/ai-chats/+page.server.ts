import type { PageServerLoad } from "./$types";
import { dbDirect as db } from "$lib/server/db";
import { eq, desc, count } from "drizzle-orm";
import { ai_chats } from "$lib/server/db/schema";

export const load: PageServerLoad = async ({ parent, url }) => {
  await parent();

  const page = parseInt(url.searchParams.get("page") || "1");
  const perPage = 25;
  const requestType = url.searchParams.get("type") || "";

  const whereCondition = requestType ? eq(ai_chats.request_type, requestType) : undefined;

  const [chats, [{ total }], requestTypes] = await Promise.all([
    // Only fetch lightweight columns for the list view — full content loaded on-demand
    db.query.ai_chats.findMany({
      where: whereCondition,
      orderBy: desc(ai_chats.id),
      offset: (page - 1) * perPage,
      limit: perPage,
      columns: {
        id: true,
        date_created: true,
        profile_id: true,
        followup_to: true,
        error: true,
        provider: true,
        model: true,
        request_type: true,
      },
      with: {
        profile: {
          columns: {
            id: true,
            name: true,
          },
        },
      },
    }),
    db.select({ total: count() }).from(ai_chats).where(whereCondition),
    db.select({ request_type: ai_chats.request_type, count: count() })
      .from(ai_chats)
      .groupBy(ai_chats.request_type)
      .orderBy(desc(count())),
  ]);

  return {
    chats,
    total,
    page,
    perPage,
    totalPages: Math.ceil(total / perPage),
    requestType,
    requestTypes: requestTypes
      .filter((r) => r.request_type)
      .map((r) => ({ type: r.request_type!, count: r.count })),
  };
};
