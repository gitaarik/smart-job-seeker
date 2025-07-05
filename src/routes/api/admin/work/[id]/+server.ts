import { json } from "@sveltejs/kit";
import type { RequestHandler } from "./$types";
import { prisma } from "$lib/db.js";

// GET - Get specific work experience
export const GET: RequestHandler = async ({ params }) => {
  try {

    const workExperience = await prisma.workExperience.findUnique({
      where: { id: params.id },
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

    if (!workExperience) {
      return json({ error: "Work experience not found" }, { status: 404 });
    }

    return json({ workExperience });
  } catch (error) {
    console.error("Error fetching work experience:", error);
    return json({ error: "Failed to fetch work experience" }, { status: 500 });
  }
};

// PUT - Update work experience
export const PUT: RequestHandler = async ({ request, params }) => {
  try {

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
      isActive
    } = data;

    const workExperience = await prisma.workExperience.update({
      where: { id: params.id },
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
        sortOrder,
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

    return json({ workExperience });
  } catch (error) {
    console.error("Error updating work experience:", error);
    return json({ error: "Failed to update work experience" }, { status: 500 });
  }
};

// DELETE - Delete work experience
export const DELETE: RequestHandler = async ({ params }) => {
  try {

    await prisma.workExperience.delete({
      where: { id: params.id }
    });

    return json({ message: "Work experience deleted successfully" });
  } catch (error) {
    console.error("Error deleting work experience:", error);
    return json({ error: "Failed to delete work experience" }, { status: 500 });
  }
};