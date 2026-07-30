#!/usr/bin/env node

import { dbDirect } from "$lib/server/db";
import { getDefaultProfileId } from "$lib/server/profile/default";
import { readFileSync } from "fs";
import { v4 as uuidv4 } from "uuid";
import { Command } from "commander";

interface ImportedProfile {
  profile: {
    name?: string;
    title?: string;
    slug?: string;
    // Contact fields
    phone_number?: string;
    email_address?: string;
    personal_website?: string;
    // Social profiles
    linkedin_profile?: string;
    github_profile?: string;
    stackoverflow_profile?: string;
    npm_profile?: string;
    pypi_profile?: string;
    signal_profile?: string;
    whatsapp_number?: string;
    telegram_username?: string;
    // Professional info
    subtitle?: string;
    core_stack?: string;
    headline?: string;
    summary?: string;
    about_me_text?: string;
    nationality?: string;
    location_url?: string;
    location_timezone?: string;
    meta_image_url?: string;
    // Experience years
    dev_start_year?: number | null;
    python_js_start_year?: number | null;
    remote_start_year?: number | null;
    // Business info
    company_name?: string;
    street_address?: string;
    postal_code?: string;
    vat_id?: string;
    kvk_number?: string;
    profile_versions: Array<{
      status?: string;
      sort?: number | null;
      slug?: string;
      name?: string;
      description?: string; // Legacy field (old format: display name)
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
      repo_url?: string;
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
  profileIdStr?: string,
  deleteExisting: boolean = false,
  userId?: string,
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

    // Convert profile ID to integer if provided
    const profileId = profileIdStr ? parseInt(profileIdStr, 10) : undefined;

    // If updating existing profile
    if (profileId) {
      const existingProfile = await dbDirect.profiles.findUnique({
        where: { id: profileId },
      });

      if (!existingProfile) {
        throw new Error(`Profile not found: ${profileId}`);
      }

      if (deleteExisting) {
        console.log("Deleting existing related data...");
        // Delete all related data for this profile
        // First delete profile_version_extensions (junction table)
        await dbDirect.profile_version_extensions.deleteMany({
          where: {
            OR: [
              {
                profile_versions_profile_version_extensions_extenderToprofile_versions:
                  { profile: profileId },
              },
              {
                profile_versions_profile_version_extensions_extendedToprofile_versions:
                  { profile: profileId },
              },
            ],
          },
        });
        await Promise.all([
          dbDirect.profile_versions.deleteMany({
            where: { profile: profileId },
          }),
          dbDirect.highlights.deleteMany({ where: { profile: profileId } }),
          dbDirect.work_experience_project_technologies.deleteMany({
            where: {
              work_experience_projects: {
                work_experiences: { profile: profileId },
              },
            },
          }),
          dbDirect.work_experience_projects.deleteMany({
            where: { work_experiences: { profile: profileId } },
          }),
          dbDirect.work_experience_achievements.deleteMany({
            where: { work_experiences: { profile: profileId } },
          }),
          dbDirect.work_experience_technologies.deleteMany({
            where: { work_experiences: { profile: profileId } },
          }),
          dbDirect.work_experiences.deleteMany({
            where: { profile: profileId },
          }),
          dbDirect.side_project_achievements.deleteMany({
            where: { side_projects: { profile: profileId } },
          }),
          dbDirect.side_project_technologies.deleteMany({
            where: { side_projects: { profile: profileId } },
          }),
          dbDirect.side_projects.deleteMany({ where: { profile: profileId } }),
          dbDirect.education.deleteMany({ where: { profile: profileId } }),
          dbDirect.languages.deleteMany({ where: { profile: profileId } }),
          dbDirect.references.deleteMany({ where: { profile: profileId } }),
          dbDirect.project_stories.deleteMany({
            where: { profile: profileId },
          }),
          dbDirect.cheat_sheets.deleteMany({ where: { profile: profileId } }),
          dbDirect.tech_skill_categories.deleteMany({
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
      profile = await dbDirect.profiles.update({
        where: { id: profileId },
        data: {
          name: data.name,
          title: data.title,
          slug: data.slug,
          // Contact fields
          phone_number: data.phone_number,
          email_address: data.email_address,
          personal_website: data.personal_website,
          // Social profiles
          linkedin_profile: data.linkedin_profile,
          github_profile: data.github_profile,
          stackoverflow_profile: data.stackoverflow_profile,
          npm_profile: data.npm_profile,
          pypi_profile: data.pypi_profile,
          signal_profile: data.signal_profile,
          whatsapp_number: data.whatsapp_number,
          telegram_username: data.telegram_username,
          // Professional info
          subtitle: data.subtitle,
          core_stack: data.core_stack,
          headline: data.headline,
          summary: data.summary,
          about_me_text: data.about_me_text,
          nationality: data.nationality,
          location_url: data.location_url,
          location_timezone: data.location_timezone,
          meta_image_url: data.meta_image_url,
          // Experience years
          dev_start_year: data.dev_start_year,
          python_js_start_year: data.python_js_start_year,
          remote_start_year: data.remote_start_year,
          // Business info
          company_name: data.company_name,
          street_address: data.street_address,
          postal_code: data.postal_code,
          vat_id: data.vat_id,
          kvk_number: data.kvk_number,
          user_id: userId,
          date_updated: new Date(),
        },
      });
      console.log(`✅ Profile updated: ${profile.id}`);
    } else {
      profile = await dbDirect.profiles.create({
        data: {
          name: data.name,
          title: data.title,
          slug: data.slug,
          // Contact fields
          phone_number: data.phone_number,
          email_address: data.email_address,
          personal_website: data.personal_website,
          // Social profiles
          linkedin_profile: data.linkedin_profile,
          github_profile: data.github_profile,
          stackoverflow_profile: data.stackoverflow_profile,
          npm_profile: data.npm_profile,
          pypi_profile: data.pypi_profile,
          signal_profile: data.signal_profile,
          whatsapp_number: data.whatsapp_number,
          telegram_username: data.telegram_username,
          // Professional info
          subtitle: data.subtitle,
          core_stack: data.core_stack,
          headline: data.headline,
          summary: data.summary,
          about_me_text: data.about_me_text,
          nationality: data.nationality,
          location_url: data.location_url,
          location_timezone: data.location_timezone,
          meta_image_url: data.meta_image_url,
          // Experience years
          dev_start_year: data.dev_start_year,
          python_js_start_year: data.python_js_start_year,
          remote_start_year: data.remote_start_year,
          // Business info
          company_name: data.company_name,
          street_address: data.street_address,
          postal_code: data.postal_code,
          vat_id: data.vat_id,
          kvk_number: data.kvk_number,
          user_id: userId,
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
      // First pass: create all profile versions
      const createdVersions: Array<{
        id: number;
        slug: string | null;
        extends_from?: string | null;
      }> = [];
      for (const version of data.profile_versions) {
        // Backward compat: old exports have name=slug, description=display name
        const slug = version.slug || version.name || null;
        const name = version.slug ? (version.name || null) : (version.description || null);
        const created = await dbDirect.profile_versions.create({
          data: {
            status: version.status || "draft",
            sort: version.sort,
            slug: slug,
            name: name,
            toggles: version.toggles,
            profile: profile.id,
          },
        });
        createdVersions.push({
          id: created.id,
          slug: created.slug,
          extends_from: version.extends_from,
        });
      }

      // Second pass: create extension relationships
      for (const version of createdVersions) {
        if (version.extends_from) {
          const extendedVersion = createdVersions.find(
            (v) => v.slug === version.extends_from,
          );
          if (extendedVersion) {
            await dbDirect.profile_version_extensions.create({
              data: {
                extender: version.id,
                extended: extendedVersion.id,
              },
            });
          } else {
            console.warn(
              `Warning: Could not find profile version "${version.extends_from}" to extend from`,
            );
          }
        }
      }
    }

    // Import highlights
    if (data.highlights && data.highlights.length > 0) {
      console.log(`Importing ${data.highlights.length} highlights...`);
      for (const highlight of data.highlights) {
        await dbDirect.highlights.create({
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
        const createdCategory = await dbDirect.tech_skill_categories.create({
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
              const techType = await dbDirect.tech_skill_types.findUnique({
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

            await dbDirect.tech_skills.create({
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
        const createdWork = await dbDirect.work_experiences.create({
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
            await dbDirect.work_experience_achievements.create({
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
            await dbDirect.work_experience_technologies.create({
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
            const createdProject = await dbDirect.work_experience_projects
              .create({
                data: {
                  status: project.status || "draft",
                  sort: project.sort,
                  name: project.name,
                  url: project.url,
                  start_date: project.start_date
                    ? new Date(project.start_date)
                    : null,
                  end_date: project.end_date
                    ? new Date(project.end_date)
                    : null,
                  description: project.description,
                  outcome: project.outcome,
                  work_experience: createdWork.id,
                },
              });

            // Import project technologies
            if (
              project.work_experience_project_technologies &&
              project.work_experience_project_technologies.length > 0
            ) {
              for (const tech of project.work_experience_project_technologies) {
                await dbDirect.work_experience_project_technologies.create({
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
        const createdProject = await dbDirect.side_projects.create({
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
            repo_url: project.repo_url,
            tags: project.tags,
            profile: profile.id,
          },
        });

        // Import achievements
        if (project.achievements && project.achievements.length > 0) {
          for (const achievement of project.achievements) {
            await dbDirect.side_project_achievements.create({
              data: {
                description: achievement.description,
                sort: achievement.sort,
                side_project: createdProject.id,
              },
            });
          }
        }

        // Import technologies
        if (project.technologies && project.technologies.length > 0) {
          for (const tech of project.technologies) {
            await dbDirect.side_project_technologies.create({
              data: {
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
        await dbDirect.education.create({
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
        await dbDirect.languages.create({
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
        await dbDirect.references.create({
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
        await dbDirect.project_stories.create({
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

    // Import cheat sheets
    if (data.cheat_sheets && data.cheat_sheets.length > 0) {
      console.log(`Importing ${data.cheat_sheets.length} cheat sheets...`);
      for (const sheet of data.cheat_sheets) {
        await dbDirect.cheat_sheets.create({
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
        await dbDirect.salary_expectations.create({
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
    console.log(`   - Cheat sheets: ${data.cheat_sheets?.length || 0}`);
    console.log(
      `   - Salary expectations: ${data.salary_expectations?.length || 0}`,
    );
  } catch (error) {
    console.error("Error importing profile:", error);
    throw error;
  }
}

// CLI Program
const program = new Command();

program
  .name("import-profile")
  .description("Import profile data from JSON export file")
  .version("1.0.0")
  .argument("<file-path>", "Path to the JSON export file")
  .option("-p, --profile-id <id>", "Existing profile ID to update")
  .option("-u, --user-id <id>", "User ID to link the profile to")
  .option("-d, --delete", "Delete existing data before import", false)
  .helpOption("-h, --help", "Display help for command")
  .addHelpText(
    "after",
    `
Examples:
  Create new profile:
    npm run host:import-profile-json ./exports/my-profile.json

  Update existing profile:
    npm run host:import-profile-json ./exports/my-profile.json --profile-id=123e4567-e89b-12d3-a456-426614174000
    npm run host:import-profile-json ./exports/my-profile.json -p 123e4567-e89b-12d3-a456-426614174000

  Update and delete existing data:
    npm run host:import-profile-json ./exports/my-profile.json -p 123e4567-e89b-12d3-a456-426614174000 --delete
    npm run host:import-profile-json ./exports/my-profile.json -p 123e4567-e89b-12d3-a456-426614174000 -d
`,
  );

program.parse();

const [filePath] = program.args;
const options = program.opts();

async function main() {
  let profileId = options.profileId;

  // If --user-id is provided without --profile-id, always create a new profile
  if (options.userId && !profileId) {
    console.log(
      "Creating new profile linked to user:",
      options.userId,
    );
  } else if (!profileId) {
    // No profile ID and no user ID - check for default profile
    const defaultId = await getDefaultProfileId();
    if (defaultId) {
      profileId = defaultId.toString();
      console.log(
        `No --profile-id specified. Updating default profile: ${profileId}`,
      );
    } else {
      console.log(
        "No --profile-id specified and no default profile set. Creating new profile.",
      );
    }
  }

  await importProfile(filePath, profileId, options.delete, options.userId);
}

main().catch((error) => {
  console.error("Import failed:", error);
  process.exit(1);
});
