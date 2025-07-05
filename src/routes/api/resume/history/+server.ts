import { json } from "@sveltejs/kit";
import type { RequestHandler } from "./$types";
import { isAdmin } from "$lib/auth.js";
import { prisma } from "$lib/db.js";

export const GET: RequestHandler = async ({ locals, url }) => {
  try {
    // Check if user is authenticated and has admin permissions
    if (!locals.user) {
      return json({ error: "Authentication required" }, { status: 401 });
    }

    if (!isAdmin(locals.user)) {
      return json({ error: "Admin access required" }, { status: 403 });
    }

    const limit = parseInt(url.searchParams.get('limit') || '50');
    const offset = parseInt(url.searchParams.get('offset') || '0');

    const responses = await prisma.aiResponse.findMany({
      where: {
        userId: locals.user.id,
      },
      include: {
        refinements: {
          orderBy: {
            createdAt: 'asc'
          }
        }
      },
      orderBy: {
        createdAt: 'desc'
      },
      take: limit,
      skip: offset,
    });

    const total = await prisma.aiResponse.count({
      where: {
        userId: locals.user.id,
      },
    });

    return json({
      responses,
      total,
      limit,
      offset,
      hasMore: offset + limit < total
    });

  } catch (error: any) {
    console.error("History fetch error:", error);
    return json({ error: "Failed to fetch history" }, { status: 500 });
  }
};