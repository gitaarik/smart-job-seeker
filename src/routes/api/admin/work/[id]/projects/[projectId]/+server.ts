import { json } from "@sveltejs/kit";
import type { RequestHandler } from "./$types";
import { isAdmin } from "$lib/auth.js";
import { prisma } from "$lib/db.js";

// PUT - Update project
export const PUT: RequestHandler = async ({ request, locals, params }) => {
  try {
    if (!locals.user) {
      return json({ error: "Authentication required" }, { status: 401 });
    }

    if (!isAdmin(locals.user)) {
      return json({ error: "Admin access required" }, { status: 403 });
    }

    const data = await request.json();
    const { name, startDate, endDate, summary, description, outcome, sortOrder } = data;

    const project = await prisma.workProject.update({
      where: { id: params.projectId },
      data: {
        name,
        startDate,
        endDate,
        summary,
        description,
        outcome,
        sortOrder
      }
    });

    return json({ project });
  } catch (error) {
    console.error("Error updating project:", error);
    return json({ error: "Failed to update project" }, { status: 500 });
  }
};

// DELETE - Delete project
export const DELETE: RequestHandler = async ({ locals, params }) => {
  try {
    if (!locals.user) {
      return json({ error: "Authentication required" }, { status: 401 });
    }

    if (!isAdmin(locals.user)) {
      return json({ error: "Admin access required" }, { status: 403 });
    }

    await prisma.workProject.delete({
      where: { id: params.projectId }
    });

    return json({ message: "Project deleted successfully" });
  } catch (error) {
    console.error("Error deleting project:", error);
    return json({ error: "Failed to delete project" }, { status: 500 });
  }
};