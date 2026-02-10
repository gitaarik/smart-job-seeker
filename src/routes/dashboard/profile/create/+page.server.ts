import type { Actions, PageServerLoad } from "./$types";
import { fail, redirect } from "@sveltejs/kit";
import { dbDirect as db } from "$lib/server/db";
import {
  deleteFileFromDirectus,
  uploadFileToDirectus,
} from "$lib/server/directus/files";
import {
  createProfileFromResume,
  extractTextFromFile,
  getFormatName,
  isSupportedMimeType,
  parseResumeWithLLM,
  type ResumeData,
} from "$lib/server/resume";

export const load: PageServerLoad = async ({ parent }) => {
  await parent();
  return {};
};

export const actions: Actions = {
  /**
   * Upload CV/resume and parse with LLM
   */
  upload: async ({ request, locals }) => {
    const user = locals.user;
    if (!user) {
      return fail(401, { error: "Not authenticated" });
    }

    const formData = await request.formData();
    const file = formData.get("file") as File | null;

    if (!file || file.size === 0) {
      return fail(400, { error: "Please select a file to upload" });
    }

    // Validate file size (10MB max)
    const MAX_SIZE = 10 * 1024 * 1024;
    if (file.size > MAX_SIZE) {
      return fail(400, { error: "File is too large. Maximum size is 10MB." });
    }

    // Validate file type
    if (!isSupportedMimeType(file.type)) {
      return fail(400, {
        error:
          `Unsupported file type: ${file.type}. Please upload a PDF, DOCX, or HTML file.`,
      });
    }

    let fileId: string | undefined;

    try {
      // Read file into buffer
      const arrayBuffer = await file.arrayBuffer();
      const buffer = Buffer.from(arrayBuffer);

      // Upload to Directus
      const uploadResult = await uploadFileToDirectus({
        filename: file.name,
        buffer,
        title: `CV Upload - ${user.email || user.id}`,
        description: "CV/Resume uploaded during profile creation",
      });
      fileId = uploadResult.id;

      // Extract text from file
      const text = await extractTextFromFile(buffer, file.type);

      // Parse with LLM
      const parsedData = await parseResumeWithLLM(text);

      return {
        success: true,
        parsedData,
        fileId,
        fileName: file.name,
        fileFormat: getFormatName(file.type),
      };
    } catch (error) {
      // Clean up uploaded file if parsing failed
      if (fileId) {
        try {
          await deleteFileFromDirectus(fileId);
        } catch {
          // Ignore cleanup errors
        }
      }

      const message = error instanceof Error
        ? error.message
        : "Failed to parse resume";
      return fail(400, { error: message });
    }
  },

  /**
   * Create profile from parsed resume data
   */
  create: async ({ request, locals }) => {
    const user = locals.user;
    if (!user) {
      return fail(401, { error: "Not authenticated" });
    }

    const formData = await request.formData();
    const dataJson = formData.get("data") as string;
    const fileId = formData.get("fileId") as string | null;

    if (!dataJson) {
      return fail(400, { error: "No resume data provided" });
    }

    let data: ResumeData;
    try {
      data = JSON.parse(dataJson);
    } catch {
      return fail(400, { error: "Invalid resume data format" });
    }

    if (!data.basics || !data.basics.name?.trim()) {
      return fail(400, { error: "Name is required" });
    }

    const result = await createProfileFromResume(
      data,
      user.id,
      fileId || undefined,
    );

    if (!result.success) {
      return fail(400, { error: result.message });
    }

    redirect(302, `/dashboard?profile=${result.profileId}`);
  },

  /**
   * Simple manual profile creation
   */
  manual: async ({ request, locals }) => {
    const user = locals.user;
    if (!user) {
      return fail(401, { error: "Not authenticated" });
    }

    const formData = await request.formData();
    const name = formData.get("name") as string;
    const title = formData.get("title") as string;

    if (!name || name.trim().length === 0) {
      return fail(400, { error: "Name is required", name, title });
    }

    // Generate a slug from the name
    let slug = name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/(^-|-$)/g, "");

    // Ensure slug is unique
    let slugSuffix = 0;
    let finalSlug = slug;
    while (true) {
      const existing = await db.profiles.findFirst({
        where: { slug: finalSlug },
      });
      if (!existing) break;
      slugSuffix++;
      finalSlug = `${slug}-${slugSuffix}`;
    }

    // Create the profile
    const profile = await db.profiles.create({
      data: {
        name: name.trim(),
        title: title?.trim() || null,
        slug: finalSlug,
        user_id: user.id,
        is_default: false,
      },
    });

    redirect(302, `/dashboard?profile=${profile.id}`);
  },

};
