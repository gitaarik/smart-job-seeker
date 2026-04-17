/**
 * Resume import functionality
 * Creates profile with all related data from parsed resume
 */

import { dbDirect } from "$lib/server/db";
import type {
  Certificate,
  Education,
  Language,
  ProfileImportResult,
  Reference,
  ResumeData,
  SideProject,
  SkillCategory,
  WorkExperience,
} from "./types";

function parseDate(value: string | undefined | null): Date | null {
  if (!value) return null;
  const d = new Date(value);
  return isNaN(d.getTime()) ? null : d;
}

/**
 * Create a new profile from resume data
 * @param data - Parsed resume data
 * @param userId - User ID to link the profile to
 * @param sourceFileId - Optional Directus file UUID of the source CV
 */
export async function createProfileFromResume(
  data: ResumeData,
  userId: string,
  sourceFileId?: string,
): Promise<ProfileImportResult> {
  if (!data.basics || !data.basics.name) {
    return {
      success: false,
      message: "Profile name is required",
      errors: ["Profile name is required"],
    };
  }

  // Generate unique slug
  let slug = data.basics.name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");

  let slugSuffix = 0;
  let finalSlug = slug;
  while (true) {
    const existing = await dbDirect.profiles.findFirst({
      where: { slug: finalSlug },
    });
    if (!existing) break;
    slugSuffix++;
    finalSlug = `${slug}-${slugSuffix}`;
  }

  // Create the profile
  const profile = await dbDirect.profiles.create({
    data: {
      name: data.basics.name,
      title: data.basics.title || null,
      slug: finalSlug,
      user_id: userId,
      is_default: false,
      location: data.basics.location || null,
      phone_number: data.basics.phone || null,
      email_address: data.basics.email || null,
      personal_website: data.basics.website || null,
      subtitle: data.basics.subtitle || null,
      core_stack: data.basics.coreStack || null,
      linkedin_profile: data.basics.linkedin || null,
      github_profile: data.basics.github || null,
      stackoverflow_profile: data.basics.stackoverflow || null,
      headline: data.basics.headline || null,
      summary: data.basics.summary || null,
      source_cv: sourceFileId || null,
      date_created: new Date(),
      date_updated: new Date(),
    },
  });

  const stats = {
    workExperiences: 0,
    education: 0,
    skillCategories: 0,
    totalSkills: 0,
    languages: 0,
    projects: 0,
    certificates: 0,
    references: 0,
  };
  const errors: string[] = [];

  // Import work experiences
  if (data.work && data.work.length > 0) {
    for (const work of data.work) {
      try {
        await createWorkExperience(profile.id, work);
        stats.workExperiences++;
      } catch (e) {
        const msg = `Failed to import work "${work.name}": ${e instanceof Error ? e.message : String(e)}`;
        console.error("[Resume Import]", msg);
        errors.push(msg);
      }
    }
  }

  // Import education
  if (data.education && data.education.length > 0) {
    for (const edu of data.education) {
      try {
        await createEducation(profile.id, edu);
        stats.education++;
      } catch (e) {
        const msg = `Failed to import education "${edu.institution}": ${e instanceof Error ? e.message : String(e)}`;
        console.error("[Resume Import]", msg);
        errors.push(msg);
      }
    }
  }

  // Import skill categories
  if (data.skills && data.skills.length > 0) {
    for (const category of data.skills) {
      try {
        const skillCount = await createSkillCategory(profile.id, category);
        stats.skillCategories++;
        stats.totalSkills += skillCount;
      } catch (e) {
        const msg = `Failed to import skill category "${category.name}": ${e instanceof Error ? e.message : String(e)}`;
        console.error("[Resume Import]", msg);
        errors.push(msg);
      }
    }
  }

  // Import languages
  if (data.languages && data.languages.length > 0) {
    for (const lang of data.languages) {
      try {
        await createLanguage(profile.id, lang);
        stats.languages++;
      } catch (e) {
        const msg = `Failed to import language "${lang.name}": ${e instanceof Error ? e.message : String(e)}`;
        console.error("[Resume Import]", msg);
        errors.push(msg);
      }
    }
  }

  // Import side projects
  if (data.projects && data.projects.length > 0) {
    for (const project of data.projects) {
      try {
        await createSideProject(profile.id, project);
        stats.projects++;
      } catch (e) {
        const msg = `Failed to import project "${project.name}": ${e instanceof Error ? e.message : String(e)}`;
        console.error("[Resume Import]", msg);
        errors.push(msg);
      }
    }
  }

  // Import certificates
  if (data.certificates && data.certificates.length > 0) {
    for (const cert of data.certificates) {
      try {
        await createCertificate(profile.id, cert);
        stats.certificates++;
      } catch (e) {
        const msg = `Failed to import certificate "${cert.name}": ${e instanceof Error ? e.message : String(e)}`;
        console.error("[Resume Import]", msg);
        errors.push(msg);
      }
    }
  }

  // Import references
  if (data.references && data.references.length > 0) {
    for (const ref of data.references) {
      try {
        await createReference(profile.id, ref);
        stats.references++;
      } catch (e) {
        const msg = `Failed to import reference by "${ref.author}": ${e instanceof Error ? e.message : String(e)}`;
        console.error("[Resume Import]", msg);
        errors.push(msg);
      }
    }
  }

  if (errors.length > 0) {
    console.warn(
      `[Resume Import] Profile ${profile.id} created with ${errors.length} import errors`,
    );
  }

  return {
    success: true,
    profileId: profile.id,
    message: errors.length > 0
      ? `Profile imported with ${errors.length} warning(s)`
      : "Profile imported successfully",
    stats,
    errors: errors.length > 0 ? errors : undefined,
  };
}

