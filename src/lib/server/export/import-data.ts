/**
 * Import export data (v2.0 format)
 */

import { sql, eq, and, ne, type SQL } from "drizzle-orm";
import { dbDirect } from "$lib/server/db";
import {
  profiles, highlights, education, languages, references, certificates,
  project_stories, cheat_sheets, salary_expectations,
  tech_skill_categories, tech_skills, tech_skill_types,
  work_experiences, work_experience_achievements, work_experience_technologies,
  work_experience_projects, work_experience_project_technologies,
  side_projects, side_project_achievements, side_project_technologies,
  profile_versions, profile_version_extensions,
  applications, application_letters, application_questions,
} from "$lib/server/db/schema";
import { generateVersionPdfs } from "$lib/server/profile/generate-version-pdfs";
import type {
  ExportData,
  ExportedProfileData,
  FullExportData,
} from "./types";

// Helper to convert JSON value for database insert
function toJsonValue(value: unknown): unknown | undefined {
  if (value === null || value === undefined) return undefined;
  return value as unknown;
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
  const whereClause = excludeProfileId
    ? and(eq(profiles.user_id, userId), ne(profiles.id, excludeProfileId))
    : eq(profiles.user_id, userId);

  const existingNames = await dbDirect.query.profiles.findMany({
    where: whereClause,
    columns: { name: true },
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
    const existingProfile = await dbDirect.query.profiles.findFirst({
      where: and(eq(profiles.id, overwriteProfileId), eq(profiles.user_id, userId)),
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
    await dbDirect.update(profiles).set(buildProfileUpdateData(p, finalName))
      .where(eq(profiles.id, overwriteProfileId));

    profileId = overwriteProfileId;
  } else {
    // Create new profile
    const baseName = p.name || "Imported Profile";
    finalName = await getUniqueProfileName(baseName, userId);

    // Generate unique slug
    const finalSlug = await generateUniqueSlug(finalName);

    const [profile] = await dbDirect.insert(profiles).values({
      user_id: userId,
      is_default: false,
      slug: finalSlug,
      ...buildProfileUpdateData(p, finalName),
      date_created: new Date(),
    }).returning();

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
  await dbDirect.delete(highlights).where(eq(highlights.profile_id, profileId));
  await dbDirect.delete(education).where(eq(education.profile_id, profileId));
  await dbDirect.delete(languages).where(eq(languages.profile_id, profileId));
  await dbDirect.delete(references).where(eq(references.profile_id, profileId));
  await dbDirect.delete(certificates).where(eq(certificates.profile, profileId));
  await dbDirect.delete(project_stories).where(eq(project_stories.profile_id, profileId));
  await dbDirect.delete(cheat_sheets).where(eq(cheat_sheets.profile_id, profileId));
  await dbDirect.delete(salary_expectations).where(eq(salary_expectations.profile_id, profileId));

  // Delete tech skills (need to delete skills before categories)
  const techCats = await dbDirect.query.tech_skill_categories.findMany({
    where: eq(tech_skill_categories.profile_id, profileId),
    columns: { id: true },
  });
  for (const cat of techCats) {
    await dbDirect.delete(tech_skills).where(eq(tech_skills.category_id, cat.id));
  }
  await dbDirect.delete(tech_skill_categories).where(eq(tech_skill_categories.profile_id, profileId));

  // Delete work experiences and children
  const workExps = await dbDirect.query.work_experiences.findMany({
    where: eq(work_experiences.profile_id, profileId),
    columns: { id: true },
  });
  for (const we of workExps) {
    await dbDirect.delete(work_experience_achievements).where(eq(work_experience_achievements.work_experience_id, we.id));
    await dbDirect.delete(work_experience_technologies).where(eq(work_experience_technologies.work_experience_id, we.id));
    const projects = await dbDirect.query.work_experience_projects.findMany({
      where: eq(work_experience_projects.work_experience_id, we.id),
      columns: { id: true },
    });
    for (const proj of projects) {
      await dbDirect.delete(work_experience_project_technologies).where(eq(work_experience_project_technologies.work_experience_project_id, proj.id));
    }
    await dbDirect.delete(work_experience_projects).where(eq(work_experience_projects.work_experience_id, we.id));
  }
  await dbDirect.delete(work_experiences).where(eq(work_experiences.profile_id, profileId));

  // Delete side projects and children
  const sideProjs = await dbDirect.query.side_projects.findMany({
    where: eq(side_projects.profile_id, profileId),
    columns: { id: true },
  });
  for (const sp of sideProjs) {
    await dbDirect.delete(side_project_achievements).where(eq(side_project_achievements.side_project_id, sp.id));
    await dbDirect.delete(side_project_technologies).where(eq(side_project_technologies.side_project_id, sp.id));
  }
  await dbDirect.delete(side_projects).where(eq(side_projects.profile_id, profileId));

  // Delete profile versions and extensions
  const vers = await dbDirect.query.profile_versions.findMany({
    where: eq(profile_versions.profile_id, profileId),
    columns: { id: true },
  });
  for (const v of vers) {
    await dbDirect.delete(profile_version_extensions).where(eq(profile_version_extensions.extender_id, v.id));
    await dbDirect.delete(profile_version_extensions).where(eq(profile_version_extensions.extended_id, v.id));
  }
  await dbDirect.delete(profile_versions).where(eq(profile_versions.profile_id, profileId));

  // Delete applications and children
  const apps = await dbDirect.query.applications.findMany({
    where: eq(applications.profile_id, profileId),
    columns: { id: true },
  });
  for (const app of apps) {
    await dbDirect.delete(application_letters).where(eq(application_letters.application_id, app.id));
    await dbDirect.delete(application_questions).where(eq(application_questions.application_id, app.id));
  }
  await dbDirect.delete(applications).where(eq(applications.profile_id, profileId));
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
    const existing = await dbDirect.query.profiles.findFirst({
      where: eq(profiles.slug, finalSlug),
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
    await dbDirect.insert(highlights).values({
      profile_id: profileId,
      status: h.status || "draft",
      sort: h.sort ?? null,
      text: h.text || null,
      fa_icon: h.fa_icon || null,
    });
  }

  // Education
  for (const e of p.education ?? []) {
    const [created] = await dbDirect.insert(education).values({
      profile_id: profileId,
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
    }).returning();
    // Track for media mapping
    if (e.logo_path) {
      mediaPathMapping.set(`education:${created.id}:logo_path`, e.logo_path);
    }
  }

  // Languages
  for (const l of p.languages ?? []) {
    await dbDirect.insert(languages).values({
      profile_id: profileId,
      status: l.status || "draft",
      sort: l.sort ?? null,
      name: l.name || null,
      language_code: l.language_code || null,
      proficiency: l.proficiency || null,
    });
  }

  // References
  for (const r of p.references ?? []) {
    await dbDirect.insert(references).values({
      profile_id: profileId,
      status: r.status || "draft",
      sort: r.sort ?? null,
      author: r.author || "",
      author_position: r.author_position || null,
      text: r.text || null,
    });
  }

  // Certificates
  for (const cert of p.certificates ?? []) {
    await dbDirect.insert(certificates).values({
      profile: profileId,
      status: cert.status || "draft",
      sort: cert.sort ?? null,
      name: cert.name || "",
      issuer: cert.issuer || null,
      date: cert.date ? new Date(cert.date) : null,
      url: cert.url || null,
      date_created: new Date(),
    });
  }

  // Tech skill categories + tech skills
  const techTypesList = await dbDirect.query.tech_skill_types.findMany({
    columns: { id: true, slug: true },
  });
  const techTypeBySlug = new Map(techTypesList.map((t) => [t.slug, t.id]));

  for (const cat of p.tech_skill_categories ?? []) {
    const [createdCat] = await dbDirect.insert(tech_skill_categories).values({
      profile_id: profileId,
      status: cat.status || "draft",
      sort: cat.sort ?? null,
      name: cat.name || null,
      fa_icon: cat.fa_icon || null,
    }).returning();

    for (const skill of cat.tech_skills ?? []) {
      await dbDirect.insert(tech_skills).values({
        category_id: createdCat.id,
        status: skill.status || "draft",
        sort: skill.sort ?? null,
        name: skill.name || null,
        years_experience: skill.years_experience
          ? parseInt(String(skill.years_experience))
          : null,
        level: skill.level || null,
        tech_type_id: skill.tech_type ? techTypeBySlug.get(skill.tech_type) ?? null : null,
      });
    }
  }

  // Work experiences + children
  for (const w of p.work_experiences ?? []) {
    const [createdWork] = await dbDirect.insert(work_experiences).values({
      profile_id: profileId,
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
    }).returning();

    // Track for media mapping
    if (w.logo_path) {
      mediaPathMapping.set(`work_experience:${createdWork.id}:logo_path`, w.logo_path);
    }

    for (const a of w.achievements ?? []) {
      await dbDirect.insert(work_experience_achievements).values({
        work_experience_id: createdWork.id,
        status: a.status || "draft",
        sort: a.sort ?? null,
        description: a.description || a.title || null,
        fa_icon: a.fa_icon || null,
        tags: toJsonValue(a.tags),
      });
    }

    for (const t of w.technologies ?? []) {
      await dbDirect.insert(work_experience_technologies).values({
        work_experience_id: createdWork.id,
        status: t.status || "draft",
        sort: t.sort ?? null,
        name: t.name || null,
      });
    }

    for (const proj of w.projects ?? []) {
      const [createdProj] = await dbDirect.insert(work_experience_projects).values({
        work_experience_id: createdWork.id,
        status: proj.status || "draft",
        sort: proj.sort ?? null,
        name: proj.name || null,
        url: proj.url || null,
        start_date: proj.start_date ? new Date(proj.start_date) : null,
        end_date: proj.end_date ? new Date(proj.end_date) : null,
        description: proj.description || null,
        outcome: proj.outcome || null,
      }).returning();

      for (const pt of proj.technologies ?? []) {
        await dbDirect.insert(work_experience_project_technologies).values({
          work_experience_project_id: createdProj.id,
          sort: pt.sort ?? null,
          name: pt.name || null,
        });
      }
    }
  }

  // Side projects + children
  for (const sp of p.side_projects ?? []) {
    const [createdSp] = await dbDirect.insert(side_projects).values({
      profile_id: profileId,
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
    }).returning();

    // Track for media mapping
    if (sp.image_path) {
      mediaPathMapping.set(`side_project:${createdSp.id}:image_path`, sp.image_path);
    }

    for (const a of sp.achievements ?? []) {
      await dbDirect.insert(side_project_achievements).values({
        side_project_id: createdSp.id,
        description: a.description || null,
        sort: a.sort ?? null,
      });
    }

    for (const t of sp.technologies ?? []) {
      await dbDirect.insert(side_project_technologies).values({
        side_project_id: createdSp.id,
        sort: t.sort ?? null,
        name: t.name || null,
      });
    }
  }

  // Profile versions + extensions
  const versionSlugToId = new Map<string, number>();

  for (const pv of p.profile_versions ?? []) {
    // Backward compat: old exports have name=slug, description=display name
    const slug = pv.slug || pv.name || null;
    const name = pv.slug ? (pv.name || null) : (pv.description || null);
    const [createdPv] = await dbDirect.insert(profile_versions).values({
      profile_id: profileId,
      status: pv.status || "draft",
      sort: pv.sort ?? null,
      slug: slug,
      name: name,
      toggles: toJsonValue(pv.toggles),
    }).returning();
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
        await dbDirect.insert(profile_version_extensions).values({
          extender_id: extenderId,
          extended_id: extendedId,
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
    await dbDirect.insert(project_stories).values({
      profile_id: profileId,
      sort: ps.sort ?? null,
      title: ps.title || null,
      situation: ps.situation || null,
      task: ps.task || null,
      action: ps.action || null,
      result: ps.result || null,
      reflection: ps.reflection || null,
      category: ps.category || null,
    });
  }

  // Cheat sheets
  for (const cs of data.cheat_sheets ?? []) {
    await dbDirect.insert(cheat_sheets).values({
      profile_id: profileId,
      sort: cs.sort ?? null,
      title: cs.title || null,
      content: cs.content || null,
    });
  }

  // Salary settings (new format)
  if (data.salary_settings) {
    const ss = data.salary_settings;
    await dbDirect.update(profiles).set({
      salary_base_rate: ss.base_rate ?? null,
      salary_currency: ss.currency ?? "EUR",
      salary_adjustments: ss.adjustments ? (ss.adjustments as unknown) : undefined,
      salary_region_overrides: ss.region_overrides ? (ss.region_overrides as unknown) : undefined,
    }).where(eq(profiles.id, profileId));
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
