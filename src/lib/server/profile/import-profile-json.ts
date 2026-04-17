import { dbDirect } from "$lib/server/db";
import type { ExportedProfile } from "./export-profile-json";
import { generateVersionPdfs } from "./generate-version-pdfs";

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
    await dbDirect.highlights.deleteMany({ where: { profile_id: overwriteProfileId } });
    await dbDirect.education.deleteMany({ where: { profile_id: overwriteProfileId } });
    await dbDirect.languages.deleteMany({ where: { profile_id: overwriteProfileId } });
    await dbDirect.references.deleteMany({ where: { profile_id: overwriteProfileId } });
    await dbDirect.certificates.deleteMany({ where: { profile: overwriteProfileId } });
    await dbDirect.project_stories.deleteMany({ where: { profile_id: overwriteProfileId } });
    await dbDirect.cheat_sheets.deleteMany({ where: { profile_id: overwriteProfileId } });
    await dbDirect.salary_expectations.deleteMany({ where: { profile_id: overwriteProfileId } });

    // Delete tech skills (need to delete skills before categories)
    const techCategories = await dbDirect.tech_skill_categories.findMany({
      where: { profile_id: overwriteProfileId },
      select: { id: true },
    });
    for (const cat of techCategories) {
      await dbDirect.tech_skills.deleteMany({ where: { category_id: cat.id } });
    }
    await dbDirect.tech_skill_categories.deleteMany({ where: { profile_id: overwriteProfileId } });

    // Delete work experiences and children
    const workExps = await dbDirect.work_experiences.findMany({
      where: { profile_id: overwriteProfileId },
      select: { id: true },
    });
    for (const we of workExps) {
      await dbDirect.work_experience_achievements.deleteMany({ where: { work_experience_id: we.id } });
      await dbDirect.work_experience_technologies.deleteMany({ where: { work_experience_id: we.id } });
      const projects = await dbDirect.work_experience_projects.findMany({
        where: { work_experience_id: we.id },
        select: { id: true },
      });
      for (const proj of projects) {
        await dbDirect.work_experience_project_technologies.deleteMany({ where: { work_experience_project_id: proj.id } });
      }
      await dbDirect.work_experience_projects.deleteMany({ where: { work_experience_id: we.id } });
    }
    await dbDirect.work_experiences.deleteMany({ where: { profile_id: overwriteProfileId } });

    // Delete side projects and children
    const sideProjs = await dbDirect.side_projects.findMany({
      where: { profile_id: overwriteProfileId },
      select: { id: true },
    });
    for (const sp of sideProjs) {
      await dbDirect.side_project_achievements.deleteMany({ where: { side_project_id: sp.id } });
      await dbDirect.side_project_technologies.deleteMany({ where: { side_project_id: sp.id } });
    }
    await dbDirect.side_projects.deleteMany({ where: { profile_id: overwriteProfileId } });

    // Delete profile versions and extensions
    const versions = await dbDirect.profile_versions.findMany({
      where: { profile_id: overwriteProfileId },
      select: { id: true },
    });
    for (const v of versions) {
      await dbDirect.profile_version_extensions.deleteMany({ where: { extender_id: v.id } });
      await dbDirect.profile_version_extensions.deleteMany({ where: { extended_id: v.id } });
    }
    await dbDirect.profile_versions.deleteMany({ where: { profile_id: overwriteProfileId } });

    // Update the profile itself with deduplicated name
    // Pass overwriteProfileId to exclude it from uniqueness check
    const baseName = p.name || existingProfile.name || "Imported Profile";
    finalName = await getUniqueProfileName(baseName, userId, overwriteProfileId);
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
        profile_id: profileId,
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
        tags: e.tags ?? null,
      },
    });
  }

  // Languages
  for (const l of p.languages ?? []) {
    await dbDirect.languages.create({
      data: {
        profile_id: profileId,
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
        profile_id: profileId,
        status: r.status || "draft",
        sort: r.sort ?? null,
        author: r.author || "",
        author_position: r.author_position || null,
        text: r.text || null,
      },
    });
  }

  // Certificates
  for (const cert of p.certificates ?? []) {
    await dbDirect.certificates.create({
      data: {
        profile: profileId,
        status: cert.status || "draft",
        sort: cert.sort ?? null,
        name: cert.name || "",
        issuer: cert.issuer || null,
        date: cert.date ? new Date(cert.date) : null,
        url: cert.url || null,
        date_created: new Date(),
      },
    });
  }

  // Project stories
  for (const ps of p.project_stories ?? []) {
    await dbDirect.project_stories.create({
      data: {
        profile_id: profileId,
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
        profile_id: profileId,
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
        profile_id: profileId,
        sort: se.sort ?? null,
        job_title: se.job_title || null,
        company_type: se.company_type || "",
        employment_type: se.employment_type || "",
        work_arrangement: se.work_arrangement || "",
        experience_level: se.experience_level || null,
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
        profile_id: profileId,
        status: cat.status || "draft",
        sort: cat.sort ?? null,
        name: cat.name || null,
        fa_icon: cat.fa_icon || null,
      },
    });

    for (const skill of cat.tech_skills ?? []) {
      await dbDirect.tech_skills.create({
        data: {
          category_id: createdCat.id,
          status: skill.status || "draft",
          sort: skill.sort ?? null,
          name: skill.name || null,
          years_experience: skill.years_experience
            ? parseInt(String(skill.years_experience))
            : null,
          level: skill.level || null,
          tech_type_id: skill.tech_type
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
        profile_id: profileId,
        name: w.name || "",
        location: w.location || "",
        description: "", // Field deprecated, kept for schema compatibility
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
          work_experience_id: createdWork.id,
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
          work_experience_id: createdWork.id,
          status: t.status || "draft",
          sort: t.sort ?? null,
          name: t.name || null,
        },
      });
    }

    for (const proj of w.projects ?? []) {
      const createdProj = await dbDirect.work_experience_projects.create({
        data: {
          work_experience_id: createdWork.id,
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
            work_experience_project_id: createdProj.id,
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
        tags: sp.tags ?? null,
      },
    });

    for (const a of sp.achievements ?? []) {
      await dbDirect.side_project_achievements.create({
        data: {
          side_project_id: createdSp.id,
          description: a.description || null,
          sort: a.sort ?? null,
        },
      });
    }

    for (const t of sp.technologies ?? []) {
      await dbDirect.side_project_technologies.create({
        data: {
          side_project_id: createdSp.id,
          sort: t.sort ?? null,
          name: t.name || null,
        },
      });
    }
  }

  // Profile versions + extensions
  // Create all versions first, then resolve extends_from references
  const versionSlugToId = new Map<string, number>();

  for (const pv of p.profile_versions ?? []) {
    // Backward compat: old exports have name=slug, description=display name
    const slug = pv.slug || pv.name || null;
    const name = pv.slug ? (pv.name || null) : (pv.description || null);
    const createdPv = await dbDirect.profile_versions.create({
      data: {
        profile_id: profileId,
        status: pv.status || "draft",
        sort: pv.sort ?? null,
        slug: slug,
        name: name,
        toggles: pv.toggles ?? null,
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
            extender_id: extenderId,
            extended_id: extendedId,
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

  return { profileId, profileName: finalName };
}
