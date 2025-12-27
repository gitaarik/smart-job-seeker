/**
 * JSON Resume export mapper
 * Converts internal database format to JSON Resume schema format
 */

import type { JsonResumeSchema } from "./json-resume-mapper";
import type { Prisma } from "../../generated/prisma";

/**
 * Type for profile data with all nested relations
 */
type ProfileWithRelations = Prisma.profilesGetPayload<{
  select: {
    name: true;
    title: true;
    email_address: true;
    phone_number: true;
    personal_website: true;
    summary: true;
    location_city: true;
    location_region: true;
    location_country_code: true;
    linkedin_profile: true;
    github_profile: true;
    stackoverflow_profile: true;
    work_experiences: {
      select: {
        name: true;
        position: true;
        location: true;
        website: true;
        start_date: true;
        end_date: true;
        summary: true;
        description: true;
        work_experience_achievements: {
          select: { description: true };
        };
        work_experience_technologies: {
          select: { name: true };
        };
      };
    };
    education: {
      select: {
        institution: true;
        url: true;
        area: true;
        study_type: true;
        start_date: true;
        end_date: true;
        graduation_year: true;
      };
    };
    tech_skill_categories: {
      select: {
        name: true;
        tech_skills: {
          select: { name: true; level: true };
        };
      };
    };
    languages: {
      select: { name: true; proficiency: true };
    };
    side_projects: {
      select: {
        name: true;
        url: true;
        summary: true;
        start_date: true;
        end_date: true;
        stars: true;
        side_project_achievements: {
          select: { description: true };
        };
        side_project_technologies: {
          select: { name: true };
        };
      };
    };
    references: {
      select: { author: true; text: true };
    };
  };
}>;

/**
 * Export profile data to JSON Resume format
 */
export function exportProfileToJsonResume(
  profile: ProfileWithRelations,
): JsonResumeSchema {
  // Build profiles array
  const profiles: Array<{ network: string; username?: string; url: string }> =
    [];

  if (profile.linkedin_profile) {
    profiles.push({
      network: "LinkedIn",
      username: extractUsernameFromUrl(profile.linkedin_profile),
      url: profile.linkedin_profile,
    });
  }

  if (profile.github_profile) {
    profiles.push({
      network: "GitHub",
      username: extractUsernameFromUrl(profile.github_profile),
      url: profile.github_profile,
    });
  }

  if (profile.stackoverflow_profile) {
    profiles.push({
      network: "Stack Overflow",
      username: extractUsernameFromUrl(profile.stackoverflow_profile),
      url: profile.stackoverflow_profile,
    });
  }

  // Build location object from separate fields with location_ prefix
  const location: JsonResumeSchema["basics"]["location"] = {};
  if (profile.location_city) location.city = profile.location_city;
  if (profile.location_region) location.region = profile.location_region;
  if (profile.location_country_code) {
    location.countryCode = profile.location_country_code;
  }

  // Build JSON Resume object
  const jsonResume: JsonResumeSchema = {
    $schema:
      "https://raw.githubusercontent.com/jsonresume/resume-schema/v1.0.0/schema.json",
    basics: {
      name: profile.name || "",
      label: profile.title,
      email: profile.email_address,
      phone: profile.phone_number,
      url: profile.personal_website,
      summary: profile.summary,
      location: Object.keys(location).length > 0 ? location : undefined,
      profiles,
    },

    // Work experiences
    work: profile.work_experiences?.map((work) => ({
      name: work.name,
      position: work.position,
      location: work.location,
      url: work.website,
      startDate: work.start_date ? formatDate(work.start_date) : undefined,
      endDate: work.end_date ? formatDate(work.end_date) : undefined,
      summary: work.summary || undefined,
      description: work.description,
      highlights:
        work.work_experience_achievements?.map((a) => a.description) || [],
    })),

    // Education
    education: profile.education?.map((edu) => ({
      institution: edu.institution,
      url: edu.url,
      area: edu.area,
      studyType: edu.study_type,
      startDate: edu.start_date ? formatDate(edu.start_date) : undefined,
      endDate: edu.end_date ? formatDate(edu.end_date) : undefined,
    })),

    // Skills (flatten categories into skill groups)
    skills: profile.tech_skill_categories?.map((category) => {
      // Find the highest skill level in this category
      const maxLevel = findMaxSkillLevel(
        category.tech_skills.map((s) => s.level || "beginner"),
      );

      return {
        name: category.name,
        level: mapSkillLevelToJsonResume(maxLevel),
        keywords: category.tech_skills.map((s) => s.name),
      };
    }),

    // Languages
    languages: profile.languages?.map((lang) => ({
      language: lang.name,
      fluency: mapLanguageProficiencyToJsonResume(lang.proficiency),
    })),

    // Side projects
    projects: profile.side_projects?.map((project) => {
      const highlights = project.side_project_achievements?.map((a) =>
        a.description
      ) || [];

      // Add GitHub stars to highlights if present
      if (project.stars && project.stars > 0) {
        highlights.push(`⭐ ${project.stars} GitHub stars`);
      }

      return {
        name: project.name,
        description: project.summary,
        url: project.url,
        startDate: project.start_date
          ? formatDate(project.start_date)
          : undefined,
        endDate: project.end_date ? formatDate(project.end_date) : undefined,
        highlights,
        keywords: project.side_project_technologies?.map((t) => t.name) || [],
      };
    }),

    // References
    references: profile.references?.map((ref) => ({
      name: ref.author,
      reference: ref.text,
    })),
  };

  return jsonResume;
}

/**
 * Format a date to ISO 8601 (YYYY-MM-DD)
 */
function formatDate(date: Date | string): string {
  const d = typeof date === "string" ? new Date(date) : date;
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

/**
 * Extract username from a profile URL
 * e.g., "https://github.com/alexmorgan" -> "alexmorgan"
 */
function extractUsernameFromUrl(url: string): string | undefined {
  try {
    const urlObj = new URL(url);
    const pathParts = urlObj.pathname.split("/").filter((p) => p);
    return pathParts[0];
  } catch {
    return undefined;
  }
}

/**
 * Find the highest skill level from an array
 */
function findMaxSkillLevel(
  levels: Array<"expert" | "proficient" | "intermediate" | "beginner">,
): "expert" | "proficient" | "intermediate" | "beginner" {
  if (levels.includes("expert")) return "expert";
  if (levels.includes("proficient")) return "proficient";
  if (levels.includes("intermediate")) return "intermediate";
  return "beginner";
}

/**
 * Map internal skill level to JSON Resume format
 */
function mapSkillLevelToJsonResume(
  level: "expert" | "proficient" | "intermediate" | "beginner",
): string {
  const mapping = {
    expert: "Master",
    proficient: "Advanced",
    intermediate: "Intermediate",
    beginner: "Beginner",
  };
  return mapping[level];
}

/**
 * Map internal language proficiency to JSON Resume fluency
 */
function mapLanguageProficiencyToJsonResume(
  proficiency?: "native" | "fluent" | "proficient" | "conversational" | "basic",
): string | undefined {
  if (!proficiency) return undefined;

  const mapping = {
    native: "Native speaker",
    fluent: "Fluent",
    proficient: "Professional working proficiency",
    conversational: "Conversational",
    basic: "Elementary proficiency",
  };

  return mapping[proficiency];
}
