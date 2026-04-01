import type { PageServerLoad } from "./$types";
import { dbDirect as db } from "$lib/server/db";

export const load: PageServerLoad = async ({ parent, url }) => {
  await parent();

  const page = parseInt(url.searchParams.get("page") || "1");
  const perPage = 25;
  const requestType = url.searchParams.get("type") || "";

  const where: Record<string, unknown> = {};
  if (requestType) {
    where.request_type = requestType;
  }

  const [chats, total, requestTypes] = await Promise.all([
    // Only fetch lightweight columns for the list view — full content loaded on-demand
    db.ai_chats.findMany({
      where,
      orderBy: { id: "desc" },
      skip: (page - 1) * perPage,
      take: perPage,
      select: {
        id: true,
        date_created: true,
        profile: true,
        followup_to: true,
        error: true,
        provider: true,
        model: true,
        request_type: true,
        profiles: {
          select: {
            id: true,
            name: true,
          },
        },
      },
    }),
    db.ai_chats.count({ where }),
    db.ai_chats.groupBy({
      by: ["request_type"],
      _count: { id: true },
      orderBy: { _count: { id: "desc" } },
    }),
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
      .map((r) => ({ type: r.request_type!, count: r._count.id })),
  };
};
