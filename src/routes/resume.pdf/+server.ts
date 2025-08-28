import { error } from "@sveltejs/kit";
import type { RequestHandler } from "./$types";
import { prisma } from "$lib/db";
import fs from "fs";
import path from "path";

export const GET: RequestHandler = async ({ url, setHeaders }) => {
  const token = url.searchParams.get("token");

  if (!token) {
    throw error(400, "Token is required");
  }

  try {
    // Find and validate the token
    const resumeToken = await prisma.resumeToken.findUnique({
      where: { token },
      include: { creator: true },
    });

    if (!resumeToken) {
      throw error(404, "Invalid token");
    }

    if (!resumeToken.isActive) {
      throw error(403, "Token is disabled");
    }

    // Check if token has expired
    if (resumeToken.expiresAt && new Date() > resumeToken.expiresAt) {
      throw error(403, "Token has expired");
    }

    // Check if max views limit has been reached
    if (resumeToken.maxViews && resumeToken.viewCount >= resumeToken.maxViews) {
      throw error(403, "Token view limit has been reached");
    }

    // Increment view count
    await prisma.resumeToken.update({
      where: { id: resumeToken.id },
      data: { viewCount: { increment: 1 } },
    });

    // Construct file path based on resume type
    const filePath: string = path.join(
      process.cwd(),
      "src",
      "lib",
      "resumes",
      resumeToken.resumeType,
      "Resume Rik Wanders.pdf",
    );

    // Check if file exists
    if (!fs.existsSync(filePath)) {
      throw error(
        404,
        "Resume file not found. Please contact the administrator.",
      );
    }

    // Read the PDF file
    const pdfBuffer = fs.readFileSync(filePath);

    // Set appropriate headers for PDF
    setHeaders({
      "Content-Type": "application/pdf",
      "Content-Disposition": `inline; filename="Resume Rik Wanders.pdf"`,
      "Cache-Control": "no-cache, no-store, must-revalidate",
      "Pragma": "no-cache",
      "Expires": "0",
    });

    return new Response(pdfBuffer);
  } catch (err) {
    console.error("Error serving resume PDF:", err);
    if (err instanceof Error && "status" in err) {
      throw err;
    }
    throw error(500, "Internal server error");
  }
};

