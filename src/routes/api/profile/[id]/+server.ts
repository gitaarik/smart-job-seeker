import { json, error } from "@sveltejs/kit";
import type { RequestHandler } from "./$types";
import { dbDirect as db } from "$lib/server/db";

export const PATCH: RequestHandler = async ({ params, request, locals }) => {
  const user = locals.user;
  if (!user) {
    error(401, "Not authenticated");
  }

  const profileId = parseInt(params.id, 10);
  if (isNaN(profileId)) {
    error(400, "Invalid profile ID");
  }

  // Verify ownership
  const profile = await db.profiles.findFirst({
    where: { id: profileId, user_id: user.id },
    select: { id: true, slug: true },
  });

  if (!profile) {
    error(403, "Access denied");
  }

  const data = await request.json();

  // Validate name if provided
  if (data.name !== undefined && (!data.name || data.name.trim().length === 0)) {
    error(400, "Name is required");
  }

  // Validate and process slug if provided
  if (data.slug !== undefined && data.slug && data.slug.trim()) {
    const slug = data.slug
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/(^-|-$)/g, "");

    if (slug.length < 2) {
      error(400, "Slug must be at least 2 characters");
    }

    if (slug.length > 50) {
      error(400, "Slug must be 50 characters or less");
    }

    // Check if slug is already taken by another profile
    const existingProfile = await db.profiles.findFirst({
      where: {
        slug: slug,
        id: { not: profileId },
      },
    });

    if (existingProfile) {
      error(400, "This URL slug is already taken");
    }

    data.slug = slug;
  }

  // Build update object with only provided fields
  const updateData: Record<string, unknown> = {
    date_updated: new Date(),
  };

  const allowedFields = [
    "name",
    "slug",
    "title",
    "subtitle",
    "headline",
    "summary",
    "email_address",
    "phone_number",
    "personal_website",
    "location",
    "linkedin_profile",
    "github_profile",
    "stackoverflow_profile",
    "npm_profile",
    "pypi_profile",
  ];

  for (const field of allowedFields) {
    if (data[field] !== undefined) {
      updateData[field] = data[field]?.trim() || null;
    }
  }

  await db.profiles.update({
    where: { id: profileId },
    data: updateData,
  });

  return json({ success: true });
};
