import type { Actions, PageServerLoad } from "./$types";
import { fail, redirect } from "@sveltejs/kit";
import { dbDirect as db } from "$lib/server/db";
import { getSelectedProfileId } from "../../profile/utils";
import { generateVersionPdfs } from "$lib/server/profile/generate-version-pdfs";
import { requireUsage, incrementUsage } from "$lib/server/billing/usage";

export const load: PageServerLoad = async ({ parent }) => {
  const layoutData = await parent();

  if (!layoutData.selectedProfile) {
    redirect(302, "/dashboard");
  }

  const [profile, versions, profileExports] = await Promise.all([
    db.profiles.findUnique({
      where: { id: layoutData.selectedProfile.id },
      select: {
        public_resume_version: true,
        public_cv_version: true,
      },
    }),
    db.profile_versions.findMany({
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
    }),
    db.profile_exports.findMany({
      where: {
        profile: layoutData.selectedProfile.id,
        status: "published",
        export_type: { in: ["resume", "cv"] },
      },
      select: { description: true, export_type: true },
    }),
  ]);

  const publicResumeVersionId = profile?.public_resume_version ?? null;
  const publicCvVersionId = profile?.public_cv_version ?? null;

  const mapped = versions.map(({ profile_version_extensions_profile_version_extensions_extenderToprofile_versions: exts, ...v }) => {
    const hasResumePdf = profileExports.some(
      (e) => e.export_type === "resume" && e.description?.includes(`(${v.slug})`)
    );
    const hasCvPdf = profileExports.some(
      (e) => e.export_type === "cv" && e.description?.includes(`(${v.slug})`)
    );
    return {
      ...v,
      extendsIds: exts?.map((e) => e.extended).filter((id): id is number => id !== null) ?? [],
      hasResumePdf,
      hasCvPdf,
    };
  });

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

    await requireUsage(user.id, "pdf_exports");
    await incrementUsage(user.id, "pdf_exports");
    generateVersionPdfs(profileId, slug.trim()).catch(console.error);

    return { success: true };
  },

  generateExports: async ({ request, locals, cookies }) => {
    const user = locals.user;
    if (!user) return fail(401, { error: "Not authenticated" });

    const profileId = await getSelectedProfileId(cookies, user.id);
    if (!profileId) return fail(400, { error: "No profile selected" });

    const formData = await request.formData();
    const slug = (formData.get("slug") as string) || "";
    if (!slug) return fail(400, { error: "No version specified" });

    const version = await db.profile_versions.findFirst({
      where: { profile: profileId, slug },
    });
    if (!version) return fail(404, { error: "Version not found" });

    await requireUsage(user.id, "pdf_exports");
    await incrementUsage(user.id, "pdf_exports");
    generateVersionPdfs(profileId, slug).catch(console.error);

    return { success: true, generatedSlug: slug };
  },
};
