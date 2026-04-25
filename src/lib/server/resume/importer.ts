/**
 * Resume import functionality
 * Creates profile with all related data from parsed resume
 */

import { dbDirect } from "$lib/server/db";
import { eq } from "drizzle-orm";
import {
  profiles, profile_versions, work_experiences, work_experience_achievements, work_experience_technologies,
  education, tech_skill_categories, tech_skills,
  languages, side_projects, side_project_achievements, side_project_technologies,
  certificates, references,
} from "$lib/server/db/schema";
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
 * @param sourceFileId - Optional file UUID of the source CV
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
    const existing = await dbDirect.query.profiles.findFirst({
      where: eq(profiles.slug, finalSlug),
    });
    if (!existing) break;
    slugSuffix++;
    finalSlug = `${slug}-${slugSuffix}`;
  }

  // Create the profile
  const [profile] = await dbDirect.insert(profiles).values({
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
  }).returning();

  // Create a default Resume / CV version
  await dbDirect.insert(profile_versions).values({
    slug: "default",
    name: "Default",
    profile_id: profile.id,
    date_created: new Date(),
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

async function createWorkExperience(profileId: number, work: WorkExperience): Promise<void> {
  const [createdWork] = await dbDirect.insert(work_experiences).values({
    profile_id: profileId,
    name: work.name,
    position: work.position,
    location: work.location || "",
    description: "",
    summary: work.summary || "",
    website: work.website || null,
    start_date: parseDate(work.startDate),
    end_date: parseDate(work.endDate),
    status: "draft",
  }).returning();

  if (work.achievements && work.achievements.length > 0) {
    let sort = 1;
    for (const achievement of work.achievements) {
      await dbDirect.insert(work_experience_achievements).values({
        work_experience_id: createdWork.id,
        description: achievement,
        status: "draft",
        sort,
      });
      sort++;
    }
  }

  if (work.technologies && work.technologies.length > 0) {
    let sort = 1;
    for (const tech of work.technologies) {
      await dbDirect.insert(work_experience_technologies).values({
        work_experience_id: createdWork.id,
        name: tech,
        status: "draft",
        sort,
      });
      sort++;
    }
  }
}

async function createEducation(profileId: number, edu: Education): Promise<void> {
  await dbDirect.insert(education).values({
    profile_id: profileId,
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
  });
}

async function createSkillCategory(profileId: number, category: SkillCategory): Promise<number> {
  const [createdCategory] = await dbDirect.insert(tech_skill_categories).values({
    profile_id: profileId,
    name: category.name,
    status: "draft",
  }).returning();

  let skillCount = 0;
  if (category.skills && category.skills.length > 0) {
    let sort = 1;
    for (const skill of category.skills) {
      await dbDirect.insert(tech_skills).values({
        category_id: createdCategory.id,
        name: skill.name,
        level: skill.level || null,
        years_experience: skill.yearsExperience || null,
        status: "draft",
        sort,
      });
      sort++;
      skillCount++;
    }
  }

  return skillCount;
}

async function createLanguage(profileId: number, lang: Language): Promise<void> {
  await dbDirect.insert(languages).values({
    profile_id: profileId,
    name: lang.name,
    language_code: lang.languageCode || null,
    proficiency: lang.proficiency || null,
    status: "draft",
  });
}

async function createSideProject(profileId: number, project: SideProject): Promise<void> {
  const [createdProject] = await dbDirect.insert(side_projects).values({
    profile_id: profileId,
    name: project.name,
    url: project.url || null,
    url_label: project.urlLabel || null,
    summary: project.summary || null,
    start_date: parseDate(project.startDate),
    end_date: parseDate(project.endDate),
    stars: project.stars || null,
    status: "draft",
  }).returning();

  if (project.achievements && project.achievements.length > 0) {
    let sort = 1;
    for (const achievement of project.achievements) {
      await dbDirect.insert(side_project_achievements).values({
        side_project_id: createdProject.id,
        description: achievement,
        sort,
      });
      sort++;
    }
  }

  if (project.technologies && project.technologies.length > 0) {
    let sort = 1;
    for (const tech of project.technologies) {
      await dbDirect.insert(side_project_technologies).values({
        side_project_id: createdProject.id,
        name: tech,
        sort,
      });
      sort++;
    }
  }
}

async function createCertificate(profileId: number, cert: Certificate): Promise<void> {
  await dbDirect.insert(certificates).values({
    profile: profileId,
    name: cert.name,
    issuer: cert.issuer || null,
    date: parseDate(cert.date),
    url: cert.url || null,
    status: "draft",
    sort: 0,
    date_created: new Date(),
  });
}

async function createReference(profileId: number, ref: Reference): Promise<void> {
  await dbDirect.insert(references).values({
    profile_id: profileId,
    author: ref.author,
    author_position: ref.authorPosition || null,
    text: ref.text,
    status: "draft",
  });
}
