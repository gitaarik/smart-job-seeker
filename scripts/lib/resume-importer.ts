/**
 * Shared resume import functionality
 * Used by both JSON Resume and PDF resume importers
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
} from "./types/resume-import.types";

/**
 * Create a new profile from resume data
 * This is the core shared function used by all importers
 */
export async function createProfileFromResume(
  data: ResumeData,
): Promise<ProfileImportResult> {
  try {
    // Validate required fields
    if (!data.basics || !data.basics.name) {
      throw new Error("Profile name is required");
    }

    console.log("Creating profile...");

    // Create the profile
    const profile = await dbDirect.profiles.create({
      data: {
        name: data.basics.name,
        title: data.basics.title || null,
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
        date_created: new Date(),
        date_updated: new Date(),
      },
    });

    console.log(`✅ Profile created: ${profile.id}`);

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
      console.log(`Importing ${data.work.length} work experiences...`);
      for (const work of data.work) {
        await createWorkExperience(profile.id, work);
        stats.workExperiences++;
      }
      console.log(`✅ Work experiences: ${stats.workExperiences} created`);
    }

    // Import education
    if (data.education && data.education.length > 0) {
      console.log(`Importing ${data.education.length} education entries...`);
      for (const edu of data.education) {
        await createEducation(profile.id, edu);
        stats.education++;
      }
      console.log(`✅ Education: ${stats.education} created`);
    }

    // Import skill categories
    if (data.skills && data.skills.length > 0) {
      console.log(`Importing ${data.skills.length} skill categories...`);
      for (const category of data.skills) {
        const skillCount = await createSkillCategory(profile.id, category);
        stats.skillCategories++;
        stats.totalSkills += skillCount;
      }
      console.log(
        `✅ Skills: ${stats.skillCategories} categories, ${stats.totalSkills} total skills`,
      );
    }

    // Import languages
    if (data.languages && data.languages.length > 0) {
      console.log(`Importing ${data.languages.length} languages...`);
      for (const lang of data.languages) {
        await createLanguage(profile.id, lang);
        stats.languages++;
      }
      console.log(`✅ Languages: ${stats.languages} created`);
    }

    // Import side projects
    if (data.projects && data.projects.length > 0) {
      console.log(`Importing ${data.projects.length} side projects...`);
      for (const project of data.projects) {
        await createSideProject(profile.id, project);
        stats.projects++;
      }
      console.log(`✅ Side projects: ${stats.projects} created`);
    }

    // Import references
    if (data.references && data.references.length > 0) {
      console.log(`Importing ${data.references.length} references...`);
      for (const ref of data.references) {
        await createReference(profile.id, ref);
        stats.references++;
      }
      console.log(`✅ References: ${stats.references} created`);
    }

    console.log("\n✅ Profile import completed successfully!");
    console.log(`📊 Summary:`);
    console.log(`   - Profile ID: ${profile.id}`);
    console.log(`   - Work experiences: ${stats.workExperiences}`);
    console.log(`   - Education: ${stats.education}`);
    console.log(
      `   - Skills: ${stats.skillCategories} categories (${stats.totalSkills} total)`,
    );
    console.log(`   - Languages: ${stats.languages}`);
    console.log(`   - Projects: ${stats.projects}`);
    console.log(`   - References: ${stats.references}`);

    return {
      success: true,
      profileId: profile.id,
      message: "Profile imported successfully",
      stats,
    };
  } catch (error) {
    console.error("❌ Error importing profile:", error);
    return {
      success: false,
      message: error instanceof Error ? error.message : "Unknown error",
      errors: [error instanceof Error ? error.message : "Unknown error"],
    };
  }
}

/**
 * Create a work experience with achievements and technologies
 */
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

  // Create achievements
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

  // Create technologies
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

/**
 * Create an education entry
 */
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

/**
 * Create a skill category with individual skills
 * Returns the number of skills created
 */
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

/**
 * Create a language entry
 */
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

/**
 * Create a side project with achievements and technologies
 */
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

  // Create achievements
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

  // Create technologies
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

/**
 * Create a reference entry
 */
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
