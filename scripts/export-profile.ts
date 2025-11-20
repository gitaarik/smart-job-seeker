#!/usr/bin/env node

import { PrismaClient } from "@prisma/client";
import { existsSync, mkdirSync, writeFileSync } from "fs";

const prisma = new PrismaClient();

interface ExportedProfile {
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
      start_date?: Date | null;
      end_date?: Date | null;
      website?: string;
      tags?: any;
      work_experience_achievements: Array<{
        status?: string;
        sort?: number | null;
        title?: string;
        description?: string;
        fa_icon?: string;
        tags?: any;
      }>;
      work_experience_technologies: Array<{
        status?: string;
        sort?: number | null;
        name?: string;
      }>;
      work_experience_projects: Array<{
        status?: string;
        sort?: number | null;
        name: string;
        url?: string;
        start_date?: Date | null;
        end_date?: Date | null;
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
      start_date?: Date | null;
      end_date?: Date | null;
      url?: string;
      stars?: number | null;
      summary?: string;
      url_label?: string;
      tags?: any;
      side_project_achievements: Array<{
        title?: string;
        fa_icon?: string;
        description?: string;
        status?: string;
        sort?: number | null;
      }>;
      side_project_technologies: Array<{
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
      start_date?: Date | null;
      end_date?: Date | null;
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

async function exportProfile(profileId: string): Promise<void> {
  try {
    console.log(`Exporting profile: ${profileId}`);

    const id = parseInt(profileId, 10);

    // Fetch profile with all relations using reference fields
    const baseProfile = await prisma.profiles.findUnique({
      where: { id },
      include: {
        profile_versions: {
          select: {
            status: true,
            sort: true,
            name: true,
            description: true,
            toggles: true,
            other_profile_versions: { select: { name: true } },
          },
          orderBy: { sort: "asc" },
        },
        highlights: {
          select: { status: true, sort: true, text: true, fa_icon: true },
          orderBy: { sort: "asc" },
        },
        tech_skill_categories: {
          select: {
            status: true,
            sort: true,
            name: true,
            fa_icon: true,
            tech_skills: {
              select: {
                status: true,
                sort: true,
                name: true,
                years_experience: true,
                level: true,
                tech_skill_types: { select: { slug: true } },
              },
              orderBy: { sort: "asc" },
            },
          },
          orderBy: { sort: "asc" },
        },
        work_experiences: {
          select: {
            id: true,
            name: true,
            location: true,
            description: true,
            position: true,
            summary: true,
            status: true,
            sort: true,
            start_date: true,
            end_date: true,
            website: true,
            tags: true,
            work_experience_achievements: {
              select: {
                status: true,
                sort: true,
                title: true,
                description: true,
                fa_icon: true,
                tags: true,
              },
              orderBy: { sort: "asc" },
            },
            work_experience_technologies: {
              select: { status: true, sort: true, name: true },
              orderBy: { sort: "asc" },
            },
            work_experience_projects: {
              select: {
                status: true,
                sort: true,
                name: true,
                url: true,
                start_date: true,
                end_date: true,
                description: true,
                outcome: true,
                work_experience_project_technologies: {
                  select: { sort: true, name: true },
                  orderBy: { sort: "asc" },
                },
              },
              orderBy: { sort: "asc" },
            },
          },
          orderBy: { sort: "asc" },
        },
        side_projects: {
          select: {
            id: true,
            status: true,
            sort: true,
            name: true,
            start_date: true,
            end_date: true,
            url: true,
            stars: true,
            summary: true,
            url_label: true,
            tags: true,
            side_project_achievements: {
              select: {
                title: true,
                fa_icon: true,
                description: true,
                status: true,
                sort: true,
              },
              orderBy: { sort: "asc" },
            },
            side_project_technologies: {
              select: { status: true, sort: true, name: true },
              orderBy: { sort: "asc" },
            },
          },
          orderBy: { sort: "asc" },
        },
        education: {
          select: {
            status: true,
            sort: true,
            institution: true,
            location: true,
            url: true,
            area: true,
            study_type: true,
            graduation_year: true,
            start_date: true,
            end_date: true,
            summary: true,
            tags: true,
          },
          orderBy: { sort: "asc" },
        },
        languages: {
          select: {
            status: true,
            sort: true,
            name: true,
            language_code: true,
            proficiency: true,
          },
          orderBy: { sort: "asc" },
        },
        references: {
          select: {
            status: true,
            sort: true,
            author: true,
            author_position: true,
            text: true,
          },
          orderBy: { sort: "asc" },
        },
        project_stories: {
          select: {
            sort: true,
            title: true,
            situation: true,
            task: true,
            action: true,
            result: true,
            reflection: true,
            category: true,
          },
          orderBy: { sort: "asc" },
        },
        application_questions: {
          select: {
            sort: true,
            question: true,
            answer: true,
            title: true,
            source: true,
          },
          orderBy: { sort: "asc" },
        },
        cheat_sheets: {
          select: { sort: true, title: true, content: true },
          orderBy: { sort: "asc" },
        },
        salary_expectations: {
          select: {
            sort: true,
            job_title: true,
            company_type: true,
            employment_type: true,
            work_arrangement: true,
            region: true,
            hourly_rate: true,
            month_salary: true,
            year_salary: true,
            daily_rate: true,
          },
          orderBy: { sort: "asc" },
        },
      },
    });

    if (!baseProfile) {
      console.error(`Profile with ID ${id} not found`);
      return;
    }

    // Fetch nested work experience relations using reference fields
    const work_experience_achievements_all = await Promise.all(
      baseProfile.work_experiences.map((work) =>
        prisma.work_experience_achievements.findMany({
          where: { work_experience: work.id },
          select: {
            work_experience: true,
            status: true,
            sort: true,
            title: true,
            description: true,
            fa_icon: true,
            tags: true,
          },
          orderBy: { sort: "asc" },
        })
      ),
    ).then((results) => results.flat());

    const work_experience_technologies_all = await Promise.all(
      baseProfile.work_experiences.map((work) =>
        prisma.work_experience_technologies.findMany({
          where: { work_experience: work.id },
          select: {
            work_experience: true,
            status: true,
            sort: true,
            name: true,
          },
          orderBy: { sort: "asc" },
        })
      ),
    ).then((results) => results.flat());

    const work_experience_projects_all = await Promise.all(
      baseProfile.work_experiences.map((work) =>
        prisma.work_experience_projects.findMany({
          where: { work_experience: work.id },
          select: {
            status: true,
            sort: true,
            name: true,
            url: true,
            start_date: true,
            end_date: true,
            description: true,
            outcome: true,
            work_experience_project_technologies: {
              select: { sort: true, name: true },
              orderBy: { sort: "asc" },
            },
          },
          orderBy: { sort: "asc" },
        })
      ),
    ).then((results) => results.flat());

    // Build the export object
    const exportData: ExportedProfile = {
      profile: {
        name: baseProfile.name || undefined,
        title: baseProfile.title || undefined,
        location: baseProfile.location || undefined,
        phone_number: baseProfile.phone_number || undefined,
        email_address: baseProfile.email_address || undefined,
        personal_website: baseProfile.personal_website || undefined,
        subtitle: baseProfile.subtitle || undefined,
        core_stack: baseProfile.core_stack || undefined,
        linkedin_profile: baseProfile.linkedin_profile || undefined,
        github_profile: baseProfile.github_profile || undefined,
        stackoverflow_profile: baseProfile.stackoverflow_profile || undefined,
        headline: baseProfile.headline || undefined,
        summary: baseProfile.summary || undefined,
        nationality: baseProfile.nationality || undefined,
        location_url: baseProfile.location_url || undefined,
        location_timezone: baseProfile.location_timezone || undefined,
        profile_versions: baseProfile.profile_versions.map((pv) => ({
          status: pv.status || undefined,
          sort: pv.sort,
          name: pv.name || undefined,
          description: pv.description || undefined,
          toggles: pv.toggles,
          extends_from: pv.other_profile_versions?.name,
        })),
        highlights: baseProfile.highlights,
        tech_skill_categories: baseProfile.tech_skill_categories.map((cat) => ({
          status: cat.status || undefined,
          sort: cat.sort,
          name: cat.name || undefined,
          fa_icon: cat.fa_icon || undefined,
          tech_skills: cat.tech_skills.map((skill) => ({
            status: skill.status || undefined,
            sort: skill.sort,
            name: skill.name || undefined,
            years_experience: skill.years_experience || undefined,
            level: skill.level || undefined,
            tech_type: skill.tech_skill_types?.slug || null,
          })),
        })),
        work_experiences: baseProfile.work_experiences.map((work) => ({
          name: work.name || undefined,
          location: work.location || undefined,
          description: work.description || undefined,
          position: work.position || undefined,
          summary: work.summary || undefined,
          status: work.status || undefined,
          sort: work.sort,
          start_date: work.start_date,
          end_date: work.end_date,
          website: work.website || undefined,
          tags: work.tags,
          achievements: work.work_experience_achievements,
          technologies: work.work_experience_technologies,
          projects: work.work_experience_projects,
        })),
        side_projects: baseProfile.side_projects.map((proj) => ({
          status: proj.status || undefined,
          sort: proj.sort,
          name: proj.name || undefined,
          start_date: proj.start_date,
          end_date: proj.end_date,
          url: proj.url || undefined,
          stars: proj.stars,
          summary: proj.summary || undefined,
          url_label: proj.url_label || undefined,
          tags: proj.tags,
          achievements: proj.side_project_achievements,
          technologies: proj.side_project_technologies,
        })),
        education: baseProfile.education,
        languages: baseProfile.languages,
        references: baseProfile.references,
        project_stories: baseProfile.project_stories,
        application_questions: baseProfile.application_questions,
        cheat_sheets: baseProfile.cheat_sheets,
        salary_expectations: baseProfile.salary_expectations,
      },
    };

    // Ensure output directory exists
    const outputDir = "./exports";
    if (!existsSync(outputDir)) {
      mkdirSync(outputDir, { recursive: true });
    }

    // Generate filename with timestamp and profile name
    const profileName = baseProfile.name
      ?.replace(/\s+/g, "-")
      .toLowerCase() || "profile";
    const timestamp = new Date().toISOString().split("T")[0];
    const filename = `${outputDir}/${profileName}.json`;

    // Write to file
    writeFileSync(filename, JSON.stringify(exportData, null, 2));

    console.log(`✅ Profile exported successfully`);
    console.log(`📁 File: ${filename}`);
    console.log(`📊 Exported data summary:`);
    console.log(
      `   - Profile versions: ${exportData.profile.profile_versions.length}`,
    );
    console.log(`   - Highlights: ${exportData.profile.highlights.length}`);
    console.log(
      `   - Tech skill categories: ${exportData.profile.tech_skill_categories.length}`,
    );
    console.log(
      `   - Work experiences: ${exportData.profile.work_experiences.length}`,
    );
    console.log(
      `   - Side projects: ${exportData.profile.side_projects.length}`,
    );
    console.log(`   - Education: ${exportData.profile.education.length}`);
    console.log(`   - Languages: ${exportData.profile.languages.length}`);
    console.log(`   - References: ${exportData.profile.references.length}`);
    console.log(
      `   - Project stories: ${exportData.profile.project_stories.length}`,
    );
    console.log(
      `   - Application questions: ${exportData.profile.application_questions.length}`,
    );
    console.log(`   - Cheat sheets: ${exportData.profile.cheat_sheets.length}`);
  } catch (error) {
    console.error("Error exporting profile:", error);
    process.exit(1);
  }
}

// Main execution
const profileId = process.argv[2];
if (!profileId) {
  console.error("Please provide a profile ID as an argument");
  process.exit(1);
}

exportProfile(profileId)
  .catch((error) => {
    console.error("Export failed:", error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
