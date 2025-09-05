import { json } from "@sveltejs/kit";
import type { RequestHandler } from "./$types";
import { isAdmin } from "$lib/auth.js";
import { prisma } from "$lib/db.js";

// GET - List technologies for work experience
export const GET: RequestHandler = async ({ locals, params }) => {
  try {
    if (!locals.user) {
      return json({ error: "Authentication required" }, { status: 401 });
    }

    if (!isAdmin(locals.user)) {
      return json({ error: "Admin access required" }, { status: 403 });
    }

    const technologies = await prisma.workTechnology.findMany({
      where: { workExperienceId: params.id },
      orderBy: { sortOrder: 'asc' }
    });

    return json({ technologies });
  } catch (error) {
    console.error("Error fetching technologies:", error);
    return json({ error: "Failed to fetch technologies" }, { status: 500 });
  }
};

// POST - Create new technology
export const POST: RequestHandler = async ({ request, locals, params }) => {
  try {
    if (!locals.user) {
      return json({ error: "Authentication required" }, { status: 401 });
    }

    if (!isAdmin(locals.user)) {
      return json({ error: "Admin access required" }, { status: 403 });
    }

    const data = await request.json();
    const { technologyName, sortOrder } = data;

    if (!technologyName) {
      return json({ error: "Technology name is required" }, { status: 400 });
    }

    const technology = await prisma.workTechnology.create({
      data: {
        workExperienceId: params.id,
        technologyName,
        sortOrder: sortOrder || 0
      }
    });

    return json({ technology }, { status: 201 });
  } catch (error) {
    console.error("Error creating technology:", error);
    return json({ error: "Failed to create technology" }, { status: 500 });
  }
};

// PUT - Update all technologies (bulk update for reordering)
export const PUT: RequestHandler = async ({ request, locals, params }) => {
  try {
    if (!locals.user) {
      return json({ error: "Authentication required" }, { status: 401 });
    }

    if (!isAdmin(locals.user)) {
      return json({ error: "Admin access required" }, { status: 403 });
    }

    const data = await request.json();
    const { technologies } = data;

    if (!Array.isArray(technologies)) {
      return json({ error: "Technologies must be an array" }, { status: 400 });
    }

    // Delete all existing technologies for this work experience
    await prisma.workTechnology.deleteMany({
      where: { workExperienceId: params.id }
    });

    // Create new technologies
    if (technologies.length > 0) {
      await prisma.workTechnology.createMany({
        data: technologies.map((tech: string, index: number) => ({
          workExperienceId: params.id,
          technologyName: tech,
          sortOrder: index
        }))
      });
    }

    // Fetch updated technologies
    const updatedTechnologies = await prisma.workTechnology.findMany({
      where: { workExperienceId: params.id },
      orderBy: { sortOrder: 'asc' }
    });

    return json({ technologies: updatedTechnologies });
  } catch (error) {
    console.error("Error updating technologies:", error);
    return json({ error: "Failed to update technologies" }, { status: 500 });
  }
};