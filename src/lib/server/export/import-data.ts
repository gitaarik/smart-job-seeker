/**
 * Import export data (v2.0 format)
 */

import { Prisma } from "../../../../generated/prisma/client";
import { dbDirect } from "$lib/server/db";
import { generateVersionPdfs } from "$lib/server/profile/generate-version-pdfs";
import type {
  ExportData,
  ExportedProfileData,
  FullExportData,
} from "./types";

// Helper to convert JSON value for Prisma
function toJsonValue(value: unknown): Prisma.InputJsonValue | undefined {
  if (value === null || value === undefined) return undefined;
  return value as Prisma.InputJsonValue;
}

interface ImportOptions {
  overwriteProfileId?: number;
}

interface ImportResult {
  profileId: number;
  profileName: string;
  mediaPathMapping: Map<string, string>;
}

/**
 * Generate a unique profile name by appending a number suffix if needed.
 */
async function getUniqueProfileName(
  baseName: string,
  userId: string,
  excludeProfileId?: number,
): Promise<string> {
  const existingNames = await dbDirect.profiles.findMany({
    where: {
      user_id: userId,
      ...(excludeProfileId ? { id: { not: excludeProfileId } } : {}),
    },
    select: { name: true },
  });
  const nameSet = new Set(existingNames.map((r) => r.name));

  if (!nameSet.has(baseName)) {
    return baseName;
  }

  let suffix = 2;
  while (nameSet.has(`${baseName} ${suffix}`)) suffix++;
  return `${baseName} ${suffix}`;
}

/**
 * Import export data into the database
 */
export async function importExportData(
  data: ExportData,
  userId: string,
  options: ImportOptions = {},
): Promise<ImportResult> {
  const { overwriteProfileId } = options;
  const p = data.profile;

  let profileId: number;
  let finalName: string;

  // Track old path -> new path mapping for media files
  const mediaPathMapping = new Map<string, string>();

  if (overwriteProfileId) {
    // Overwrite existing profile - delete all child records first
    const existingProfile = await dbDirect.profiles.findFirst({
      where: { id: overwriteProfileId, user_id: userId },
    });

    if (!existingProfile) {
      throw new Error("Profile not found or not owned by user");
    }

    // Delete all child records
    await deleteProfileChildren(overwriteProfileId);

    // Generate unique name (excluding self)
    const baseName = p.name || existingProfile.name || "Imported Profile";
    finalName = await getUniqueProfileName(baseName, userId, overwriteProfileId);

    // Update the profile
    await dbDirect.profiles.update({
      where: { id: overwriteProfileId },
      data: buildProfileUpdateData(p, finalName),
    });

    profileId = overwriteProfileId;
  } else {
    // Create new profile
    const baseName = p.name || "Imported Profile";
    finalName = await getUniqueProfileName(baseName, userId);

    // Generate unique slug
    const finalSlug = await generateUniqueSlug(finalName);

    const profile = await dbDirect.profiles.create({
      data: {
        user_id: userId,
        is_default: false,
        slug: finalSlug,
        ...buildProfileUpdateData(p, finalName),
        date_created: new Date(),
      },
    });

    profileId = profile.id;
  }

  // Import profile-related entities
  await importProfileEntities(profileId, p, mediaPathMapping);

  // Import full account data if scope is "full"
  if (data.scope === "full") {
    await importFullAccountEntities(profileId, data as FullExportData);
  }

  return { profileId, profileName: finalName, mediaPathMapping };
}

/**
 * Delete all child records for a profile
 */
