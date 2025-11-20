#!/usr/bin/env node

import { PrismaClient } from "@prisma/client";
import { readFileSync } from "fs";
import { v4 as uuidv4 } from "uuid";

const prisma = new PrismaClient();

interface ImportedProfile {
  profile: {
    name?: string;
    title?: string;
    location?: string;
    phone_number?: string;
    email_address?: string;
    personal_website?: string;
    subtitle?: string;
    core_stack?: string;
    linkedin_profile?: string;
    github_profile?: string;
    stackoverflow_profile?: string;
    headline?: string;
    summary?: string;
    nationality?: string;
    location_url?: string;
    location_timezone?: string;
    profile_versions: Array<{
      status?: string;
      sort?: number | null;
      name?: string;
      description?: string;
      toggles?: any;
      extends_from?: string | null;
    }>;
    highlights: Array<{
      status?: string;
      sort?: number | null;
      text?: string;
      fa_icon?: string;
    }>;
    tech_skill_categories: Array<{
      status?: string;
      sort?: number | null;
      name?: string;
      fa_icon?: string;
      tech_skills: Array<{
        status?: string;
        sort?: number | null;
        name?: string;
        years_experience?: string;
        level?: string;
        tech_type?: string | null;
      }>;
    }>;
    work_experiences: Array<{
      name?: string;
      location?: string;
      description?: string;
      position?: string;
      summary?: string;
      status?: string;
      sort?: number | null;
      start_date?: string;
      end_date?: string;
      website?: string;
      tags?: any;
      achievements: Array<{
        status?: string;
        sort?: number | null;
        title?: string;
        description?: string;
        fa_icon?: string;
        tags?: any;
      }>;
      technologies: Array<{
        status?: string;
        sort?: number | null;
        name?: string;
      }>;
      projects: Array<{
        status?: string;
        sort?: number | null;
        name: string;
        url?: string;
        start_date?: string;
        end_date?: string;
        description?: string;
        outcome?: string;
        work_experience_project_technologies: Array<{
          sort?: number | null;
          name?: string;
        }>;
      }>;
    }>;
    side_projects: Array<{
      status?: string;
      sort?: number | null;
      name?: string;
      start_date?: string;
      end_date?: string;
      url?: string;
      stars?: number | null;
      summary?: string;
      url_label?: string;
      tags?: any;
      achievements: Array<{
        title?: string;
        fa_icon?: string;
        description?: string;
        status?: string;
        sort?: number | null;
      }>;
      technologies: Array<{
        status?: string;
        sort?: number | null;
        name?: string;
      }>;
    }>;
    education: Array<{
      status?: string;
      sort?: number | null;
      institution?: string;
      location?: string;
      url?: string;
      area?: string;
      study_type?: string;
      graduation_year?: number | null;
      start_date?: string;
      end_date?: string;
      summary?: string;
      tags?: any;
    }>;
    languages: Array<{
      status?: string;
      sort?: number | null;
      name?: string;
      language_code?: string;
      proficiency?: string;
    }>;
    references: Array<{
      status?: string;
      sort?: number | null;
      author?: string;
      author_position?: string;
      text?: string;
    }>;
    project_stories: Array<{
      sort?: number | null;
      title?: string;
      situation?: string;
      task?: string;
      action?: string;
      result?: string;
      reflection?: string;
      category?: string;
    }>;
    application_questions: Array<{
      sort?: number | null;
      question?: string;
      answer?: string;
      title?: string;
      source?: string;
    }>;
    cheat_sheets: Array<{
      sort?: number | null;
      title?: string;
      content?: string;
    }>;
    salary_expectations?: Array<{
      sort?: number | null;
      job_title?: string;
      company_type?: string;
      employment_type?: string;
      work_arrangement?: string;
      region?: string;
      hourly_rate?: number | null;
      month_salary?: number | null;
      year_salary?: number | null;
      daily_rate?: number | null;
    }>;
  };
}

