import type { Actions, PageServerLoad } from "./$types";
import { fail, redirect } from "@sveltejs/kit";
import { dbDirect as db } from "$lib/server/db";
import { getSelectedProfileId } from "../../../profile/utils";
import { generateVersionPdfs } from "$lib/server/profile/generate-version-pdfs";

export const load: PageServerLoad = async ({ params, parent }) => {
  const layoutData = await parent();

  if (!layoutData.selectedProfile) {
    redirect(302, "/dashboard");
  }

  const id = parseInt(params.id);
  if (isNaN(id)) {
    redirect(302, "/dashboard/export/resume");
  }

  const version = await db.profile_versions.findFirst({
    where: { id, profile: layoutData.selectedProfile.id },
    include: {
      profile_version_extensions_profile_version_extensions_extenderToprofile_versions:
        {
          select: {
            extended: true,
          },
        },
    },
  });

  if (!version) {
    redirect(302, "/dashboard/export/resume");
  }

  const {
    profile_version_extensions_profile_version_extensions_extenderToprofile_versions: exts,
    ...v
  } = version;

  const profile = await db.profiles.findUnique({
    where: { id: layoutData.selectedProfile.id },
    select: {
      public_resume_version: true,
      public_cv_version: true,
    },
  });

  // Get all other versions for "extends" options
  const allVersions = await db.profile_versions.findMany({
    where: { profile: layoutData.selectedProfile.id, id: { not: id } },
    orderBy: { name: "asc" },
    select: { id: true, name: true, slug: true },
  });

  // Find entities that reference this version's slug in their tags
  const slug = v.slug;
  type TaggedRow = { id: number; name: string | null };
  type TaggedAchievementRow = { id: number; name: string | null; work_experience: number };
  let taggedWorkExperiences: TaggedRow[] = [];
  let taggedEducation: TaggedRow[] = [];
  let taggedSideProjects: TaggedRow[] = [];
  let taggedSkills: TaggedRow[] = [];
  let taggedAchievements: TaggedAchievementRow[] = [];

  if (slug) {
    const profileId = layoutData.selectedProfile.id;
    const tagJson = JSON.stringify([slug]);

    [taggedWorkExperiences, taggedEducation, taggedSideProjects, taggedSkills, taggedAchievements] =
      await Promise.all([
        db.$queryRaw<TaggedRow[]>`
          SELECT id, COALESCE(position, name) as name FROM work_experiences
          WHERE profile = ${profileId} AND tags::jsonb @> ${tagJson}::jsonb
          ORDER BY name ASC`,
        db.$queryRaw<TaggedRow[]>`
          SELECT id, COALESCE(institution, area) as name FROM education
          WHERE profile = ${profileId} AND tags::jsonb @> ${tagJson}::jsonb
          ORDER BY name ASC`,
        db.$queryRaw<TaggedRow[]>`
          SELECT id, name FROM side_projects
          WHERE profile = ${profileId} AND tags::jsonb @> ${tagJson}::jsonb
          ORDER BY name ASC`,
        db.$queryRaw<TaggedRow[]>`
          SELECT ts.id, ts.name FROM tech_skills ts
          JOIN tech_skill_categories tsc ON ts.category = tsc.id
          WHERE tsc.profile = ${profileId} AND ts.tags::jsonb @> ${tagJson}::jsonb
          ORDER BY ts.name ASC`,
        db.$queryRaw<TaggedAchievementRow[]>`
          SELECT wea.id, wea.description as name, wea.work_experience FROM work_experience_achievements wea
          JOIN work_experiences we ON wea.work_experience = we.id
          WHERE we.profile = ${profileId} AND wea.tags::jsonb @> ${tagJson}::jsonb
          ORDER BY wea.description ASC`,
      ]);
  }

  return {
    version: {
      ...v,
      extendsIds:
        exts
          ?.map((e) => e.extended)
          .filter((id): id is number => id !== null) ?? [],
    },
    allVersions,
    publicResumeVersionId: profile?.public_resume_version ?? null,
    publicCvVersionId: profile?.public_cv_version ?? null,
    tagUsage: {
      workExperiences: taggedWorkExperiences,
      education: taggedEducation,
      sideProjects: taggedSideProjects,
      skills: taggedSkills,
      achievements: taggedAchievements,
    },
  };
};

export const actions: Actions = {
  update: async ({ request, locals, cookies, params }) => {
    const user = locals.user;
    if (!user) {
      return fail(401, { error: "Not authenticated" });
    }

    const profileId = await getSelectedProfileId(cookies, user.id);
    if (!profileId) {
      return fail(400, { error: "No profile selected" });
    }

    const id = parseInt(params.id);
    if (isNaN(id)) {
      return fail(400, { error: "Invalid version ID" });
    }

    const formData = await request.formData();
    const slug = formData.get("slug") as string;
    const name = formData.get("name") as string;
    const extendsIds = formData
      .getAll("extendsIds")
      .map((v) => parseInt(v as string))
      .filter((v) => !isNaN(v) && v !== id);
    const setPublicResume = formData.get("publicResume") === "on";
    const setPublicCv = formData.get("publicCv") === "on";

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

    const profileUpdate: {
      public_resume_version?: number | null;
      public_cv_version?: number | null;
    } = {};

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

  delete: async ({ request, locals, cookies, params }) => {
    const user = locals.user;
    if (!user) {
      return fail(401, { error: "Not authenticated" });
    }

    const profileId = await getSelectedProfileId(cookies, user.id);
    if (!profileId) {
      return fail(400, { error: "No profile selected" });
    }

    const id = parseInt(params.id);
    if (isNaN(id)) {
      return fail(400, { error: "Invalid version ID" });
    }

    const existing = await db.profile_versions.findFirst({
      where: { id, profile: profileId },
    });

    if (!existing) {
      return fail(404, { error: "Version not found" });
    }

    // Clear public version references if this version was public
    const profile = await db.profiles.findUnique({
      where: { id: profileId },
      select: { public_resume_version: true, public_cv_version: true },
    });

    const profileUpdate: {
      public_resume_version?: number | null;
      public_cv_version?: number | null;
    } = {};

    if (profile?.public_resume_version === id) {
      profileUpdate.public_resume_version = null;
    }
    if (profile?.public_cv_version === id) {
      profileUpdate.public_cv_version = null;
    }

    if (Object.keys(profileUpdate).length > 0) {
      await db.profiles.update({
        where: { id: profileId },
        data: profileUpdate,
      });
    }

    // Remove extension records where this version is extender or extended
    await db.profile_version_extensions.deleteMany({
      where: { OR: [{ extender: id }, { extended: id }] },
    });

    await db.profile_versions.delete({
      where: { id },
    });

    redirect(302, "/dashboard/export/resume");
  },
};
