import { json } from "@sveltejs/kit";
import type { RequestHandler } from "./$types";
import { isAdmin } from "$lib/auth.js";
import { prisma } from "$lib/db.js";

// PUT - Update highlight
export const PUT: RequestHandler = async ({ request, locals, params }) => {
  try {
    if (!locals.user) {
      return json({ error: "Authentication required" }, { status: 401 });
    }

    if (!isAdmin(locals.user)) {
      return json({ error: "Admin access required" }, { status: 403 });
    }

    const data = await request.json();
    const { title, description, iconName, sortOrder, tags } = data;

    // Update highlight
    const highlight = await prisma.workHighlight.update({
      where: { id: params.highlightId },
      data: {
        title,
        description,
        iconName,
        sortOrder
      }
    });

    // Update tags if provided
    if (tags) {
      // Delete existing tags
      await prisma.workHighlightTag.deleteMany({
        where: { highlightId: params.highlightId }
      });

      // Create new tags
      if (tags.length > 0) {
        await prisma.workHighlightTag.createMany({
          data: tags.map((tag: string) => ({
            highlightId: params.highlightId,
            tagName: tag
          }))
        });
      }
    }

    // Fetch updated highlight with tags
    const updatedHighlight = await prisma.workHighlight.findUnique({
      where: { id: params.highlightId },
      include: { tags: true }
    });

    return json({ highlight: updatedHighlight });
  } catch (error) {
    console.error("Error updating highlight:", error);
    return json({ error: "Failed to update highlight" }, { status: 500 });
  }
};

// DELETE - Delete highlight
export const DELETE: RequestHandler = async ({ locals, params }) => {
  try {
    if (!locals.user) {
      return json({ error: "Authentication required" }, { status: 401 });
    }

    if (!isAdmin(locals.user)) {
      return json({ error: "Admin access required" }, { status: 403 });
    }

    await prisma.workHighlight.delete({
      where: { id: params.highlightId }
    });

    return json({ message: "Highlight deleted successfully" });
  } catch (error) {
    console.error("Error deleting highlight:", error);
    return json({ error: "Failed to delete highlight" }, { status: 500 });
  }
};