async function importProfile(
  filePath: string,
  profileId?: string,
  deleteExisting: boolean = false,
): Promise<void> {
  try {
    console.log(`Importing profile from: ${filePath}`);

    // Read and parse the JSON file
    const fileContent = readFileSync(filePath, "utf-8");
    const importData: ImportedProfile = JSON.parse(fileContent);

    // Validate data structure
    if (!importData.profile) {
      throw new Error("Invalid import file: missing profile object");
    }

    const data = importData.profile;

    // If updating existing profile
    if (profileId) {
      const existingProfile = await prisma.profiles.findUnique({
        where: { id: profileId },
      });

      if (!existingProfile) {
        throw new Error(`Profile not found: ${profileId}`);
      }

      if (deleteExisting) {
        console.log("Deleting existing related data...");
        // Delete all related data for this profile
        await Promise.all([
          prisma.profile_versions.deleteMany({ where: { profile: profileId } }),
          prisma.highlights.deleteMany({ where: { profile: profileId } }),
          prisma.work_experience_project_technologies.deleteMany({
            where: { work_experience_projects: { work_experiences: { profile: profileId } } },
          }),
          prisma.work_experience_projects.deleteMany({
            where: { work_experiences: { profile: profileId } },
          }),
          prisma.work_experience_achievements.deleteMany({
            where: { work_experiences: { profile: profileId } },
          }),
          prisma.work_experience_technologies.deleteMany({
            where: { work_experiences: { profile: profileId } },
          }),
          prisma.work_experiences.deleteMany({ where: { profile: profileId } }),
          prisma.side_project_achievements.deleteMany({
            where: { side_projects: { profile: profileId } },
          }),
          prisma.side_project_technologies.deleteMany({
            where: { side_projects: { profile: profileId } },
          }),
          prisma.side_projects.deleteMany({ where: { profile: profileId } }),
          prisma.education.deleteMany({ where: { profile: profileId } }),
          prisma.languages.deleteMany({ where: { profile: profileId } }),
          prisma.references.deleteMany({ where: { profile: profileId } }),
          prisma.project_stories.deleteMany({ where: { profile: profileId } }),
          prisma.application_questions.deleteMany({
            where: { profile: profileId },
          }),
          prisma.cheat_sheets.deleteMany({ where: { profile: profileId } }),
          prisma.tech_skill_categories.deleteMany({
            where: { profile: profileId },
          }),
        ]);
      }

      console.log(`Updating profile: ${profileId}`);
    } else {
      console.log(`Creating new profile`);
    }

    let profile;

    if (profileId) {
      // Upsert the profile
      profile = await prisma.profiles.update({
        where: { id: profileId },
        data: {
          name: data.name,
          title: data.title,
          location: data.location,
          phone_number: data.phone_number,
          email_address: data.email_address,
          personal_website: data.personal_website,
          subtitle: data.subtitle,
          core_stack: data.core_stack,
          linkedin_profile: data.linkedin_profile,
          github_profile: data.github_profile,
          stackoverflow_profile: data.stackoverflow_profile,
          headline: data.headline,
          summary: data.summary,
          nationality: data.nationality,
          location_url: data.location_url,
          location_timezone: data.location_timezone,
          date_updated: new Date(),
        },
      });
      console.log(`✅ Profile updated: ${profile.id}`);
    } else {
      profile = await prisma.profiles.create({
        data: {
          name: data.name,
          title: data.title,
          location: data.location,
          phone_number: data.phone_number,
          email_address: data.email_address,
          personal_website: data.personal_website,
          subtitle: data.subtitle,
          core_stack: data.core_stack,
          linkedin_profile: data.linkedin_profile,
          github_profile: data.github_profile,
          stackoverflow_profile: data.stackoverflow_profile,
          headline: data.headline,
          summary: data.summary,
          nationality: data.nationality,
          location_url: data.location_url,
          location_timezone: data.location_timezone,
          date_created: new Date(),
          date_updated: new Date(),
        },
      });
      console.log(`✅ Profile created: ${profile.id}`);
    }

    // Import profile versions
    if (data.profile_versions && data.profile_versions.length > 0) {
      console.log(
        `Importing ${data.profile_versions.length} profile versions...`,
      );
      for (const version of data.profile_versions) {
        let extendsFromId: number | null = null;

        // If extends_from is specified, look up the ID by name
        if (version.extends_from) {
          const extendsFromVersion = await prisma.profile_versions.findFirst({
            where: {
              name: version.extends_from,
              profile: profile.id,
            },
            select: { id: true },
          });
          extendsFromId = extendsFromVersion?.id ?? null;
        }

        await prisma.profile_versions.create({
          data: {
            status: version.status || "draft",
            sort: version.sort,
            name: version.name,
            description: version.description,
            toggles: version.toggles,
            extends_from: extendsFromId,
            profile: profile.id,
          },
        });
      }
    }

    // Import highlights
    if (data.highlights && data.highlights.length > 0) {
      console.log(`Importing ${data.highlights.length} highlights...`);
      for (const highlight of data.highlights) {
        await prisma.highlights.create({
          data: {
            status: highlight.status || "draft",
            sort: highlight.sort,
            text: highlight.text,
            fa_icon: highlight.fa_icon,
            profile: profile.id,
          },
        });
      }
    }

    // Import tech skill categories with tech skills
    if (data.tech_skill_categories && data.tech_skill_categories.length > 0) {
      console.log(
        `Importing ${data.tech_skill_categories.length} tech skill categories...`,
      );
      for (const category of data.tech_skill_categories) {
        const createdCategory = await prisma.tech_skill_categories.create({
          data: {
            status: category.status || "draft",
            sort: category.sort,
            name: category.name,
            fa_icon: category.fa_icon,
            profile: profile.id,
          },
        });

        // Import tech skills
        if (category.tech_skills && category.tech_skills.length > 0) {
          for (const skill of category.tech_skills) {
            let techTypeId: number | null = null;

            // If tech_type slug is provided, look up the ID
            if (skill.tech_type) {
              const techType = await prisma.tech_skill_types.findUnique({
                where: { slug: skill.tech_type },
                select: { id: true },
              });
              if (!techType) {
                console.warn(
                  `Warning: Tech skill type slug not found: ${skill.tech_type}`,
                );
              } else {
                techTypeId = techType.id;
              }
            }

            await prisma.tech_skills.create({
              data: {
                status: skill.status || "draft",
                sort: skill.sort,
                name: skill.name,
                category: createdCategory.id,
                years_experience: skill.years_experience
                  ? parseInt(skill.years_experience, 10)
                  : null,
                level: skill.level,
                tech_type: techTypeId,
              },
            });
          }
        }
      }
    }

    // Import work experiences with achievements and technologies
    if (data.work_experiences && data.work_experiences.length > 0) {
      console.log(
        `Importing ${data.work_experiences.length} work experiences...`,
      );
      for (const work of data.work_experiences) {
        const createdWork = await prisma.work_experiences.create({
          data: {
            name: work.name || "",
            location: work.location || "",
            description: work.description || "",
            position: work.position || "",
            summary: work.summary || "",
            status: work.status || "draft",
            sort: work.sort,
            start_date: work.start_date ? new Date(work.start_date) : null,
            end_date: work.end_date ? new Date(work.end_date) : null,
            website: work.website,
            tags: work.tags,
            profile: profile.id,
          },
        });

        // Import achievements
        if (work.achievements && work.achievements.length > 0) {
          for (const achievement of work.achievements) {
            await prisma.work_experience_achievements.create({
              data: {
                status: achievement.status || "draft",
                sort: achievement.sort,
                title: achievement.title,
                description: achievement.description,
                fa_icon: achievement.fa_icon,
                tags: achievement.tags,
                work_experience: createdWork.id,
              },
            });
          }
        }

        // Import technologies
        if (work.technologies && work.technologies.length > 0) {
          for (const tech of work.technologies) {
            await prisma.work_experience_technologies.create({
              data: {
                status: tech.status || "draft",
                sort: tech.sort,
                name: tech.name,
                work_experience: createdWork.id,
              },
            });
          }
        }

        // Import projects
        if (work.projects && work.projects.length > 0) {
          for (const project of work.projects) {
            const createdProject = await prisma.work_experience_projects.create({
              data: {
                status: project.status || "draft",
                sort: project.sort,
                name: project.name,
                url: project.url,
                start_date: project.start_date ? new Date(project.start_date) : null,
                end_date: project.end_date ? new Date(project.end_date) : null,
                description: project.description,
                outcome: project.outcome,
                work_experience: createdWork.id,
              },
            });

            // Import project technologies
            if (project.work_experience_project_technologies && project.work_experience_project_technologies.length > 0) {
              for (const tech of project.work_experience_project_technologies) {
                await prisma.work_experience_project_technologies.create({
                  data: {
                    sort: tech.sort,
                    name: tech.name,
                    work_experience_project: createdProject.id,
                  },
                });
              }
            }
          }
        }
      }
    }

    // Import side projects with achievements and technologies
    if (data.side_projects && data.side_projects.length > 0) {
      console.log(`Importing ${data.side_projects.length} side projects...`);
      for (const project of data.side_projects) {
        const createdProject = await prisma.side_projects.create({
          data: {
            status: project.status || "draft",
            sort: project.sort,
            name: project.name,
            start_date: project.start_date
              ? new Date(project.start_date)
              : null,
            end_date: project.end_date ? new Date(project.end_date) : null,
            url: project.url,
            stars: project.stars,
            summary: project.summary,
            url_label: project.url_label,
            tags: project.tags,
            profile: profile.id,
          },
        });

        // Import achievements
        if (project.achievements && project.achievements.length > 0) {
          for (const achievement of project.achievements) {
            await prisma.side_project_achievements.create({
              data: {
                title: achievement.title,
                fa_icon: achievement.fa_icon,
                description: achievement.description,
                status: achievement.status || "draft",
                sort: achievement.sort,
                side_project: createdProject.id,
              },
            });
          }
        }

        // Import technologies
        if (project.technologies && project.technologies.length > 0) {
          for (const tech of project.technologies) {
            await prisma.side_project_technologies.create({
              data: {
                status: tech.status || "draft",
                sort: tech.sort,
                name: tech.name,
                side_project: createdProject.id,
              },
            });
          }
        }
      }
    }

    // Import education
    if (data.education && data.education.length > 0) {
      console.log(`Importing ${data.education.length} education entries...`);
      for (const edu of data.education) {
        await prisma.education.create({
          data: {
            status: edu.status || "draft",
            sort: edu.sort,
            institution: edu.institution,
            location: edu.location,
            url: edu.url,
            area: edu.area,
            study_type: edu.study_type,
            graduation_year: edu.graduation_year,
            start_date: edu.start_date ? new Date(edu.start_date) : null,
            end_date: edu.end_date ? new Date(edu.end_date) : null,
            summary: edu.summary,
            tags: edu.tags,
            profile: profile.id,
          },
        });
      }
    }

    // Import languages
    if (data.languages && data.languages.length > 0) {
      console.log(`Importing ${data.languages.length} languages...`);
      for (const lang of data.languages) {
        await prisma.languages.create({
          data: {
            status: lang.status || "draft",
            sort: lang.sort,
            name: lang.name,
            language_code: lang.language_code,
            proficiency: lang.proficiency,
            profile: profile.id,
          },
        });
      }
    }

    // Import references
    if (data.references && data.references.length > 0) {
      console.log(`Importing ${data.references.length} references...`);
      for (const ref of data.references) {
        await prisma.references.create({
          data: {
            status: ref.status || "draft",
            sort: ref.sort,
            author: ref.author || "",
            author_position: ref.author_position,
            text: ref.text,
            profile: profile.id,
          },
        });
      }
    }

    // Import project stories
    if (data.project_stories && data.project_stories.length > 0) {
      console.log(
        `Importing ${data.project_stories.length} project stories...`,
      );
      for (const story of data.project_stories) {
        await prisma.project_stories.create({
          data: {
            sort: story.sort,
            title: story.title,
            situation: story.situation,
            task: story.task,
            action: story.action,
            result: story.result,
            reflection: story.reflection,
            category: story.category,
            profile: profile.id,
          },
        });
      }
    }

    // Import application questions
    if (data.application_questions && data.application_questions.length > 0) {
      console.log(
        `Importing ${data.application_questions.length} application questions...`,
      );
      for (const question of data.application_questions) {
        await prisma.application_questions.create({
          data: {
            sort: question.sort,
            question: question.question,
            answer: question.answer,
            title: question.title,
            source: question.source,
            profile: profile.id,
          },
        });
      }
    }

    // Import cheat sheets
    if (data.cheat_sheets && data.cheat_sheets.length > 0) {
      console.log(`Importing ${data.cheat_sheets.length} cheat sheets...`);
      for (const sheet of data.cheat_sheets) {
        await prisma.cheat_sheets.create({
          data: {
            sort: sheet.sort,
            title: sheet.title,
            content: sheet.content,
            profile: profile.id,
          },
        });
      }
    }

    // Import salary expectations
    if (data.salary_expectations && data.salary_expectations.length > 0) {
      console.log(
        `Importing ${data.salary_expectations.length} salary expectations...`,
      );
      for (const salary of data.salary_expectations) {
        await prisma.salary_expectations.create({
          data: {
            sort: salary.sort,
            job_title: salary.job_title,
            company_type: salary.company_type || "",
            employment_type: salary.employment_type || "",
            work_arrangement: salary.work_arrangement || "",
            region: salary.region || "",
            hourly_rate: salary.hourly_rate,
            month_salary: salary.month_salary,
            year_salary: salary.year_salary,
            daily_rate: salary.daily_rate,
            profile: profile.id,
          },
        });
      }
    }

    console.log("\n✅ Profile imported successfully!");
    console.log(`📊 Imported data summary:`);
    console.log(`   - Profile ID: ${profile.id}`);
    console.log(`   - Profile versions: ${data.profile_versions?.length || 0}`);
    console.log(`   - Highlights: ${data.highlights?.length || 0}`);
    console.log(
      `   - Tech skill categories: ${data.tech_skill_categories?.length || 0}`,
    );
    console.log(`   - Work experiences: ${data.work_experiences?.length || 0}`);
    console.log(`   - Side projects: ${data.side_projects?.length || 0}`);
    console.log(`   - Education: ${data.education?.length || 0}`);
    console.log(`   - Languages: ${data.languages?.length || 0}`);
    console.log(`   - References: ${data.references?.length || 0}`);
    console.log(`   - Project stories: ${data.project_stories?.length || 0}`);
    console.log(
      `   - Application questions: ${data.application_questions?.length || 0}`,
    );
    console.log(`   - Cheat sheets: ${data.cheat_sheets?.length || 0}`);
    console.log(
      `   - Salary expectations: ${data.salary_expectations?.length || 0}`,
    );
  } catch (error) {
    console.error("Error importing profile:", error);
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

// Parse command line arguments
const filePath = process.argv[2];
const profileId = process.argv[3];
const deleteFlag = process.argv.includes("--delete");

if (!filePath) {
  console.error(
    "Usage: npx tsx scripts/import-profile.ts <file-path> [profile-id] [--delete]",
  );
  console.error("\nExamples:");
  console.error("  Create new profile:");
  console.error(
    "    npx tsx scripts/import-profile.ts ./exports/my-profile.json",
  );
  console.error("\n  Update existing profile:");
  console.error(
    "    npx tsx scripts/import-profile.ts ./exports/my-profile.json 123e4567-e89b-12d3-a456-426614174000",
  );
  console.error("\n  Update and delete existing data:");
  console.error(
    "    npx tsx scripts/import-profile.ts ./exports/my-profile.json 123e4567-e89b-12d3-a456-426614174000 --delete",
  );
  process.exit(1);
}

importProfile(filePath, profileId, deleteFlag).catch((error) => {
  console.error("Import failed:", error);
  process.exit(1);
});
