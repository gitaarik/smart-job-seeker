import { error } from "@sveltejs/kit";
import type { RequestHandler } from "./$types";
import { prisma } from "$lib/db";
import { read } from '$app/server';
import path from "path";

const fileImports: Record<string, string> = import.meta.glob(
  "$lib/resumes/**/**.{pdf,docx}",
  {
    eager: true,
    import: "default",
    query: "?url",
  },
);

export const GET: RequestHandler = async ({ url, setHeaders }) => {
  const token = url.searchParams.get("t") || url.searchParams.get("token");

  if (!token) {
    throw error(400, "Token is required");
  }

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

  const resumeFilename = "Resume Rik Wanders.pdf";

  // Construct file path based on resume type
  const filePath: string = "/" + path.join(
    "src",
    "lib",
    "resumes",
    resumeToken.resumeType,
    resumeFilename,
  );

  console.log("filePath", filePath);
  console.log("fileImports", fileImports);

  if (!(filePath in fileImports)) {
    console.log(fileImports);
    throw error(
      404,
      "Resume file not found. Please contact the administrator.",
    );
  }

  const file = fileImports[filePath];
  return read(file);

};