async function createWorkExperience(
  profileId: number,
  work: WorkExperience,
): Promise<void> {
  const createdWork = await dbDirect.work_experiences.create({
    data: {
      name: work.name,
      position: work.position,
      location: work.location || "",
      description: "", // Field deprecated
      summary: work.summary || "",
      website: work.website || null,
      start_date: parseDate(work.startDate),
      end_date: parseDate(work.endDate),
      status: "draft",
      profiles: {
        connect: { id: profileId },
      },
    },
  });

  if (work.achievements && work.achievements.length > 0) {
    let sort = 1;
    for (const achievement of work.achievements) {
      await dbDirect.work_experience_achievements.create({
        data: {
          description: achievement,
          status: "draft",
          sort,
          work_experiences: {
            connect: { id: createdWork.id },
          },
        },
      });
      sort++;
    }
  }

  if (work.technologies && work.technologies.length > 0) {
    let sort = 1;
    for (const tech of work.technologies) {
      await dbDirect.work_experience_technologies.create({
        data: {
          name: tech,
          status: "draft",
          sort,
          work_experiences: {
            connect: { id: createdWork.id },
          },
        },
      });
      sort++;
    }
  }
}

async function createEducation(
  profileId: number,
  edu: Education,
): Promise<void> {
  await dbDirect.education.create({
    data: {
      institution: edu.institution,
      area: edu.area || null,
      study_type: edu.studyType || null,
      location: edu.location || null,
      url: edu.url || null,
      start_date: parseDate(edu.startDate),
      end_date: parseDate(edu.endDate),
      graduation_year: edu.graduationYear || null,
      summary: edu.summary || null,
      status: "draft",
      profiles: {
        connect: { id: profileId },
      },
    },
  });
}

async function createSkillCategory(
  profileId: number,
  category: SkillCategory,
): Promise<number> {
  const createdCategory = await dbDirect.tech_skill_categories.create({
    data: {
      name: category.name,
      status: "draft",
      profiles: {
        connect: { id: profileId },
      },
    },
  });

  let skillCount = 0;
  if (category.skills && category.skills.length > 0) {
    let sort = 1;
    for (const skill of category.skills) {
      await dbDirect.tech_skills.create({
        data: {
          name: skill.name,
          level: skill.level || null,
          years_experience: skill.yearsExperience || null,
          status: "draft",
          sort,
          tech_skill_categories: {
            connect: { id: createdCategory.id },
          },
        },
      });
      sort++;
      skillCount++;
    }
  }

  return skillCount;
}

async function createLanguage(
  profileId: number,
  lang: Language,
): Promise<void> {
  await dbDirect.languages.create({
    data: {
      name: lang.name,
      language_code: lang.languageCode || null,
      proficiency: lang.proficiency || null,
      status: "draft",
      profiles: {
        connect: { id: profileId },
      },
    },
  });
}

async function createSideProject(
  profileId: number,
  project: SideProject,
): Promise<void> {
  const createdProject = await dbDirect.side_projects.create({
    data: {
      name: project.name,
      url: project.url || null,
      url_label: project.urlLabel || null,
      summary: project.summary || null,
      start_date: parseDate(project.startDate),
      end_date: parseDate(project.endDate),
      stars: project.stars || null,
      status: "draft",
      profiles: {
        connect: { id: profileId },
      },
    },
  });

  if (project.achievements && project.achievements.length > 0) {
    let sort = 1;
    for (const achievement of project.achievements) {
      await dbDirect.side_project_achievements.create({
        data: {
          description: achievement,
          sort,
          side_projects: {
            connect: { id: createdProject.id },
          },
        },
      });
      sort++;
    }
  }

  if (project.technologies && project.technologies.length > 0) {
    let sort = 1;
    for (const tech of project.technologies) {
      await dbDirect.side_project_technologies.create({
        data: {
          name: tech,
          sort,
          side_projects: {
            connect: { id: createdProject.id },
          },
        },
      });
      sort++;
    }
  }
}

async function createCertificate(
  profileId: number,
  cert: Certificate,
): Promise<void> {
  await dbDirect.certificates.create({
    data: {
      name: cert.name,
      issuer: cert.issuer || null,
      date: parseDate(cert.date),
      url: cert.url || null,
      status: "draft",
      sort: 0,
      date_created: new Date(),
      profiles: {
        connect: { id: profileId },
      },
    },
  });
}

async function createReference(
  profileId: number,
  ref: Reference,
): Promise<void> {
  await dbDirect.references.create({
    data: {
      author: ref.author,
      author_position: ref.authorPosition || null,
      text: ref.text,
      status: "draft",
      profiles: {
        connect: { id: profileId },
      },
    },
  });
}
