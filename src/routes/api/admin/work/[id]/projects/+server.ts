import { json } from "@sveltejs/kit";
import type { RequestHandler } from "./$types";
import { isAdmin } from "$lib/auth.js";
import { prisma } from "$lib/db.js";

// GET - List projects for work experience
export const GET: RequestHandler = async ({ locals, params }) => {
  try {
    if (!locals.user) {
      return json({ error: "Authentication required" }, { status: 401 });
    }

    if (!isAdmin(locals.user)) {
      return json({ error: "Admin access required" }, { status: 403 });
    }

    const projects = await prisma.workProject.findMany({
      where: { workExperienceId: params.id },
      orderBy: { sortOrder: 'asc' }
    });

    return json({ projects });
  } catch (error) {
    console.error("Error fetching projects:", error);
    return json({ error: "Failed to fetch projects" }, { status: 500 });
  }
};

// POST - Create new project
export const POST: RequestHandler = async ({ request, locals, params }) => {
  try {
    if (!locals.user) {
      return json({ error: "Authentication required" }, { status: 401 });
    }

    if (!isAdmin(locals.user)) {
      return json({ error: "Admin access required" }, { status: 403 });
    }

    const data = await request.json();
    const { name, startDate, endDate, summary, description, outcome, sortOrder } = data;

    if (!name || !startDate || !endDate || !summary || !description || !outcome) {
      return json({ error: "All project fields are required" }, { status: 400 });
    }

    const project = await prisma.workProject.create({
      data: {
        workExperienceId: params.id,
        name,
        startDate,
        endDate,
        summary,
        description,
        outcome,
        sortOrder: sortOrder || 0
      }
    });

    return json({ project }, { status: 201 });
  } catch (error) {
    console.error("Error creating project:", error);
    return json({ error: "Failed to create project" }, { status: 500 });
  }
};