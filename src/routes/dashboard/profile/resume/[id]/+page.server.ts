import type { Actions, PageServerLoad } from "./$types";
import { fail, redirect } from "@sveltejs/kit";
import { dbDirect as db, queryRaw, sql } from "$lib/server/db";
import { profile_versions, profile_version_extensions, profiles } from "$lib/server/db/schema";
import { eq, and, or, asc } from "drizzle-orm";
import { getSelectedProfileId } from "../../utils";
import { generateVersionPdfs } from "$lib/server/profile/generate-version-pdfs";
import { chargeCredits } from "$lib/server/billing/credits";
import { requireCredits } from "$lib/server/billing/require-credits";

export const load: PageServerLoad = async ({ params, parent }) => {
  const layoutData = await parent();

  if (!layoutData.selectedProfile) {
    redirect(302, "/dashboard");
  }

  const id = parseInt(params.id);
  if (isNaN(id)) {
    redirect(302, "/dashboard/profile/resume");
  }

  const version = await db.query.profile_versions.findFirst({
    where: { id, profile_id: layoutData.selectedProfile.id },
    with: {
      profile_version_extensions_profile_version_extensions_extenderToprofile_versions:
        {
          select: {
            extended_id: true,
          },
        },
    },
  });

  if (!version) {
    redirect(302, "/dashboard/profile/resume");
  }

  const {
    profile_version_extensions_profile_version_extensions_extenderToprofile_versions: exts,
    ...v
  } = version;

  const profile = await db.query.profiles.findFirst({
    where: { id: layoutData.selectedProfile.id },
    select: {
      public_resume_version_id: true,
      public_cv_version_id: true,
    },
  });

  // Get all other versions for "extends" options
  const allVersions = await db.query.profile_versions.findMany({
    where: { profile_id: layoutData.selectedProfile.id, id: { not: id } },
    orderBy: asc(profile_versions.name),
    select: { id: true, name: true, slug: true },
  });

  // Find entities that reference this version's slug in their tags
  const slug = v.slug;
  type TaggedRow = { id: number; name: string | null };
  type TaggedAchievementRow = { id: number; name: string | null; work_experience_id: number };
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
        queryRaw<TaggedRow[]>(sql`
          SELECT id, COALESCE(position, name) as name FROM work_experiences
          WHERE profile_id = ${profileId} AND tags::jsonb @> ${tagJson}::jsonb
          ORDER BY name ASC`),
        queryRaw<TaggedRow[]>(sql`
          SELECT id, COALESCE(institution, area) as name FROM education
          WHERE profile_id = ${profileId} AND tags::jsonb @> ${tagJson}::jsonb
          ORDER BY name ASC`),
        queryRaw<TaggedRow[]>(sql`
          SELECT id, name FROM side_projects
          WHERE profile_id = ${profileId} AND tags::jsonb @> ${tagJson}::jsonb
          ORDER BY name ASC`),
        queryRaw<TaggedRow[]>(sql`
          SELECT ts.id, ts.name FROM tech_skills ts
          JOIN tech_skill_categories tsc ON ts.category_id = tsc.id
          WHERE tsc.profile_id = ${profileId} AND ts.tags::jsonb @> ${tagJson}::jsonb
          ORDER BY ts.name ASC`),
        queryRaw<TaggedAchievementRow[]>(sql`
          SELECT wea.id, wea.description as name, wea.work_experience_id FROM work_experience_achievements wea
          JOIN work_experiences we ON wea.work_experience_id = we.id
          WHERE we.profile_id = ${profileId} AND wea.tags::jsonb @> ${tagJson}::jsonb
          ORDER BY wea.description ASC`),
      ]);
  }

  return {
    version: {
      ...v,
      extendsIds:
        exts
          ?.map((e) => e.extended_id)
          .filter((id): id is number => id !== null) ?? [],
    },
    allVersions,
    publicResumeVersionId: profile?.public_resume_version_id ?? null,
    publicCvVersionId: profile?.public_cv_version_id ?? null,
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

    const existing = await db.query.profile_versions.findFirst({
      where: { id, profile_id: profileId },
    });

    if (!existing) {
      return fail(404, { error: "Version not found" });
    }

    await db.update(profile_versions).set({
      slug: slug.trim(),
      name: name?.trim() || null,
      date_updated: new Date(),
    }).where(eq(profile_versions.id, id));

    // Update public resume/cv version on profile
    const profile = await db.query.profiles.findFirst({
      where: { id: profileId },
      select: { public_resume_version_id: true, public_cv_version_id: true },
    });

    const profileUpdate: {
      public_resume_version_id?: number | null;
      public_cv_version_id?: number | null;
    } = {};

    if (setPublicResume) {
      if (profile?.public_resume_version_id !== id) {
        profileUpdate.public_resume_version_id = id;
      }
    } else if (profile?.public_resume_version_id === id) {
      profileUpdate.public_resume_version_id = null;
    }

    if (setPublicCv) {
      if (profile?.public_cv_version_id !== id) {
        profileUpdate.public_cv_version_id = id;
      }
    } else if (profile?.public_cv_version_id === id) {
      profileUpdate.public_cv_version_id = null;
    }

    if (Object.keys(profileUpdate).length > 0) {
      await db.update(profiles).set(profileUpdate).where(eq(profiles.id, profileId));
    }

    // Update extensions: remove old, add new ones
    await db.delete(profile_version_extensions).where(eq(profile_version_extensions.extender_id, id));

    for (const parentId of extendsIds) {
      const parent = await db.query.profile_versions.findFirst({
        where: { id: parentId, profile_id: profileId },
      });
      if (parent) {
        await db.insert(profile_version_extensions).values({
          extender_id: id,
          extended_id: parentId,
        });
      }
    }

    await requireCredits(user.id, 1);
    await chargeCredits(user.id, 1, "pdf_export", "PDF export");
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

    const existing = await db.query.profile_versions.findFirst({
      where: { id, profile_id: profileId },
    });

    if (!existing) {
      return fail(404, { error: "Version not found" });
    }

    // Clear public version references if this version was public
    const profile = await db.query.profiles.findFirst({
      where: { id: profileId },
      select: { public_resume_version_id: true, public_cv_version_id: true },
    });

    const profileUpdate: {
      public_resume_version_id?: number | null;
      public_cv_version_id?: number | null;
    } = {};

    if (profile?.public_resume_version_id === id) {
      profileUpdate.public_resume_version_id = null;
    }
    if (profile?.public_cv_version_id === id) {
      profileUpdate.public_cv_version_id = null;
    }

    if (Object.keys(profileUpdate).length > 0) {
      await db.update(profiles).set(profileUpdate).where(eq(profiles.id, profileId));
    }

    // Remove extension records where this version is extender or extended
    await db.delete(profile_version_extensions).where(
      or(eq(profile_version_extensions.extender_id, id), eq(profile_version_extensions.extended_id, id))
    );

    await db.delete(profile_versions).where(eq(profile_versions.id, id));

    redirect(302, "/dashboard/profile/resume");
  },
};
