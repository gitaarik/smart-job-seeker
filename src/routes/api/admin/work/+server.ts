import { json } from "@sveltejs/kit";
import type { RequestHandler } from "./$types";
import { isAdmin } from "$lib/auth.js";
import { prisma } from "$lib/db.js";

// GET - List all work experiences
export const GET: RequestHandler = async ({ locals, url }) => {
  try {
    if (!locals.user) {
      return json({ error: "Authentication required" }, { status: 401 });
    }

    if (!isAdmin(locals.user)) {
      return json({ error: "Admin access required" }, { status: 403 });
    }

    const include = url.searchParams.get('include');
    const includeRelations = include === 'all';

    const workExperiences = await prisma.workExperience.findMany({
      include: includeRelations ? {
        highlights: {
          include: {
            tags: true
          },
          orderBy: { sortOrder: 'asc' }
        },
        technologies: {
          orderBy: { sortOrder: 'asc' }
        },
        projects: {
          orderBy: { sortOrder: 'asc' }
        }
      } : undefined,
      orderBy: { sortOrder: 'asc' }
    });

    return json({ workExperiences });
  } catch (error) {
    console.error("Error fetching work experiences:", error);
    return json({ error: "Failed to fetch work experiences" }, { status: 500 });
  }
};

// POST - Create new work experience
export const POST: RequestHandler = async ({ request, locals }) => {
  try {
    if (!locals.user) {
      return json({ error: "Authentication required" }, { status: 401 });
    }

    if (!isAdmin(locals.user)) {
      return json({ error: "Admin access required" }, { status: 403 });
    }

    const data = await request.json();
    const {
      name,
      location,
      description,
      position,
      url,
      startDate,
      endDate,
      summary,
      logo,
      sortOrder,
      isActive = true
    } = data;

    if (!name || !location || !description || !position || !startDate || !summary) {
      return json({ error: "Missing required fields" }, { status: 400 });
    }

    const workExperience = await prisma.workExperience.create({
      data: {
        name,
        location,
        description,
        position,
        url,
        startDate,
        endDate,
        summary,
        logo,
        sortOrder: sortOrder || 0,
        isActive
      },
      include: {
        highlights: {
          include: { tags: true },
          orderBy: { sortOrder: 'asc' }
        },
        technologies: {
          orderBy: { sortOrder: 'asc' }
        },
        projects: {
          orderBy: { sortOrder: 'asc' }
        }
      }
    });

    return json({ workExperience }, { status: 201 });
  } catch (error) {
    console.error("Error creating work experience:", error);
    return json({ error: "Failed to create work experience" }, { status: 500 });
  }
};