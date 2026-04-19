import type { Actions, PageServerLoad } from "./$types";
import { fail, redirect } from "@sveltejs/kit";
import { dbDirect as db } from "$lib/server/db";
import { getSelectedProfileId } from "../utils";
import { generateVersionPdfs } from "$lib/server/profile/generate-version-pdfs";
import { chargeCredits } from "$lib/server/billing/credits";
import { requireCredits } from "$lib/server/billing/require-credits";

export const load: PageServerLoad = async ({ parent }) => {
  const layoutData = await parent();

  if (!layoutData.selectedProfile) {
    redirect(302, "/dashboard");
  }

  const [profile, versions, profileExports] = await Promise.all([
    db.query.profiles.findFirst({
      where: { id: layoutData.selectedProfile.id },
      select: {
        public_resume_version_id: true,
        public_cv_version_id: true,
      },
    }),
    db.query.profile_versions.findMany({
      where: { profile_id: layoutData.selectedProfile.id },
      with: {
        profile_version_extensions_profile_version_extensions_extenderToprofile_versions:
          {
            select: {
              extended_id: true,
            },
          },
      },
      orderBy: { name: "asc" },
    }),
    db.query.profile_exports.findMany({
      where: {
        profile_id: layoutData.selectedProfile.id,
        status: "published",
        export_type: { in: ["resume", "cv"] },
      },
      select: { description: true, export_type: true },
    }),
  ]);

  const publicResumeVersionId = profile?.public_resume_version_id ?? null;
  const publicCvVersionId = profile?.public_cv_version_id ?? null;

  const mapped = versions.map(({ profile_version_extensions_profile_version_extensions_extenderToprofile_versions: exts, ...v }) => {
    const hasResumePdf = profileExports.some(
      (e) => e.export_type === "resume" && e.description?.includes(`(${v.slug})`)
    );
    const hasCvPdf = profileExports.some(
      (e) => e.export_type === "cv" && e.description?.includes(`(${v.slug})`)
    );
    return {
      ...v,
      extendsIds: exts?.map((e) => e.extended_id).filter((id): id is number => id !== null) ?? [],
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
        profile_id: profileId,
        date_created: new Date(),
      },
    });

    for (const parentId of extendsIds) {
      const parent = await db.query.profile_versions.findFirst({
        where: { id: parentId, profile_id: profileId },
      });
      if (parent) {
        await db.profile_version_extensions.create({
          data: {
            extender_id: created.id,
            extended_id: parentId,
          },
        });
      }
    }

    await requireCredits(user.id, 1);
    await chargeCredits(user.id, 1, "pdf_export", "PDF export");
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

    const version = await db.query.profile_versions.findFirst({
      where: { profile_id: profileId, slug },
    });
    if (!version) return fail(404, { error: "Version not found" });

    await requireCredits(user.id, 1);
    await chargeCredits(user.id, 1, "pdf_export", "PDF export");
    await generateVersionPdfs(profileId, slug);

    return { success: true, generatedSlug: slug };
  },
};
