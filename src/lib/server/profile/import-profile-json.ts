import { dbDirect } from "$lib/server/db";
import type { ExportedProfile } from "./export-profile-json";
import { generateVersionPdfs } from "./generate-version-pdfs";

interface ImportOptions {
  overwriteProfileId?: number;
}

/**
 * Generate a unique profile name by appending a number suffix if needed.
 */
export async function getUniqueProfileName(baseName: string, userId: string): Promise<string> {
  const existingNames = await dbDirect.profiles.findMany({
    where: { user_id: userId },
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
    const existingProfile = await dbDirect.profiles.findFirst({
      where: { id: overwriteProfileId, user_id: userId },
    });

    if (!existingProfile) {
      throw new Error("Profile not found or not owned by user");
    }

    // Delete all child records (cascade doesn't always work for all relations)
    await dbDirect.highlights.deleteMany({ where: { profile: overwriteProfileId } });
    await dbDirect.education.deleteMany({ where: { profile: overwriteProfileId } });
    await dbDirect.languages.deleteMany({ where: { profile: overwriteProfileId } });
    await dbDirect.references.deleteMany({ where: { profile: overwriteProfileId } });
    await dbDirect.project_stories.deleteMany({ where: { profile: overwriteProfileId } });
    await dbDirect.cheat_sheets.deleteMany({ where: { profile: overwriteProfileId } });
    await dbDirect.salary_expectations.deleteMany({ where: { profile: overwriteProfileId } });

    // Delete tech skills (need to delete skills before categories)
    const techCategories = await dbDirect.tech_skill_categories.findMany({
      where: { profile: overwriteProfileId },
      select: { id: true },
    });
    for (const cat of techCategories) {
      await dbDirect.tech_skills.deleteMany({ where: { category: cat.id } });
    }
    await dbDirect.tech_skill_categories.deleteMany({ where: { profile: overwriteProfileId } });

    // Delete work experiences and children
    const workExps = await dbDirect.work_experiences.findMany({
      where: { profile: overwriteProfileId },
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
        await dbDirect.work_experience_project_technologies.deleteMany({ where: { work_experience_project: proj.id } });
      }
      await dbDirect.work_experience_projects.deleteMany({ where: { work_experience: we.id } });
    }
    await dbDirect.work_experiences.deleteMany({ where: { profile: overwriteProfileId } });

    // Delete side projects and children
    const sideProjs = await dbDirect.side_projects.findMany({
      where: { profile: overwriteProfileId },
      select: { id: true },
    });
    for (const sp of sideProjs) {
      await dbDirect.side_project_achievements.deleteMany({ where: { side_project: sp.id } });
      await dbDirect.side_project_technologies.deleteMany({ where: { side_project: sp.id } });
    }
    await dbDirect.side_projects.deleteMany({ where: { profile: overwriteProfileId } });

    // Delete profile versions and extensions
    const versions = await dbDirect.profile_versions.findMany({
      where: { profile: overwriteProfileId },
      select: { id: true },
    });
    for (const v of versions) {
      await dbDirect.profile_version_extensions.deleteMany({ where: { extender: v.id } });
      await dbDirect.profile_version_extensions.deleteMany({ where: { extended: v.id } });
    }
    await dbDirect.profile_versions.deleteMany({ where: { profile: overwriteProfileId } });

    // Update the profile itself with deduplicated name
    const baseName = p.name || existingProfile.name || "Imported Profile";
    finalName = await getUniqueProfileName(baseName, userId);
    await dbDirect.profiles.update({
      where: { id: overwriteProfileId },
      data: {
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
      },
    });

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
      const existing = await dbDirect.profiles.findFirst({
        where: { slug: finalSlug },
      });
      if (!existing) break;
      slugSuffix++;
      finalSlug = `${baseSlug}-${slugSuffix}`;
    }

    // Create profile
    const profile = await dbDirect.profiles.create({
      data: {
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
      },
    });

    profileId = profile.id;
  }
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
    await dbDirect.education.create({
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
        tags: e.tags ?? null,
      },
    });
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

  // Project stories
  for (const ps of p.project_stories ?? []) {
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
  for (const cs of p.cheat_sheets ?? []) {
    await dbDirect.cheat_sheets.create({
      data: {
        profile: profileId,
        sort: cs.sort ?? null,
        title: cs.title || null,
        content: cs.content || null,
      },
    });
  }

  // Salary expectations
  for (const se of p.salary_expectations ?? []) {
    await dbDirect.salary_expectations.create({
      data: {
        profile: profileId,
        sort: se.sort ?? null,
        job_title: se.job_title || null,
        company_type: se.company_type || "",
        employment_type: se.employment_type || "",
        work_arrangement: se.work_arrangement || "",
        region: se.region || "",
        hourly_rate: se.hourly_rate ?? null,
        month_salary: se.month_salary ?? null,
        year_salary: se.year_salary ?? null,
        daily_rate: se.daily_rate ?? null,
      },
    });
  }

  // Tech skill categories + tech skills
  // Pre-fetch tech_skill_types for slug -> id resolution
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
          tech_type: skill.tech_type
            ? techTypeBySlug.get(skill.tech_type) ?? null
            : null,
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
        description: w.description || "",
        position: w.position || "",
        summary: w.summary || "",
        status: w.status || "draft",
        sort: w.sort ?? null,
        start_date: w.start_date ? new Date(w.start_date) : null,
        end_date: w.end_date ? new Date(w.end_date) : null,
        website: w.website || null,
        tags: w.tags ?? null,
      },
    });

    for (const a of w.achievements ?? []) {
      await dbDirect.work_experience_achievements.create({
        data: {
          work_experience: createdWork.id,
          status: a.status || "draft",
          sort: a.sort ?? null,
          title: a.title || null,
          description: a.description || null,
          fa_icon: a.fa_icon || null,
          tags: a.tags ?? null,
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

      for (const pt of proj.work_experience_project_technologies ?? []) {
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
        tags: sp.tags ?? null,
      },
    });

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
  // Create all versions first, then resolve extends_from references
  const versionNameToId = new Map<string, number>();

  for (const pv of p.profile_versions ?? []) {
    const createdPv = await dbDirect.profile_versions.create({
      data: {
        profile: profileId,
        status: pv.status || "draft",
        sort: pv.sort ?? null,
        name: pv.name || null,
        description: pv.description || null,
        toggles: pv.toggles ?? null,
      },
    });
    if (pv.name) {
      versionNameToId.set(pv.name, createdPv.id);
    }
  }

  // Create extensions (resolve extends_from name -> id)
  for (const pv of p.profile_versions ?? []) {
    if (pv.extends_from && pv.name) {
      const extenderId = versionNameToId.get(pv.name);
      const extendedId = versionNameToId.get(pv.extends_from);
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
    if (pv.name) {
      generateVersionPdfs(profileId, pv.name).catch(console.error);
    }
  }

  return { profileId, profileName: finalName };
}
