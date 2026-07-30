import { dbDirect } from "$lib/server/db";
import { eq } from "drizzle-orm";
import { profiles } from "$lib/server/db/schema";

export interface ExportedProfile {
  profile: {
    name?: string;
    title?: string;
    slug?: string;
    location?: string;
    phone_number?: string;
    email_address?: string;
    personal_website?: string;
    linkedin_profile?: string;
    github_profile?: string;
    stackoverflow_profile?: string;
    npm_profile?: string;
    pypi_profile?: string;
    signal_profile?: string;
    whatsapp_number?: string;
    telegram_username?: string;
    subtitle?: string;
    core_stack?: string;
    headline?: string;
    summary?: string;
    about_me_text?: string;
    nationality?: string;
    location_url?: string;
    location_timezone?: string;
    meta_image_url?: string;
    dev_start_year?: number | null;
    python_js_start_year?: number | null;
    remote_start_year?: number | null;
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
      repo_url?: string;
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
    certificates: Array<{
      status?: string;
      sort?: number | null;
      name?: string;
      issuer?: string;
      date?: Date | null;
      url?: string;
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
      experience_level?: string;
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
  const baseProfile = await dbDirect.query.profiles.findFirst({
    where: eq(profiles.id, profileId),
    with: {
      profile_versions: {
        columns: { status: true, sort: true, slug: true, name: true, toggles: true },
        with: {
          extension_links: {
            with: {
              extended: { columns: { slug: true } },
            },
          },
        },
        orderBy: (t: any, { asc }: any) => asc(t.sort),
      },
      highlights: {
        columns: { status: true, sort: true, text: true, fa_icon: true },
        orderBy: (t: any, { asc }: any) => asc(t.sort),
      },
      tech_skill_categories: {
        columns: { status: true, sort: true, name: true, fa_icon: true },
        with: {
          tech_skills: {
            columns: { status: true, sort: true, name: true, years_experience: true, level: true },
            with: { tech_skill_type: { columns: { slug: true } } },
            orderBy: (t: any, { asc }: any) => asc(t.sort),
          },
        },
        orderBy: (t: any, { asc }: any) => asc(t.sort),
      },
      work_experiences: {
        columns: { id: true, name: true, location: true, position: true, summary: true, status: true, sort: true, start_date: true, end_date: true, website: true, tags: true },
        with: {
          work_experience_achievements: {
            columns: { status: true, sort: true, description: true, fa_icon: true, tags: true },
            orderBy: (t: any, { asc }: any) => asc(t.sort),
          },
          work_experience_technologies: {
            columns: { status: true, sort: true, name: true },
            orderBy: (t: any, { asc }: any) => asc(t.sort),
          },
          work_experience_projects: {
            columns: { status: true, sort: true, name: true, url: true, start_date: true, end_date: true, description: true, outcome: true },
            with: {
              work_experience_project_technologies: {
                columns: { sort: true, name: true },
                orderBy: (t: any, { asc }: any) => asc(t.sort),
              },
            },
            orderBy: (t: any, { asc }: any) => asc(t.sort),
          },
        },
        orderBy: (t: any, { asc, desc }: any) => [asc(t.sort), desc(t.start_date)],
      },
      side_projects: {
        columns: { id: true, status: true, sort: true, name: true, start_date: true, end_date: true, url: true, stars: true, summary: true, repo_url: true, tags: true },
        with: {
          side_project_achievements: { columns: { description: true, sort: true }, orderBy: (t: any, { asc }: any) => asc(t.sort) },
          side_project_technologies: { columns: { sort: true, name: true }, orderBy: (t: any, { asc }: any) => asc(t.sort) },
        },
        orderBy: (t: any, { asc, desc }: any) => [asc(t.sort), desc(t.start_date)],
      },
      educations: {
        columns: { status: true, sort: true, institution: true, location: true, url: true, area: true, study_type: true, graduation_year: true, start_date: true, end_date: true, summary: true, tags: true },
        orderBy: (t: any, { asc }: any) => asc(t.sort),
      },
      languages: {
        columns: { status: true, sort: true, name: true, language_code: true, proficiency: true },
        orderBy: (t: any, { asc }: any) => asc(t.sort),
      },
      references: {
        columns: { status: true, sort: true, author: true, author_position: true, text: true },
        orderBy: (t: any, { asc }: any) => asc(t.sort),
      },
      certificates: {
        columns: { status: true, sort: true, name: true, issuer: true, date: true, url: true },
        orderBy: (t: any, { asc }: any) => asc(t.sort),
      },
      project_stories: {
        columns: { sort: true, title: true, situation: true, task: true, action: true, result: true, reflection: true, category: true },
        orderBy: (t: any, { asc }: any) => asc(t.sort),
      },
      cheat_sheets: {
        columns: { sort: true, title: true, content: true },
        orderBy: (t: any, { asc }: any) => asc(t.sort),
      },
      salary_expectations: {
        columns: { sort: true, job_title: true, company_type: true, employment_type: true, work_arrangement: true, experience_level: true, region: true, hourly_rate: true, month_salary: true, year_salary: true, daily_rate: true },
        orderBy: (t: any, { asc }: any) => asc(t.sort),
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
      location: baseProfile.location || undefined,
      phone_number: baseProfile.phone_number || undefined,
      email_address: baseProfile.email_address || undefined,
      personal_website: baseProfile.personal_website || undefined,
      linkedin_profile: baseProfile.linkedin_profile || undefined,
      github_profile: baseProfile.github_profile || undefined,
      stackoverflow_profile: baseProfile.stackoverflow_profile || undefined,
      npm_profile: baseProfile.npm_profile || undefined,
      pypi_profile: baseProfile.pypi_profile || undefined,
      signal_profile: baseProfile.signal_profile || undefined,
      whatsapp_number: baseProfile.whatsapp_number || undefined,
      telegram_username: baseProfile.telegram_username || undefined,
      subtitle: baseProfile.subtitle || undefined,
      core_stack: baseProfile.core_stack || undefined,
      headline: baseProfile.headline || undefined,
      summary: baseProfile.summary || undefined,
      about_me_text: baseProfile.about_me_text || undefined,
      nationality: baseProfile.nationality || undefined,
      location_url: baseProfile.location_url || undefined,
      location_timezone: baseProfile.location_timezone || undefined,
      meta_image_url: baseProfile.meta_image_url || undefined,
      dev_start_year: baseProfile.dev_start_year,
      python_js_start_year: baseProfile.python_js_start_year,
      remote_start_year: baseProfile.remote_start_year,
      company_name: baseProfile.company_name || undefined,
      street_address: baseProfile.street_address || undefined,
      postal_code: baseProfile.postal_code || undefined,
      vat_id: baseProfile.vat_id || undefined,
      kvk_number: baseProfile.kvk_number || undefined,
      profile_versions:
        baseProfile.profile_versions.map(
          (pv) => ({
            status: pv.status || undefined,
            sort: pv.sort,
            slug: pv.slug || undefined,
            name: pv.name || undefined,
            toggles: pv.toggles,
            extends_from: pv
              .extension_links
              ?.[0]
              ?.extended
              ?.slug,
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
          tech_type: skill.tech_skill_type?.slug || null,
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
        repo_url: proj.repo_url || undefined,
        tags: proj.tags,
        achievements: proj.side_project_achievements,
        technologies: proj.side_project_technologies,
      })),
      education: baseProfile.educations,
      languages: baseProfile.languages,
      references: baseProfile.references,
      certificates: baseProfile.certificates,
      project_stories: baseProfile.project_stories,
      cheat_sheets: baseProfile.cheat_sheets,
      salary_expectations: baseProfile.salary_expectations,
    },
  } as ExportedProfile;

  const profileName =
    baseProfile.name?.replace(/\s+/g, "-").toLowerCase() || "profile";

  return { data: exportData, profileName };
}