async function deleteProfileChildren(profileId: number): Promise<void> {
  // Delete simple child records
  await dbDirect.highlights.deleteMany({ where: { profile: profileId } });
  await dbDirect.education.deleteMany({ where: { profile: profileId } });
  await dbDirect.languages.deleteMany({ where: { profile: profileId } });
  await dbDirect.references.deleteMany({ where: { profile: profileId } });
  await dbDirect.project_stories.deleteMany({ where: { profile: profileId } });
  await dbDirect.cheat_sheets.deleteMany({ where: { profile: profileId } });
  await dbDirect.salary_expectations.deleteMany({ where: { profile: profileId } });

  // Delete tech skills (need to delete skills before categories)
  const techCategories = await dbDirect.tech_skill_categories.findMany({
    where: { profile: profileId },
    select: { id: true },
  });
  for (const cat of techCategories) {
    await dbDirect.tech_skills.deleteMany({ where: { category: cat.id } });
  }
  await dbDirect.tech_skill_categories.deleteMany({ where: { profile: profileId } });

  // Delete work experiences and children
  const workExps = await dbDirect.work_experiences.findMany({
    where: { profile: profileId },
    select: { id: true },
  });
  for (const we of workExps) {
    await dbDirect.work_experience_achievements.deleteMany({ where: { work_experience: we.id } });
    await dbDirect.work_experience_technologies.deleteMany({ where: { work_experience: we.id } });
    const projects = await dbDirect.work_experience_projects.findMany({
      where: { work_experience: we.id },
      select: { id: true },
    });
    for (const proj of projects) {
      await dbDirect.work_experience_project_technologies.deleteMany({
        where: { work_experience_project: proj.id },
      });
    }
    await dbDirect.work_experience_projects.deleteMany({ where: { work_experience: we.id } });
  }
  await dbDirect.work_experiences.deleteMany({ where: { profile: profileId } });

  // Delete side projects and children
  const sideProjs = await dbDirect.side_projects.findMany({
    where: { profile: profileId },
    select: { id: true },
  });
  for (const sp of sideProjs) {
    await dbDirect.side_project_achievements.deleteMany({ where: { side_project: sp.id } });
    await dbDirect.side_project_technologies.deleteMany({ where: { side_project: sp.id } });
  }
  await dbDirect.side_projects.deleteMany({ where: { profile: profileId } });

  // Delete profile versions and extensions
  const versions = await dbDirect.profile_versions.findMany({
    where: { profile: profileId },
    select: { id: true },
  });
  for (const v of versions) {
    await dbDirect.profile_version_extensions.deleteMany({ where: { extender: v.id } });
    await dbDirect.profile_version_extensions.deleteMany({ where: { extended: v.id } });
  }
  await dbDirect.profile_versions.deleteMany({ where: { profile: profileId } });

  // Delete applications and children
  const applications = await dbDirect.applications.findMany({
    where: { profile: profileId },
    select: { id: true },
  });
  for (const app of applications) {
    await dbDirect.application_letters.deleteMany({ where: { application: app.id } });
    await dbDirect.application_questions.deleteMany({ where: { application: app.id } });
  }
  await dbDirect.applications.deleteMany({ where: { profile: profileId } });
}

/**
 * Build profile update data object
 */
function buildProfileUpdateData(p: ExportedProfileData, name: string) {
  return {
    name,
    title: p.title || null,
    location: p.location || null,
    phone_number: p.phone_number || null,
    email_address: p.email_address || null,
    personal_website: p.personal_website || null,
    linkedin_profile: p.linkedin_profile || null,
    github_profile: p.github_profile || null,
    stackoverflow_profile: p.stackoverflow_profile || null,
    npm_profile: p.npm_profile || null,
    pypi_profile: p.pypi_profile || null,
    signal_profile: p.signal_profile || null,
    whatsapp_number: p.whatsapp_number || null,
    telegram_username: p.telegram_username || null,
    subtitle: p.subtitle || null,
    core_stack: p.core_stack || null,
    headline: p.headline || null,
    summary: p.summary || null,
    about_me_text: p.about_me_text || null,
    nationality: p.nationality || null,
    location_url: p.location_url || null,
    location_timezone: p.location_timezone || null,
    meta_image_url: p.meta_image_url || null,
    dev_start_year: p.dev_start_year ?? null,
    python_js_start_year: p.python_js_start_year ?? null,
    remote_start_year: p.remote_start_year ?? null,
    company_name: p.company_name || null,
    street_address: p.street_address || null,
    postal_code: p.postal_code || null,
    vat_id: p.vat_id || null,
    kvk_number: p.kvk_number || null,
    // Note: profile_photo_path is set later via media import
    date_updated: new Date(),
  };
}

/**
 * Generate a unique slug from a name
 */
async function generateUniqueSlug(name: string): Promise<string> {
  const baseSlug = name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");

  let slugSuffix = 0;
  let finalSlug = baseSlug;

  while (true) {
    const existing = await dbDirect.profiles.findFirst({
      where: { slug: finalSlug },
    });
    if (!existing) break;
    slugSuffix++;
    finalSlug = `${baseSlug}-${slugSuffix}`;
  }

  return finalSlug;
}

/**
 * Import profile-related entities (resume/CV data)
 */
