import type { Actions, PageServerLoad } from "./$types";
import { fail, redirect } from "@sveltejs/kit";
import { dbDirect as db } from "$lib/server/db";
import { getProfileByIdentifier } from "$lib/server/profile/default";
import { getSelectedProfileId } from "../utils";
import {
  validateUpload,
  saveProfilePhoto,
  deleteUpload,
} from "$lib/server/uploads";

export const load: PageServerLoad = async ({ parent }) => {
  const layoutData = await parent();

  if (!layoutData.selectedProfile) {
    redirect(302, "/dashboard/profile");
  }

  const profile = await getProfileByIdentifier(layoutData.selectedProfile.id);

  if (!profile) {
    redirect(302, "/dashboard/profile");
  }

  return { profile };
};

export const actions: Actions = {
  update: async ({ request, locals, cookies }) => {
    const user = locals.user;
    if (!user) {
      return fail(401, { error: "Not authenticated" });
    }

    const profileId = await getSelectedProfileId(cookies, user.id);
    if (!profileId) {
      return fail(400, { error: "No profile selected" });
    }

    const formData = await request.formData();

    // Basic info fields
    const name = formData.get("name") as string;
    const slug = formData.get("slug") as string;
    const title = formData.get("title") as string;
    const subtitle = formData.get("subtitle") as string;
    const headline = formData.get("headline") as string;
    const summary = formData.get("summary") as string;

    // Contact fields
    const email_address = formData.get("email_address") as string;
    const phone_number = formData.get("phone_number") as string;
    const personal_website = formData.get("personal_website") as string;

    // Location field
    const location = formData.get("location") as string;

    // Social profiles
    const linkedin_profile = formData.get("linkedin_profile") as string;
    const github_profile = formData.get("github_profile") as string;
    const stackoverflow_profile = formData.get(
      "stackoverflow_profile",
    ) as string;
    const npm_profile = formData.get("npm_profile") as string;
    const pypi_profile = formData.get("pypi_profile") as string;

    // Validate required fields
    if (!name || name.trim().length === 0) {
      return fail(400, { error: "Name is required" });
    }

    // Validate and process slug
    let finalSlug: string | undefined;
    if (slug && slug.trim()) {
      // Normalize slug: lowercase, replace non-alphanumeric with hyphens, trim hyphens
      finalSlug = slug
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/(^-|-$)/g, "");

      if (finalSlug.length < 2) {
        return fail(400, { error: "Slug must be at least 2 characters" });
      }

      if (finalSlug.length > 50) {
        return fail(400, { error: "Slug must be 50 characters or less" });
      }

      // Check if slug is already taken by another profile
      const existingProfile = await db.profiles.findFirst({
        where: {
          slug: finalSlug,
          id: { not: profileId },
        },
      });

      if (existingProfile) {
        return fail(400, { error: "This URL slug is already taken. Please choose another." });
      }
    }

    await db.profiles.update({
      where: { id: profileId },
      data: {
        name: name.trim(),
        ...(finalSlug && { slug: finalSlug }),
        title: title?.trim() || null,
        subtitle: subtitle?.trim() || null,
        headline: headline?.trim() || null,
        summary: summary?.trim() || null,
        email_address: email_address?.trim() || null,
        phone_number: phone_number?.trim() || null,
        personal_website: personal_website?.trim() || null,
        location: location?.trim() || null,
        linkedin_profile: linkedin_profile?.trim() || null,
        github_profile: github_profile?.trim() || null,
        stackoverflow_profile: stackoverflow_profile?.trim() || null,
        npm_profile: npm_profile?.trim() || null,
        pypi_profile: pypi_profile?.trim() || null,
        date_updated: new Date(),
      },
    });

    return { success: true };
  },

  uploadPhoto: async ({ request, locals, cookies }) => {
    const user = locals.user;
    if (!user) {
      return fail(401, { error: "Not authenticated" });
    }

    const profileId = await getSelectedProfileId(cookies, user.id);
    if (!profileId) {
      return fail(400, { error: "No profile selected" });
    }

    const formData = await request.formData();
    const file = formData.get("photo") as File | null;

    if (!file || file.size === 0) {
      return fail(400, { error: "Please select a photo to upload" });
    }

    // Validate file
    const validation = validateUpload(file);
    if (!validation.valid) {
      return fail(400, { error: validation.error });
    }

    try {
      // Get current profile to check for existing photo
      const currentProfile = await db.profiles.findUnique({
        where: { id: profileId },
        select: { profile_photo_path: true },
      });

      // Save new photo (processes and optimizes image)
      const uploadResult = await saveProfilePhoto(file);

      // Update profile with new photo path
      await db.profiles.update({
        where: { id: profileId },
        data: {
          profile_photo_path: uploadResult.path,
          date_updated: new Date(),
        },
      });

      // Delete old photo if it exists
      if (currentProfile?.profile_photo_path) {
        await deleteUpload(currentProfile.profile_photo_path);
      }

      return { success: true, photoUploaded: true };
    } catch (error) {
      console.error("Failed to upload profile photo:", error);
      return fail(500, { error: "Failed to upload photo. Please try again." });
    }
  },

  removePhoto: async ({ locals, cookies }) => {
    const user = locals.user;
    if (!user) {
      return fail(401, { error: "Not authenticated" });
    }

    const profileId = await getSelectedProfileId(cookies, user.id);
    if (!profileId) {
      return fail(400, { error: "No profile selected" });
    }

    try {
      // Get current profile photo
      const currentProfile = await db.profiles.findUnique({
        where: { id: profileId },
        select: { profile_photo_path: true },
      });

      if (!currentProfile?.profile_photo_path) {
        return fail(400, { error: "No profile photo to remove" });
      }

      // Remove photo reference from profile
      await db.profiles.update({
        where: { id: profileId },
        data: {
          profile_photo_path: null,
          date_updated: new Date(),
        },
      });

      // Delete file
      await deleteUpload(currentProfile.profile_photo_path);

      return { success: true, photoRemoved: true };
    } catch (error) {
      console.error("Failed to remove profile photo:", error);
      return fail(500, { error: "Failed to remove photo. Please try again." });
    }
  },
};
