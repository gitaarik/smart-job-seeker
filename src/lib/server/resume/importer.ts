/**
 * Resume import functionality
 * Creates profile with all related data from parsed resume
 */

import { dbDirect } from "$lib/server/db";
import type {
  Education,
  Language,
  ProfileImportResult,
  Reference,
  ResumeData,
  SideProject,
  SkillCategory,
  WorkExperience,
} from "./types";

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
      location_city: data.basics.locationCity || null,
      location_region: data.basics.locationRegion || null,
      location_country_code: data.basics.locationCountryCode || null,
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
    references: 0,
  };

  // Import work experiences
  if (data.work && data.work.length > 0) {
    for (const work of data.work) {
      await createWorkExperience(profile.id, work);
      stats.workExperiences++;
    }
  }

  // Import education
  if (data.education && data.education.length > 0) {
    for (const edu of data.education) {
      await createEducation(profile.id, edu);
      stats.education++;
    }
  }

  // Import skill categories
  if (data.skills && data.skills.length > 0) {
    for (const category of data.skills) {
      const skillCount = await createSkillCategory(profile.id, category);
      stats.skillCategories++;
      stats.totalSkills += skillCount;
    }
  }

  // Import languages
  if (data.languages && data.languages.length > 0) {
    for (const lang of data.languages) {
      await createLanguage(profile.id, lang);
      stats.languages++;
    }
  }

  // Import side projects
  if (data.projects && data.projects.length > 0) {
    for (const project of data.projects) {
      await createSideProject(profile.id, project);
      stats.projects++;
    }
  }

  // Import references
  if (data.references && data.references.length > 0) {
    for (const ref of data.references) {
      await createReference(profile.id, ref);
      stats.references++;
    }
  }

  return {
    success: true,
    profileId: profile.id,
    message: "Profile imported successfully",
    stats,
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
      description: work.description || "",
      summary: work.summary || "",
      website: work.website || null,
      start_date: work.startDate ? new Date(work.startDate) : null,
      end_date: work.endDate ? new Date(work.endDate) : null,
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
          title: achievement,
          description: null,
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
      start_date: edu.startDate ? new Date(edu.startDate) : null,
      end_date: edu.endDate ? new Date(edu.endDate) : null,
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
      start_date: project.startDate ? new Date(project.startDate) : null,
      end_date: project.endDate ? new Date(project.endDate) : null,
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
