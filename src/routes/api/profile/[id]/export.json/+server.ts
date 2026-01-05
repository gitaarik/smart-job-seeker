import type { RequestHandler } from "./$types";
import { error, json } from "@sveltejs/kit";
import { dbDirect } from "$lib/db";

interface ExportedProfile {
  profile: {
    name?: string;
    title?: string;
    location_city?: string;
    location_region?: string;
    location_country_code?: string;
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
    profile_versions: Array<any>;
    highlights: Array<any>;
    tech_skill_categories: Array<any>;
    work_experiences: Array<any>;
    side_projects: Array<any>;
    education: Array<any>;
    languages: Array<any>;
    references: Array<any>;
    project_stories: Array<any>;
    application_questions?: Array<any>;
    cheat_sheets: Array<any>;
    salary_expectations: Array<any>;
  };
}

export const GET: RequestHandler = async ({ params }) => {
  const profileId = parseInt(params.id, 10);

  if (isNaN(profileId)) {
    throw error(400, "Invalid profile ID");
  }

  // Fetch profile with all relations - same structure as export-profile-json.ts
  const baseProfile = await dbDirect.profiles.findUnique({
    where: { id: profileId },
    include: {
      profile_versions: {
        select: {
          status: true,
          sort: true,
          name: true,
          description: true,
          toggles: true,
          profile_version_extensions_profile_version_extensions_extenderToprofile_versions:
            {
              select: {
                profile_versions_profile_version_extensions_extendedToprofile_versions:
                  {
                    select: {
                      name: true,
                    },
                  },
              },
            },
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
              description: true,
              sort: true,
            },
            orderBy: { sort: "asc" },
          },
          side_project_technologies: {
            select: { sort: true, name: true },
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
    throw error(404, `Profile with ID ${profileId} not found`);
  }

  // Build the export object
  const exportData: ExportedProfile = {
    profile: {
      name: baseProfile.name || undefined,
      title: baseProfile.title || undefined,
      location_city: baseProfile.location_city || undefined,
      location_region: baseProfile.location_region || undefined,
      location_country_code: baseProfile.location_country_code || undefined,
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
        extends_from: pv
          .profile_version_extensions_profile_version_extensions_extenderToprofile_versions
          ?.[0]
          ?.profile_versions_profile_version_extensions_extendedToprofile_versions
          ?.name,
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

  const profileName = baseProfile.name?.replace(/\s+/g, "-").toLowerCase() ||
    "profile";

  return json(exportData, {
    headers: {
      "Content-Type": "application/json",
      "Content-Disposition": `attachment; filename="profile-${profileId}.json"`,
      "Cache-Control": "no-cache",
    },
  });
};
