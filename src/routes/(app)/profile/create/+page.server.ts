import type { Actions, PageServerLoad } from "./$types";
import { fail, redirect } from "@sveltejs/kit";
import { dbDirect as db } from "$lib/server/db";
import { eq } from "drizzle-orm";
import { profiles, profile_versions } from "$lib/server/db/schema";
import { deleteFile, uploadFile } from "$lib/server/files";
import {
  createProfileFromResume,
  extractTextFromFile,
  getFormatName,
  isSupportedMimeType,
  mapJsonResumeToInternal,
  parseResumeWithLLM,
  type ResumeData,
  validateJsonResume,
} from "$lib/server/resume";
import { importProfileFromJson } from "$lib/server/profile/import-profile-json";
import type { ExportedProfile } from "$lib/server/profile/export-profile-json";

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

    // Handle JSON Resume files
    if (file.type === "application/json" || file.name.endsWith(".json")) {
      try {
        const text = await file.text();
        const jsonData = JSON.parse(text);

        validateJsonResume(jsonData);
        const parsedData = mapJsonResumeToInternal(jsonData);

        return {
          success: true,
          parsedData,
          fileName: file.name,
          fileFormat: "JSON Resume",
        };
      } catch (error) {
        const message = error instanceof Error
          ? error.message
          : "Failed to parse JSON Resume file";
        return fail(400, { error: message });
      }
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

      // Upload file
      const uploadResult = await uploadFile({
        filename: file.name,
        buffer,
        title: `CV Upload - ${user.email || user.id}`,
        description: "CV/Resume uploaded during profile creation",
      });
      fileId = uploadResult.id;

      // Extract text from file
      const text = await extractTextFromFile(buffer, file.type);

      // Parse with LLM
      const parsedData = await parseResumeWithLLM(text, user.id);

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
          await deleteFile(fileId);
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

    let result;
    try {
      result = await createProfileFromResume(
        data,
        user.id,
        fileId || undefined,
      );
    } catch (e) {
      console.error("[create] error:", e);
      const message = e instanceof Error ? e.message : "Profile creation failed";
      return fail(500, { error: message });
    }

    if (!result.success) {
      return fail(400, { error: result.message });
    }

    if (result.errors && result.errors.length > 0) {
      console.warn("[create] import warnings:", result.errors);
    }

    redirect(303, `/home?profile=${result.profileId}&created=true`);
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
      const existing = await db.query.profiles.findFirst({
        where: eq(profiles.slug, finalSlug),
      });
      if (!existing) break;
      slugSuffix++;
      finalSlug = `${slug}-${slugSuffix}`;
    }

    // Create the profile
    const [profile] = await db.insert(profiles).values({
      name: name.trim(),
      title: title?.trim() || null,
      slug: finalSlug,
      user_id: user.id,
      is_default: false,
    }).returning();

    // Create a default Resume / CV version
    await db.insert(profile_versions).values({
      slug: "default",
      name: "Default",
      profile_id: profile.id,
      date_created: new Date(),
    });

    redirect(303, `/home?profile=${profile.id}&created=true`);
  },

  /**
   * Import profile from JSON export
   */
  import: async ({ request, locals }) => {
    const user = locals.user;
    if (!user) {
      return fail(401, { error: "Not authenticated" });
    }

    const formData = await request.formData();
    const file = formData.get("file") as File | null;

    if (!file || file.size === 0) {
      return fail(400, { error: "Please select a JSON file to import" });
    }

    if (!file.name.endsWith(".json") && file.type !== "application/json") {
      return fail(400, { error: "Please upload a JSON file" });
    }

    const MAX_SIZE = 10 * 1024 * 1024;
    if (file.size > MAX_SIZE) {
      return fail(400, { error: "File is too large. Maximum size is 10MB." });
    }

    let data: ExportedProfile;
    try {
      const text = await file.text();
      data = JSON.parse(text);
    } catch {
      return fail(400, { error: "Invalid JSON file" });
    }

    if (!data.profile) {
      return fail(400, {
        error: "Invalid export format: missing profile data",
      });
    }

    let result: { profileId: number; profileName: string };
    try {
      result = await importProfileFromJson(data, user.id);
    } catch (e) {
      const message = e instanceof Error ? e.message : "Import failed";
      return fail(500, { error: message });
    }

    redirect(303, `/home?profile=${result.profileId}&created=true`);
  },
};
