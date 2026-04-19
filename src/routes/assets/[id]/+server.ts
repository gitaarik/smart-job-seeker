import { error } from "@sveltejs/kit";
import { readFile } from "fs/promises";
import { join } from "path";
import { dbDirect as db } from "$lib/server/db";
import { eq } from "drizzle-orm";
import { files } from "$lib/server/db/schema";
import type { RequestHandler } from "./$types";

const UPLOADS_DIR = join(process.cwd(), "uploads", "files");

export const GET: RequestHandler = async ({ params }) => {
  const file = await db.query.files.findFirst({
    where: eq(files.id, params.id),
    columns: { filename_disk: true, type: true, filename_download: true },
  });

  if (!file?.filename_disk) throw error(404);

  let buffer: Buffer;
  try {
    buffer = await readFile(join(UPLOADS_DIR, file.filename_disk));
  } catch {
    throw error(404);
  }

  return new Response(buffer, {
    headers: {
      "Content-Type": file.type || "application/octet-stream",
      "Cache-Control": "public, max-age=31536000, immutable",
    },
  });
};
