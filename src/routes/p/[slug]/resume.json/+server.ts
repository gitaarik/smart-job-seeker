import { error, json } from "@sveltejs/kit";
import type { RequestHandler } from "./$types";
import { getProfileByIdentifier } from "$lib/server/profile/default";
import { getLatestExportWithFile } from "$lib/server/profile/export-files";
import { dbDirect } from "$lib/server/db";
import { exportProfileToJsonResume } from "../../../../../scripts/lib/json-resume-exporter";

export const GET: RequestHandler = async ({ params }) => {
  const { slug } = params;

  // Get profile by slug
  const profile = await getProfileByIdentifier(slug);

  if (!profile) {
    throw error(404, `Profile not found: ${slug}`);
  }

  // Try to get pre-generated JSON Resume export from profile_exports
  const exportWithFile = await getLatestExportWithFile({
    profileId: profile.id,
    exportType: "resume",
    fileType: "json",
    exportFormat: "json_resume", // Specifically look for JSON Resume format
  });

  // If we found a pre-generated export, serve it
  if (exportWithFile) {
    const jsonContent = JSON.parse(exportWithFile.buffer.toString("utf-8"));
    return json(jsonContent, {
      headers: {
        "Content-Type": "application/json",
        "Content-Disposition": `attachment; filename="${slug}-resume.json"`,
        "Cache-Control": "public, max-age=3600",
      },
    });
  }

  // No pre-generated export found, generate on-the-fly
  // Fetch full profile with all relations needed for JSON Resume export
  const fullProfile = await dbDirect.profiles.findUnique({
    where: { id: profile.id },
    select: {
      id: true,
      name: true,
      title: true,
      email_address: true,
      phone_number: true,
      personal_website: true,
      summary: true,
      location: true,
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

  if (!fullProfile) {
    throw error(500, "Failed to load profile for JSON export");
  }

  const jsonResume = exportProfileToJsonResume(fullProfile);

  return json(jsonResume, {
    headers: {
      "Content-Type": "application/json",
      "Content-Disposition": `attachment; filename="${slug}-resume.json"`,
      "Cache-Control": "no-cache", // Don't cache on-the-fly generation
    },
  });
};