async function importProfileEntities(
  profileId: number,
  p: ExportedProfileData,
  mediaPathMapping: Map<string, string>,
): Promise<void> {
  // Highlights
  for (const h of p.highlights ?? []) {
    await dbDirect.highlights.create({
      data: {
        profile: profileId,
        status: h.status || "draft",
        sort: h.sort ?? null,
        text: h.text || null,
        fa_icon: h.fa_icon || null,
      },
    });
  }

  // Education
  for (const e of p.education ?? []) {
    const created = await dbDirect.education.create({
      data: {
        profile: profileId,
        status: e.status || "draft",
        sort: e.sort ?? null,
        institution: e.institution || null,
        location: e.location || null,
        url: e.url || null,
        area: e.area || null,
        study_type: e.study_type || null,
        graduation_year: e.graduation_year ?? null,
        start_date: e.start_date ? new Date(e.start_date) : null,
        end_date: e.end_date ? new Date(e.end_date) : null,
        summary: e.summary || null,
        tags: toJsonValue(e.tags),
        // logo_path will be set via media import
      },
    });
    // Track for media mapping
    if (e.logo_path) {
      mediaPathMapping.set(`education:${created.id}:logo_path`, e.logo_path);
    }
  }

  // Languages
  for (const l of p.languages ?? []) {
    await dbDirect.languages.create({
      data: {
        profile: profileId,
        status: l.status || "draft",
        sort: l.sort ?? null,
        name: l.name || null,
        language_code: l.language_code || null,
        proficiency: l.proficiency || null,
      },
    });
  }

  // References
  for (const r of p.references ?? []) {
    await dbDirect.references.create({
      data: {
        profile: profileId,
        status: r.status || "draft",
        sort: r.sort ?? null,
        author: r.author || "",
        author_position: r.author_position || null,
        text: r.text || null,
      },
    });
  }

  // Tech skill categories + tech skills
  const techTypes = await dbDirect.tech_skill_types.findMany({
    select: { id: true, slug: true },
  });
  const techTypeBySlug = new Map(techTypes.map((t) => [t.slug, t.id]));

  for (const cat of p.tech_skill_categories ?? []) {
    const createdCat = await dbDirect.tech_skill_categories.create({
      data: {
        profile: profileId,
        status: cat.status || "draft",
        sort: cat.sort ?? null,
        name: cat.name || null,
        fa_icon: cat.fa_icon || null,
      },
    });

    for (const skill of cat.tech_skills ?? []) {
      await dbDirect.tech_skills.create({
        data: {
          category: createdCat.id,
          status: skill.status || "draft",
          sort: skill.sort ?? null,
          name: skill.name || null,
          years_experience: skill.years_experience
            ? parseInt(String(skill.years_experience))
            : null,
          level: skill.level || null,
          tech_type: skill.tech_type ? techTypeBySlug.get(skill.tech_type) ?? null : null,
        },
      });
    }
  }

  // Work experiences + children
  for (const w of p.work_experiences ?? []) {
    const createdWork = await dbDirect.work_experiences.create({
      data: {
        profile: profileId,
        name: w.name || "",
        location: w.location || "",
        description: "", // Field deprecated
        position: w.position || "",
        summary: w.summary || "",
        status: w.status || "draft",
        sort: w.sort ?? null,
        start_date: w.start_date ? new Date(w.start_date) : null,
        end_date: w.end_date ? new Date(w.end_date) : null,
        website: w.website || null,
        tags: toJsonValue(w.tags),
        // logo_path will be set via media import
      },
    });

    // Track for media mapping
    if (w.logo_path) {
      mediaPathMapping.set(`work_experience:${createdWork.id}:logo_path`, w.logo_path);
    }

    for (const a of w.achievements ?? []) {
      await dbDirect.work_experience_achievements.create({
        data: {
          work_experience: createdWork.id,
          status: a.status || "draft",
          sort: a.sort ?? null,
          title: a.title || null,
          description: a.description || null,
          fa_icon: a.fa_icon || null,
          tags: toJsonValue(a.tags),
        },
      });
    }

    for (const t of w.technologies ?? []) {
      await dbDirect.work_experience_technologies.create({
        data: {
          work_experience: createdWork.id,
          status: t.status || "draft",
          sort: t.sort ?? null,
          name: t.name || null,
        },
      });
    }

    for (const proj of w.projects ?? []) {
      const createdProj = await dbDirect.work_experience_projects.create({
        data: {
          work_experience: createdWork.id,
          status: proj.status || "draft",
          sort: proj.sort ?? null,
          name: proj.name || null,
          url: proj.url || null,
          start_date: proj.start_date ? new Date(proj.start_date) : null,
          end_date: proj.end_date ? new Date(proj.end_date) : null,
          description: proj.description || null,
          outcome: proj.outcome || null,
        },
      });

      for (const pt of proj.technologies ?? []) {
        await dbDirect.work_experience_project_technologies.create({
          data: {
            work_experience_project: createdProj.id,
            sort: pt.sort ?? null,
            name: pt.name || null,
          },
        });
      }
    }
  }

  // Side projects + children
  for (const sp of p.side_projects ?? []) {
    const createdSp = await dbDirect.side_projects.create({
      data: {
        profile: profileId,
        status: sp.status || "draft",
        sort: sp.sort ?? null,
        name: sp.name || null,
        start_date: sp.start_date ? new Date(sp.start_date) : null,
        end_date: sp.end_date ? new Date(sp.end_date) : null,
        url: sp.url || null,
        stars: sp.stars ?? null,
        summary: sp.summary || null,
        url_label: sp.url_label || null,
        tags: toJsonValue(sp.tags),
        // image_path will be set via media import
      },
    });

    // Track for media mapping
    if (sp.image_path) {
      mediaPathMapping.set(`side_project:${createdSp.id}:image_path`, sp.image_path);
    }

    for (const a of sp.achievements ?? []) {
      await dbDirect.side_project_achievements.create({
        data: {
          side_project: createdSp.id,
          description: a.description || null,
          sort: a.sort ?? null,
        },
      });
    }

    for (const t of sp.technologies ?? []) {
      await dbDirect.side_project_technologies.create({
        data: {
          side_project: createdSp.id,
          sort: t.sort ?? null,
          name: t.name || null,
        },
      });
    }
  }

  // Profile versions + extensions
  const versionSlugToId = new Map<string, number>();

  for (const pv of p.profile_versions ?? []) {
    // Backward compat: old exports have name=slug, description=display name
    const slug = pv.slug || pv.name || null;
    const name = pv.slug ? (pv.name || null) : (pv.description || null);
    const createdPv = await dbDirect.profile_versions.create({
      data: {
        profile: profileId,
        status: pv.status || "draft",
        sort: pv.sort ?? null,
        slug: slug,
        name: name,
        toggles: toJsonValue(pv.toggles),
      },
    });
    if (slug) {
      versionSlugToId.set(slug, createdPv.id);
    }
  }

  // Create extensions (resolve extends_from slug -> id)
  for (const pv of p.profile_versions ?? []) {
    const slug = pv.slug || pv.name;
    if (pv.extends_from && slug) {
      const extenderId = versionSlugToId.get(slug);
      const extendedId = versionSlugToId.get(pv.extends_from);
      if (extenderId && extendedId) {
        await dbDirect.profile_version_extensions.create({
          data: {
            extender: extenderId,
            extended: extendedId,
          },
        });
      }
    }
  }

  // Generate PDFs for all imported versions (fire-and-forget)
  for (const pv of p.profile_versions ?? []) {
    const slug = pv.slug || pv.name;
    if (slug) {
      generateVersionPdfs(profileId, slug).catch(console.error);
    }
  }

  // Track profile photo path for media import
  if (p.profile_photo_path) {
    mediaPathMapping.set(`profile:${profileId}:profile_photo_path`, p.profile_photo_path);
  }
}

