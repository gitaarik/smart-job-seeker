import { dbDirect } from "$lib/server/db";

export interface ExportedProfile {
  profile: {
    name?: string;
    title?: string;
    slug?: string;
    // Location field
    location?: string;
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
      position?: string;
      summary?: string;
      status?: string;
      sort?: number | null;
      start_date?: Date | null;
      end_date?: Date | null;
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
      achievements: Array<{
        description?: string;
        sort?: number | null;
      }>;
      technologies: Array<{
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

export async function buildProfileJsonExport(
  profileId: number,
): Promise<{ data: ExportedProfile; profileName: string }> {
  const baseProfile = await dbDirect.profiles.findUnique({
    where: { id: profileId },
    include: {
      profile_versions_profile_versions_profileToprofiles: {
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
    throw new Error(`Profile with ID ${profileId} not found`);
  }

  const exportData = {
    profile: {
      name: baseProfile.name || undefined,
      title: baseProfile.title || undefined,
      slug: baseProfile.slug || undefined,
      // Location field
      location: baseProfile.location || undefined,
      // Contact fields
      phone_number: baseProfile.phone_number || undefined,
      email_address: baseProfile.email_address || undefined,
      personal_website: baseProfile.personal_website || undefined,
      // Social profiles
      linkedin_profile: baseProfile.linkedin_profile || undefined,
      github_profile: baseProfile.github_profile || undefined,
      stackoverflow_profile: baseProfile.stackoverflow_profile || undefined,
      npm_profile: baseProfile.npm_profile || undefined,
      pypi_profile: baseProfile.pypi_profile || undefined,
      signal_profile: baseProfile.signal_profile || undefined,
      whatsapp_number: baseProfile.whatsapp_number || undefined,
      telegram_username: baseProfile.telegram_username || undefined,
      // Professional info
      subtitle: baseProfile.subtitle || undefined,
      core_stack: baseProfile.core_stack || undefined,
      headline: baseProfile.headline || undefined,
      summary: baseProfile.summary || undefined,
      about_me_text: baseProfile.about_me_text || undefined,
      nationality: baseProfile.nationality || undefined,
      location_url: baseProfile.location_url || undefined,
      location_timezone: baseProfile.location_timezone || undefined,
      meta_image_url: baseProfile.meta_image_url || undefined,
      // Experience years
      dev_start_year: baseProfile.dev_start_year,
      python_js_start_year: baseProfile.python_js_start_year,
      remote_start_year: baseProfile.remote_start_year,
      // Business info
      company_name: baseProfile.company_name || undefined,
      street_address: baseProfile.street_address || undefined,
      postal_code: baseProfile.postal_code || undefined,
      vat_id: baseProfile.vat_id || undefined,
      kvk_number: baseProfile.kvk_number || undefined,
      profile_versions:
        baseProfile.profile_versions_profile_versions_profileToprofiles.map(
          (pv) => ({
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
          }),
        ),
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
      cheat_sheets: baseProfile.cheat_sheets,
      salary_expectations: baseProfile.salary_expectations,
    },
  } as ExportedProfile;

  const profileName =
    baseProfile.name?.replace(/\s+/g, "-").toLowerCase() || "profile";

  return { data: exportData, profileName };
}
