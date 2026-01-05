import type { RequestHandler } from "./$types";
import { json } from "@sveltejs/kit";
import { dbDirect } from "$lib/db";
import { exportProfileToJsonResume } from "../../../scripts/lib/json-resume-exporter";

export const GET: RequestHandler = async ({ url }) => {
  const version = url.searchParams.get("version");

  // Get default profile with full relations
  const profile = await dbDirect.profiles.findFirst({
    where: { is_default: true },
    select: {
      id: true,
      name: true,
      title: true,
      email_address: true,
      phone_number: true,
      personal_website: true,
      summary: true,
      location_city: true,
      location_region: true,
      location_country_code: true,
      linkedin_profile: true,
      github_profile: true,
      stackoverflow_profile: true,

      work_experiences: {
        select: {
          name: true,
          position: true,
          location: true,
          website: true,
          start_date: true,
          end_date: true,
          summary: true,
          description: true,
          work_experience_achievements: {
            select: { description: true },
            orderBy: { sort: "asc" },
          },
          work_experience_technologies: {
            select: { name: true },
            orderBy: { sort: "asc" },
          },
        },
        orderBy: { sort: "asc" },
      },

      education: {
        select: {
          institution: true,
          url: true,
          area: true,
          study_type: true,
          start_date: true,
          end_date: true,
          graduation_year: true,
        },
        orderBy: { sort: "asc" },
      },

      tech_skill_categories: {
        select: {
          name: true,
          tech_skills: {
            select: { name: true, level: true },
            orderBy: { sort: "asc" },
          },
        },
        orderBy: { sort: "asc" },
      },

      languages: {
        select: { name: true, proficiency: true },
        orderBy: { sort: "asc" },
      },

      side_projects: {
        select: {
          name: true,
          url: true,
          summary: true,
          start_date: true,
          end_date: true,
          stars: true,
          side_project_achievements: {
            select: { description: true },
            orderBy: { sort: "asc" },
          },
          side_project_technologies: {
            select: { name: true },
            orderBy: { sort: "asc" },
          },
        },
        orderBy: { sort: "asc" },
      },

      references: {
        select: { author: true, text: true },
        orderBy: { sort: "asc" },
      },
    },
  });

  if (!profile) {
    return json({ error: "Default profile not found" }, { status: 404 });
  }

  const jsonResume = exportProfileToJsonResume(profile);

  return json(jsonResume, {
    headers: {
      "Content-Type": "application/json",
      "Content-Disposition": `attachment; filename="resume-${profile.id}.json"`,
      "Cache-Control": "no-cache",
    },
  });
};
