import { json } from "@sveltejs/kit";
import type { RequestHandler } from "./$types";
import { prisma } from "$lib/db.js";

// GET - List highlights for work experience
export const GET: RequestHandler = async ({ params }) => {
  try {

    const highlights = await prisma.workHighlight.findMany({
      where: { workExperienceId: params.id },
      include: { tags: true },
      orderBy: { sortOrder: 'asc' }
    });

    return json({ highlights });
  } catch (error) {
    console.error("Error fetching highlights:", error);
    return json({ error: "Failed to fetch highlights" }, { status: 500 });
  }
};

// POST - Create new highlight
export const POST: RequestHandler = async ({ request, params }) => {
  try {

    const data = await request.json();
    const { title, description, iconName, sortOrder, tags } = data;

    if (!description) {
      return json({ error: "Description is required" }, { status: 400 });
    }

    const highlight = await prisma.workHighlight.create({
      data: {
        workExperienceId: params.id,
        title,
        description,
        iconName,
        sortOrder: sortOrder || 0
      }
    });

    // Create tags if provided
    if (tags && tags.length > 0) {
      await prisma.workHighlightTag.createMany({
        data: tags.map((tag: string) => ({
          highlightId: highlight.id,
          tagName: tag
        }))
      });
    }

    // Fetch the created highlight with tags
    const createdHighlight = await prisma.workHighlight.findUnique({
      where: { id: highlight.id },
      include: { tags: true }
    });

    return json({ highlight: createdHighlight }, { status: 201 });
  } catch (error) {
    console.error("Error creating highlight:", error);
    return json({ error: "Failed to create highlight" }, { status: 500 });
  }
};