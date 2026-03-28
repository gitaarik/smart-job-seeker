import type { Actions, PageServerLoad } from "./$types";
import { fail, redirect } from "@sveltejs/kit";
import { dbDirect as db } from "$lib/server/db";
import { getSelectedProfileId } from "../../profile/utils";
import { generateVersionPdfs } from "$lib/server/profile/generate-version-pdfs";

export const load: PageServerLoad = async ({ parent }) => {
  const layoutData = await parent();

  if (!layoutData.selectedProfile) {
    redirect(302, "/dashboard");
  }

  const profile = await db.profiles.findUnique({
    where: { id: layoutData.selectedProfile.id },
    select: {
      public_resume_version: true,
      public_cv_version: true,
    },
  });

  const versions = await db.profile_versions.findMany({
    where: { profile: layoutData.selectedProfile.id },
    include: {
      profile_version_extensions_profile_version_extensions_extenderToprofile_versions:
        {
          select: {
            extended: true,
          },
        },
    },
    orderBy: { name: "asc" },
  });

  const publicResumeVersionId = profile?.public_resume_version ?? null;
  const publicCvVersionId = profile?.public_cv_version ?? null;

  const mapped = versions.map(({ profile_version_extensions_profile_version_extensions_extenderToprofile_versions: exts, ...v }) => ({
    ...v,
    extendsIds: exts?.map((e) => e.extended).filter((id): id is number => id !== null) ?? [],
  }));

  // Put public resume first, then public cv, then the rest sorted by name
  const publicIds = new Set([publicResumeVersionId, publicCvVersionId].filter(Boolean));
  const pinned = [publicResumeVersionId, publicCvVersionId]
    .filter((id): id is number => id !== null)
    .map((id) => mapped.find((v) => v.id === id)!)
    .filter(Boolean);
  // Deduplicate if both point to the same version
  const pinnedUnique = [...new Map(pinned.map((v) => [v.id, v])).values()];
  const rest = mapped.filter((v) => !publicIds.has(v.id));

  return {
    versions: [...pinnedUnique, ...rest],
    profileId: layoutData.selectedProfile.id,
    publicResumeVersionId,
    publicCvVersionId,
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
    const slug = formData.get("slug") as string;
    const name = formData.get("name") as string;
    const extendsIds = formData.getAll("extendsIds").map((v) => parseInt(v as string)).filter((v) => !isNaN(v));

    if (!slug || slug.trim().length === 0) {
      return fail(400, { error: "Slug is required" });
    }

    const created = await db.profile_versions.create({
      data: {
        slug: slug.trim(),
        name: name?.trim() || null,
        profile: profileId,
        date_created: new Date(),
      },
    });

    for (const parentId of extendsIds) {
      const parent = await db.profile_versions.findFirst({
        where: { id: parentId, profile: profileId },
      });
      if (parent) {
        await db.profile_version_extensions.create({
          data: {
            extender: created.id,
            extended: parentId,
          },
        });
      }
    }

    generateVersionPdfs(profileId, slug.trim()).catch(console.error);

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
    const slug = formData.get("slug") as string;
    const name = formData.get("name") as string;
    const extendsIds = formData.getAll("extendsIds").map((v) => parseInt(v as string)).filter((v) => !isNaN(v) && v !== id);
    const setPublicResume = formData.get("publicResume") === "on";
    const setPublicCv = formData.get("publicCv") === "on";

    if (isNaN(id)) {
      return fail(400, { error: "Invalid version ID" });
    }

    if (!slug || slug.trim().length === 0) {
      return fail(400, { error: "Slug is required" });
    }

    const existing = await db.profile_versions.findFirst({
      where: { id, profile: profileId },
    });

    if (!existing) {
      return fail(404, { error: "Version not found" });
    }

    await db.profile_versions.update({
      where: { id },
      data: {
        slug: slug.trim(),
        name: name?.trim() || null,
        date_updated: new Date(),
      },
    });

    // Update public resume/cv version on profile
    const profile = await db.profiles.findUnique({
      where: { id: profileId },
      select: { public_resume_version: true, public_cv_version: true },
    });

    const profileUpdate: { public_resume_version?: number | null; public_cv_version?: number | null } = {};

    // If checkbox is checked, set this version as public; if unchecked and it was this version, clear it
    if (setPublicResume) {
      if (profile?.public_resume_version !== id) {
        profileUpdate.public_resume_version = id;
      }
    } else if (profile?.public_resume_version === id) {
      profileUpdate.public_resume_version = null;
    }

    if (setPublicCv) {
      if (profile?.public_cv_version !== id) {
        profileUpdate.public_cv_version = id;
      }
    } else if (profile?.public_cv_version === id) {
      profileUpdate.public_cv_version = null;
    }

    if (Object.keys(profileUpdate).length > 0) {
      await db.profiles.update({
        where: { id: profileId },
        data: profileUpdate,
      });
    }

    // Update extensions: remove old, add new ones
    await db.profile_version_extensions.deleteMany({
      where: { extender: id },
    });

    for (const parentId of extendsIds) {
      const parent = await db.profile_versions.findFirst({
        where: { id: parentId, profile: profileId },
      });
      if (parent) {
        await db.profile_version_extensions.create({
          data: {
            extender: id,
            extended: parentId,
          },
        });
      }
    }

    generateVersionPdfs(profileId, slug.trim()).catch(console.error);

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
      return fail(400, { error: "Invalid version ID" });
    }

    const existing = await db.profile_versions.findFirst({
      where: { id, profile: profileId },
    });

    if (!existing) {
      return fail(404, { error: "Version not found" });
    }

    // Remove extension records where this version is extender or extended
    await db.profile_version_extensions.deleteMany({
      where: { OR: [{ extender: id }, { extended: id }] },
    });

    await db.profile_versions.delete({
      where: { id },
    });

    return { success: true };
  },
};