/**
 * Import full account entities (beyond profile data)
 */
async function importFullAccountEntities(
  profileId: number,
  data: FullExportData,
): Promise<void> {
  // Project stories
  for (const ps of data.project_stories ?? []) {
    await dbDirect.project_stories.create({
      data: {
        profile: profileId,
        sort: ps.sort ?? null,
        title: ps.title || null,
        situation: ps.situation || null,
        task: ps.task || null,
        action: ps.action || null,
        result: ps.result || null,
        reflection: ps.reflection || null,
        category: ps.category || null,
      },
    });
  }

  // Cheat sheets
  for (const cs of data.cheat_sheets ?? []) {
    await dbDirect.cheat_sheets.create({
      data: {
        profile: profileId,
        sort: cs.sort ?? null,
        title: cs.title || null,
        content: cs.content || null,
      },
    });
  }

  // Salary settings (new format)
  if (data.salary_settings) {
    const ss = data.salary_settings;
    await dbDirect.profiles.update({
      where: { id: profileId },
      data: {
        salary_base_rate: ss.base_rate ?? null,
        salary_currency: ss.currency ?? "EUR",
        salary_adjustments: ss.adjustments ? (ss.adjustments as Prisma.InputJsonValue) : undefined,
        salary_region_overrides: ss.region_overrides ? (ss.region_overrides as Prisma.InputJsonValue) : undefined,
      },
    });
  }

  // Note: Applications are not imported by default as they reference external jobs
  // and may not make sense to duplicate. This could be made configurable.
}

/**
 * Check if export data is valid
 */
export function validateExportData(data: unknown): data is ExportData {
  if (!data || typeof data !== "object") return false;

  const d = data as Record<string, unknown>;

  // Check required fields
  if (d.version !== "2.0") return false;
  if (!["profile", "full"].includes(d.scope as string)) return false;
  if (typeof d.exported_at !== "string") return false;
  if (!d.profile || typeof d.profile !== "object") return false;

  return true;
}

/**
 * Check if data is legacy v1.0 format
 */
export function isLegacyFormat(data: unknown): boolean {
  if (!data || typeof data !== "object") return false;

  const d = data as Record<string, unknown>;

  // Legacy format has "profile" at root without version field
  return (
    d.profile !== undefined &&
    d.version === undefined &&
    typeof (d.profile as Record<string, unknown>).name === "string"
  );
}
