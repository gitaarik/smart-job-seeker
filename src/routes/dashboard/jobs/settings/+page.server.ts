import type { Actions, PageServerLoad } from "./$types";
import { fail, redirect } from "@sveltejs/kit";
import { dbDirect as db } from "$lib/server/db";
import { getSelectedProfileId } from "../../profile/utils";

export const load: PageServerLoad = async ({ parent }) => {
  const layoutData = await parent();

  if (!layoutData.selectedProfile) {
    redirect(302, "/dashboard");
  }

  const jobSearches = await db.job_searches.findMany({
    where: { profile: layoutData.selectedProfile.id },
    include: {
      job_platforms: true,
      platform_profiles: true,
    },
    orderBy: { date_created: "desc" },
  });

  return {
    jobSearches,
    profileId: layoutData.selectedProfile.id,
  };
};

async function getOrCreatePlatform(
  platformId: string | null,
  platformUrl: string | null,
  platformName: string | null,
  isNew: boolean,
): Promise<number | null> {
  if (!platformUrl) return null;

  // If we have an existing platform ID and it's not new, use it
  if (platformId && !isNew) {
    return parseInt(platformId);
  }

  // Try to find existing platform by URL
  const parsed = new URL(platformUrl);
  const domain = parsed.hostname.replace(/^www\./, "");

  const existing = await db.job_platforms.findFirst({
    where: {
      OR: [
        { url: { contains: domain, mode: "insensitive" } },
        { key: { contains: domain.split(".")[0], mode: "insensitive" } },
      ],
    },
  });

  if (existing) {
    return existing.id;
  }

  // Create new platform
  const key = domain
    .replace(/\.[^.]+$/, "")
    .replace(/[^a-z0-9]/gi, "-")
    .toLowerCase();

  const platform = await db.job_platforms.create({
    data: {
      name: platformName || domain,
      url: platformUrl,
      key: `${key}-${Date.now().toString(36)}`, // Ensure unique key
      status: "published",
      date_created: new Date(),
    },
  });

  return platform.id;
}

async function getOrCreateCredentials(
  profileId: number,
  platformId: number,
  credentialId: string | null,
  newUsername: string | null,
  newPassword: string | null,
): Promise<number | null> {
  // If using existing credentials
  if (credentialId && credentialId !== "none" && credentialId !== "new") {
    const existing = await db.platform_profiles.findFirst({
      where: {
        id: parseInt(credentialId),
        profile: profileId,
        platform: platformId,
      },
    });
    if (existing) {
      return existing.id;
    }
  }

  // If adding new credentials
  if (credentialId === "new" && newUsername) {
    const newCred = await db.platform_profiles.create({
      data: {
        profile: profileId,
        platform: platformId,
        username: newUsername,
        password: newPassword || null,
        status: "active",
        date_created: new Date(),
      },
    });
    return newCred.id;
  }

  return null;
}

export const actions: Actions = {
  create: async ({ request, locals, cookies }) => {
    const user = locals.user;
    if (!user) {
      return fail(401, { error: "Not authenticated" });
    }

    const profileId = await getSelectedProfileId(cookies, user.id);
    if (!profileId) {
      return fail(400, { error: "No profile selected" });
    }

    const formData = await request.formData();
    const name = formData.get("name") as string;
    const search_url = formData.get("search_url") as string;
    const is_active = formData.get("is_active") !== "false";

    // Platform data
    const platformId = formData.get("platform_id") as string;
    const platformUrl = formData.get("platform_url") as string;
    const platformName = formData.get("platform_name") as string;
    const platformIsNew = formData.get("platform_is_new") === "true";

    // Credentials data
    const credentialId = formData.get("credential_id") as string;
    const newCredUsername = formData.get("new_credential_username") as string;
    const newCredPassword = formData.get("new_credential_password") as string;

    if (!name || name.trim().length === 0) {
      return fail(400, { error: "Name is required" });
    }

    if (!search_url || search_url.trim().length === 0) {
      return fail(400, { error: "Search URL is required" });
    }

    // Get or create platform
    const resolvedPlatformId = await getOrCreatePlatform(
      platformId,
      platformUrl,
      platformName,
      platformIsNew,
    );

    // Get or create credentials
    let resolvedCredentialId: number | null = null;
    if (resolvedPlatformId) {
      resolvedCredentialId = await getOrCreateCredentials(
        profileId,
        resolvedPlatformId,
        credentialId,
        newCredUsername,
        newCredPassword,
      );
    }

    await db.job_searches.create({
      data: {
        name: name.trim(),
        search_url: search_url.trim(),
        platform: resolvedPlatformId,
        platform_profile_id: resolvedCredentialId,
        is_active,
        profile: profileId,
        date_created: new Date(),
      },
    });

    return { success: true };
  },

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
    const id = parseInt(formData.get("id") as string);
    const name = formData.get("name") as string;
    const search_url = formData.get("search_url") as string;
    const is_active = formData.get("is_active") !== "false";

    // Platform data
    const platformId = formData.get("platform_id") as string;
    const platformUrl = formData.get("platform_url") as string;
    const platformName = formData.get("platform_name") as string;
    const platformIsNew = formData.get("platform_is_new") === "true";

    // Credentials data
    const credentialId = formData.get("credential_id") as string;
    const newCredUsername = formData.get("new_credential_username") as string;
    const newCredPassword = formData.get("new_credential_password") as string;

    if (isNaN(id)) {
      return fail(400, { error: "Invalid search ID" });
    }

    if (!name || name.trim().length === 0) {
      return fail(400, { error: "Name is required" });
    }

    const existing = await db.job_searches.findFirst({
      where: { id, profile: profileId },
    });

    if (!existing) {
      return fail(404, { error: "Job search not found" });
    }

    // Get or create platform
    const resolvedPlatformId = await getOrCreatePlatform(
      platformId,
      platformUrl,
      platformName,
      platformIsNew,
    );

    // Get or create credentials
    let resolvedCredentialId: number | null = null;
    if (resolvedPlatformId) {
      resolvedCredentialId = await getOrCreateCredentials(
        profileId,
        resolvedPlatformId,
        credentialId,
        newCredUsername,
        newCredPassword,
      );
    }

    await db.job_searches.update({
      where: { id },
      data: {
        name: name.trim(),
        search_url: search_url?.trim() || null,
        platform: resolvedPlatformId,
        platform_profile_id: resolvedCredentialId,
        is_active,
        date_updated: new Date(),
      },
    });

    return { success: true };
  },

  delete: async ({ request, locals, cookies }) => {
    const user = locals.user;
    if (!user) {
      return fail(401, { error: "Not authenticated" });
    }

    const profileId = await getSelectedProfileId(cookies, user.id);
    if (!profileId) {
      return fail(400, { error: "No profile selected" });
    }

    const formData = await request.formData();
    const id = parseInt(formData.get("id") as string);

    if (isNaN(id)) {
      return fail(400, { error: "Invalid search ID" });
    }

    const existing = await db.job_searches.findFirst({
      where: { id, profile: profileId },
    });

    if (!existing) {
      return fail(404, { error: "Job search not found" });
    }

    await db.job_searches.delete({
      where: { id },
    });

    return { success: true };
  },
};
