import { dbDirect } from "$lib/server/db";
import { eq, and, ne } from "drizzle-orm";
import {
  profiles, highlights, education, languages, references, certificates,
  project_stories, cheat_sheets, salary_expectations,
  tech_skill_categories, tech_skills, tech_skill_types,
  work_experiences, work_experience_achievements, work_experience_technologies,
  work_experience_projects, work_experience_project_technologies,
  side_projects, side_project_achievements, side_project_technologies,
  profile_versions, profile_version_extensions,
} from "$lib/server/db/schema";
import type { ExportedProfile } from "./export-profile-json";
import { generateVersionPdfs } from "./generate-version-pdfs";
import { toDateString } from "$lib/tools/date-utils";

interface ImportOptions {
  overwriteProfileId?: number;
}

/**
 * Generate a unique profile name by appending a number suffix if needed.
 * @param excludeProfileId - Optional profile ID to exclude from uniqueness check (for overwrites)
 */
export async function getUniqueProfileName(
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

export async function importProfileFromJson(
  data: ExportedProfile,
  userId: string,
  options: ImportOptions = {},
): Promise<{ profileId: number; profileName: string }> {
  const p = data.profile;
  const { overwriteProfileId } = options;

  let profileId: number;
  let finalName: string;

  if (overwriteProfileId) {
    // Overwrite existing profile - delete all child records first
    const existingProfile = await dbDirect.query.profiles.findFirst({
      where: and(eq(profiles.id, overwriteProfileId), eq(profiles.user_id, userId)),
    });

    if (!existingProfile) {
      throw new Error("Profile not found or not owned by user");
    }

    // Delete all child records (cascade doesn't always work for all relations)
    await dbDirect.delete(highlights).where(eq(highlights.profile_id, overwriteProfileId));
    await dbDirect.delete(education).where(eq(education.profile_id, overwriteProfileId));
    await dbDirect.delete(languages).where(eq(languages.profile_id, overwriteProfileId));
    await dbDirect.delete(references).where(eq(references.profile_id, overwriteProfileId));
    await dbDirect.delete(certificates).where(eq(certificates.profile, overwriteProfileId));
    await dbDirect.delete(project_stories).where(eq(project_stories.profile_id, overwriteProfileId));
    await dbDirect.delete(cheat_sheets).where(eq(cheat_sheets.profile_id, overwriteProfileId));
    await dbDirect.delete(salary_expectations).where(eq(salary_expectations.profile_id, overwriteProfileId));

    // Delete tech skills (need to delete skills before categories)
    const techCats = await dbDirect.query.tech_skill_categories.findMany({
      where: eq(tech_skill_categories.profile_id, overwriteProfileId),
      columns: { id: true },
    });
    for (const cat of techCats) {
      await dbDirect.delete(tech_skills).where(eq(tech_skills.category_id, cat.id));
    }
    await dbDirect.delete(tech_skill_categories).where(eq(tech_skill_categories.profile_id, overwriteProfileId));

    // Delete work experiences and children
    const workExps = await dbDirect.query.work_experiences.findMany({
      where: eq(work_experiences.profile_id, overwriteProfileId),
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
    await dbDirect.delete(work_experiences).where(eq(work_experiences.profile_id, overwriteProfileId));

    // Delete side projects and children
    const sideProjs = await dbDirect.query.side_projects.findMany({
      where: eq(side_projects.profile_id, overwriteProfileId),
      columns: { id: true },
    });
    for (const sp of sideProjs) {
      await dbDirect.delete(side_project_achievements).where(eq(side_project_achievements.side_project_id, sp.id));
      await dbDirect.delete(side_project_technologies).where(eq(side_project_technologies.side_project_id, sp.id));
    }
    await dbDirect.delete(side_projects).where(eq(side_projects.profile_id, overwriteProfileId));

    // Delete profile versions and extensions
    const vers = await dbDirect.query.profile_versions.findMany({
      where: eq(profile_versions.profile_id, overwriteProfileId),
      columns: { id: true },
    });
    for (const v of vers) {
      await dbDirect.delete(profile_version_extensions).where(eq(profile_version_extensions.extender_id, v.id));
      await dbDirect.delete(profile_version_extensions).where(eq(profile_version_extensions.extended_id, v.id));
    }
    await dbDirect.delete(profile_versions).where(eq(profile_versions.profile_id, overwriteProfileId));

    // Update the profile itself with deduplicated name
    const baseName = p.name || existingProfile.name || "Imported Profile";
    finalName = await getUniqueProfileName(baseName, userId, overwriteProfileId);
    await dbDirect.update(profiles).set({
      name: finalName,
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
      date_updated: new Date(),
    }).where(eq(profiles.id, overwriteProfileId));

    profileId = overwriteProfileId;
  } else {
    // Create new profile with deduplicated name
    const baseName = p.name || "Imported Profile";
    finalName = await getUniqueProfileName(baseName, userId);

    // Generate unique slug
    const baseSlug = finalName
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

    // Create profile
    const [profile] = await dbDirect.insert(profiles).values({
      user_id: userId,
      is_default: false,
      slug: finalSlug,
      name: finalName,
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
      date_created: new Date(),
      date_updated: new Date(),
    }).returning();

    profileId = profile.id;
  }

  // Highlights
  for (const h of p.highlights ?? []) {
    await dbDirect.insert(highlights).values({ profile_id: profileId, status: h.status || "draft", sort: h.sort ?? null, text: h.text || null, fa_icon: h.fa_icon || null });
  }

  // Education
  for (const e of p.education ?? []) {
    await dbDirect.insert(education).values({ profile_id: profileId, status: e.status || "draft", sort: e.sort ?? null, institution: e.institution || null, location: e.location || null, url: e.url || null, area: e.area || null, study_type: e.study_type || null, graduation_year: e.graduation_year ?? null, start_date: toDateString(e.start_date), end_date: toDateString(e.end_date), summary: e.summary || null, tags: e.tags ?? null });
  }

  // Languages
  for (const l of p.languages ?? []) {
    await dbDirect.insert(languages).values({ profile_id: profileId, status: l.status || "draft", sort: l.sort ?? null, name: l.name || null, language_code: l.language_code || null, proficiency: l.proficiency || null });
  }

  // References
  for (const r of p.references ?? []) {
    await dbDirect.insert(references).values({ profile_id: profileId, status: r.status || "draft", sort: r.sort ?? null, author: r.author || "", author_position: r.author_position || null, text: r.text || null });
  }

  // Certificates
  for (const cert of p.certificates ?? []) {
    await dbDirect.insert(certificates).values({ profile: profileId, status: cert.status || "draft", sort: cert.sort ?? null, name: cert.name || "", issuer: cert.issuer || null, date: toDateString(cert.date), url: cert.url || null, date_created: new Date() });
  }

  // Project stories
  for (const ps of p.project_stories ?? []) {
    await dbDirect.insert(project_stories).values({ profile_id: profileId, sort: ps.sort ?? null, title: ps.title || null, situation: ps.situation || null, task: ps.task || null, action: ps.action || null, result: ps.result || null, reflection: ps.reflection || null, category: ps.category || null });
  }

  // Cheat sheets
  for (const cs of p.cheat_sheets ?? []) {
    await dbDirect.insert(cheat_sheets).values({ profile_id: profileId, sort: cs.sort ?? null, title: cs.title || null, content: cs.content || null });
  }

  // Salary expectations
  for (const se of p.salary_expectations ?? []) {
    await dbDirect.insert(salary_expectations).values({ profile_id: profileId, sort: se.sort ?? null, job_title: se.job_title || null, company_type: se.company_type || "", employment_type: se.employment_type || "", work_arrangement: se.work_arrangement || "", experience_level: se.experience_level || null, region: se.region || "", hourly_rate: se.hourly_rate ?? null, month_salary: se.month_salary ?? null, year_salary: se.year_salary ?? null, daily_rate: se.daily_rate ?? null });
  }

  // Tech skill categories + tech skills
  const techTypesList = await dbDirect.query.tech_skill_types.findMany({ columns: { id: true, slug: true } });
  const techTypeBySlug = new Map(techTypesList.map((t) => [t.slug, t.id]));

  for (const cat of p.tech_skill_categories ?? []) {
    const [createdCat] = await dbDirect.insert(tech_skill_categories).values({ profile_id: profileId, status: cat.status || "draft", sort: cat.sort ?? null, name: cat.name || null, fa_icon: cat.fa_icon || null }).returning();

    for (const skill of cat.tech_skills ?? []) {
      await dbDirect.insert(tech_skills).values({ category_id: createdCat.id, status: skill.status || "draft", sort: skill.sort ?? null, name: skill.name || null, years_experience: skill.years_experience ? parseInt(String(skill.years_experience)) : null, level: skill.level || null, tech_type_id: skill.tech_type ? techTypeBySlug.get(skill.tech_type) ?? null : null });
    }
  }

  // Work experiences + children
  for (const w of p.work_experiences ?? []) {
    const [createdWork] = await dbDirect.insert(work_experiences).values({ profile_id: profileId, name: w.name || "", location: w.location || "", description: "", position: w.position || "", summary: w.summary || "", status: w.status || "draft", sort: w.sort ?? null, start_date: toDateString(w.start_date), end_date: toDateString(w.end_date), website: w.website || null, tags: w.tags ?? null }).returning();

    for (const a of w.achievements ?? []) {
      await dbDirect.insert(work_experience_achievements).values({ work_experience_id: createdWork.id, status: a.status || "draft", sort: a.sort ?? null, description: a.description || a.title || null, fa_icon: a.fa_icon || null, tags: a.tags ?? null });
    }

    for (const t of w.technologies ?? []) {
      await dbDirect.insert(work_experience_technologies).values({ work_experience_id: createdWork.id, status: t.status || "draft", sort: t.sort ?? null, name: t.name || null });
    }

    for (const proj of w.projects ?? []) {
      const [createdProj] = await dbDirect.insert(work_experience_projects).values({ work_experience_id: createdWork.id, status: proj.status || "draft", sort: proj.sort ?? null, name: proj.name || null, url: proj.url || null, start_date: toDateString(proj.start_date), end_date: toDateString(proj.end_date), description: proj.description || null, outcome: proj.outcome || null }).returning();

      for (const pt of proj.work_experience_project_technologies ?? []) {
        await dbDirect.insert(work_experience_project_technologies).values({ work_experience_project_id: createdProj.id, sort: pt.sort ?? null, name: pt.name || null });
      }
    }
  }

  // Side projects + children
  for (const sp of p.side_projects ?? []) {
    const [createdSp] = await dbDirect.insert(side_projects).values({ profile_id: profileId, status: sp.status || "draft", sort: sp.sort ?? null, name: sp.name || null, start_date: toDateString(sp.start_date), end_date: toDateString(sp.end_date), url: sp.url || null, stars: sp.stars ?? null, summary: sp.summary || null, url_label: sp.url_label || null, tags: sp.tags ?? null }).returning();

    for (const a of sp.achievements ?? []) {
      await dbDirect.insert(side_project_achievements).values({ side_project_id: createdSp.id, description: a.description || null, sort: a.sort ?? null });
    }

    for (const t of sp.technologies ?? []) {
      await dbDirect.insert(side_project_technologies).values({ side_project_id: createdSp.id, sort: t.sort ?? null, name: t.name || null });
    }
  }

  // Profile versions + extensions
  const versionSlugToId = new Map<string, number>();

  for (const pv of p.profile_versions ?? []) {
    const slug = pv.slug || pv.name || null;
    const name = pv.slug ? (pv.name || null) : (pv.description || null);
    const [createdPv] = await dbDirect.insert(profile_versions).values({ profile_id: profileId, status: pv.status || "draft", sort: pv.sort ?? null, slug: slug, name: name, toggles: pv.toggles ?? null }).returning();
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
        await dbDirect.insert(profile_version_extensions).values({ extender_id: extenderId, extended_id: extendedId });
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

  return { profileId, profileName: finalName };
}
