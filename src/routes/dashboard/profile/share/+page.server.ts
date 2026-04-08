import type { Actions, PageServerLoad } from "./$types";
import { fail, redirect } from "@sveltejs/kit";
import { dbDirect as db } from "$lib/server/db";
import { getSelectedProfileId } from "../utils";
import {
  DEFAULT_FORMAT,
  DEFAULT_VIEW_MODE,
  isValidFormat,
  isValidViewMode,
} from "$lib/profile-tokens";
import crypto from "crypto";

function generateToken(): string {
  return crypto.randomBytes(16).toString("hex");
}

function hashToken(token: string): string {
  return crypto.createHash("sha256").update(token).digest("hex");
}

export const load: PageServerLoad = async ({ parent }) => {
  const layoutData = await parent();

  if (!layoutData.selectedProfile) {
    redirect(302, "/dashboard");
  }

  // Get profile versions for this profile to use in the dropdown
  const versions = await db.profile_versions.findMany({
    where: { profile: layoutData.selectedProfile.id },
    orderBy: { name: "asc" },
  });

  // Get all tokens for versions belonging to this profile
  const versionIds = versions.map((v) => v.id);

  const tokens = versionIds.length > 0
    ? await db.profile_tokens.findMany({
      where: { profile_version: { in: versionIds } },
      orderBy: { date_created: "desc" },
    })
    : [];

  // Create a map of version id to version for display
  const versionMap = new Map(versions.map((v) => [v.id, v]));

  // Attach version info to tokens
  const tokensWithVersions = tokens.map((token) => ({
    ...token,
    version: versionMap.get(token.profile_version),
  }));

  return {
    tokens: tokensWithVersions,
    versions,
    profileId: layoutData.selectedProfile.id,
    profileSlug: layoutData.selectedProfile.slug,
  };
};

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
    const notes = formData.get("notes") as string;
    const profile_version = formData.get("profile_version") as string;
    const format = (formData.get("format") as string) || DEFAULT_FORMAT;
    const view_mode = (formData.get("view_mode") as string) || DEFAULT_VIEW_MODE;
    const visit_limit = formData.get("visit_limit") as string;
    const expires_at = formData.get("expires_at") as string;

    if (!profile_version) {
      return fail(400, { error: "Please select a profile version" });
    }

    if (!isValidFormat(format)) {
      return fail(400, { error: "Invalid format" });
    }

    if (!isValidViewMode(view_mode)) {
      return fail(400, { error: "Invalid view mode" });
    }

    // Verify the version belongs to this profile
    const version = await db.profile_versions.findFirst({
      where: {
        id: parseInt(profile_version),
        profile: profileId,
      },
    });

    if (!version) {
      return fail(400, { error: "Invalid profile version" });
    }

    const token = generateToken();
    const token_hash = hashToken(token);

    await db.profile_tokens.create({
      data: {
        token,
        token_hash,
        name: name?.trim() || null,
        notes: notes?.trim() || null,
        profile_version: parseInt(profile_version),
        format,
        view_mode,
        visit_limit: visit_limit ? parseInt(visit_limit) : null,
        expires_at: expires_at ? new Date(expires_at) : null,
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
    const notes = formData.get("notes") as string;
    const profile_version = formData.get("profile_version") as string;
    const format = formData.get("format") as string;
    const view_mode = formData.get("view_mode") as string;
    const visit_limit = formData.get("visit_limit") as string;
    const expires_at = formData.get("expires_at") as string;
    const status = formData.get("status") as string;

    if (isNaN(id)) {
      return fail(400, { error: "Invalid token ID" });
    }

    // Verify ownership through version
    const existingToken = await db.profile_tokens.findUnique({
      where: { id },
    });

    if (!existingToken) {
      return fail(404, { error: "Token not found" });
    }

    const version = await db.profile_versions.findFirst({
      where: {
        id: existingToken.profile_version,
        profile: profileId,
      },
    });

    if (!version) {
      return fail(403, { error: "Not authorized" });
    }

    // If changing version, verify the new version belongs to this profile
    let newVersionId = existingToken.profile_version;
    if (profile_version) {
      const newVersion = await db.profile_versions.findFirst({
        where: {
          id: parseInt(profile_version),
          profile: profileId,
        },
      });
      if (!newVersion) {
        return fail(400, { error: "Invalid profile version" });
      }
      newVersionId = newVersion.id;
    }

    await db.profile_tokens.update({
      where: { id },
      data: {
        name: name?.trim() || null,
        notes: notes?.trim() || null,
        profile_version: newVersionId,
        format: format && isValidFormat(format) ? format : (existingToken.format || DEFAULT_FORMAT),
        view_mode: view_mode && isValidViewMode(view_mode) ? view_mode : (existingToken.view_mode || DEFAULT_VIEW_MODE),
        visit_limit: visit_limit ? parseInt(visit_limit) : null,
        expires_at: expires_at ? new Date(expires_at) : null,
        status: status || "published",
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
      return fail(400, { error: "Invalid token ID" });
    }

    // Verify ownership through version
    const existingToken = await db.profile_tokens.findUnique({
      where: { id },
    });

    if (!existingToken) {
      return fail(404, { error: "Token not found" });
    }

    const version = await db.profile_versions.findFirst({
      where: {
        id: existingToken.profile_version,
        profile: profileId,
      },
    });

    if (!version) {
      return fail(403, { error: "Not authorized" });
    }

    await db.profile_tokens.delete({
      where: { id },
    });

    return { success: true };
  },
};
