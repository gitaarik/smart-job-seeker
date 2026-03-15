/**
 * JSON Resume Schema mapper
 * Converts JSON Resume format to internal ResumeData format
 */

import type { ResumeData } from "./types";

/**
 * JSON Resume Schema interface (based on https://jsonresume.org/schema/)
 */
export interface JsonResumeSchema {
  $schema?: string;
  basics?: {
    name?: string;
    label?: string; // Job title
    image?: string;
    email?: string;
    phone?: string;
    url?: string;
    summary?: string;
    location?: {
      address?: string;
      postalCode?: string;
      city?: string;
      countryCode?: string;
      region?: string;
    };
    profiles?: Array<{
      network?: string; // "LinkedIn", "GitHub", "Twitter", etc.
      username?: string;
      url?: string;
    }>;
  };
  work?: Array<{
    name?: string; // Company name
    position?: string;
    url?: string;
    startDate?: string;
    endDate?: string;
    summary?: string;
    highlights?: string[];
  }>;
  volunteer?: Array<unknown>;
  education?: Array<{
    institution?: string;
    url?: string;
    area?: string;
    studyType?: string;
    startDate?: string;
    endDate?: string;
    score?: string;
    courses?: string[];
  }>;
  awards?: Array<unknown>;
  certificates?: Array<unknown>;
  publications?: Array<unknown>;
  skills?: Array<{
    name?: string;
    level?: string;
    keywords?: string[];
  }>;
  languages?: Array<{
    language?: string;
    fluency?: string;
  }>;
  interests?: Array<unknown>;
  references?: Array<{
    name?: string;
    reference?: string;
  }>;
  projects?: Array<{
    name?: string;
    description?: string;
    highlights?: string[];
    keywords?: string[];
    startDate?: string;
    endDate?: string;
    url?: string;
    roles?: string[];
    entity?: string;
    type?: string;
  }>;
}

/**
 * Map JSON Resume format to internal ResumeData format
 */
export function mapJsonResumeToInternal(
  jsonResume: JsonResumeSchema,
): ResumeData {
  // Validate basics
  if (!jsonResume.basics || !jsonResume.basics.name) {
    throw new Error("JSON Resume must include basics.name field");
  }

  // Extract social profiles
  const linkedin = jsonResume.basics.profiles?.find((p) =>
    p.network?.toLowerCase() === "linkedin"
  )?.url;
  const github = jsonResume.basics.profiles?.find((p) =>
    p.network?.toLowerCase() === "github"
  )?.url;
  const stackoverflow = jsonResume.basics.profiles?.find((p) =>
    p.network?.toLowerCase() === "stackoverflow" ||
    p.network?.toLowerCase() === "stack overflow"
  )?.url;

  // Map to internal format
  const resumeData: ResumeData = {
    basics: {
      name: jsonResume.basics.name,
      email: jsonResume.basics.email,
      phone: jsonResume.basics.phone,
      title: jsonResume.basics.label,
      summary: jsonResume.basics.summary,
      locationCity: jsonResume.basics.location?.city,
      locationRegion: jsonResume.basics.location?.region,
      locationCountryCode: jsonResume.basics.location?.countryCode,
      website: jsonResume.basics.url,
      linkedin,
      github,
      stackoverflow,
    },
    work: jsonResume.work?.map((job) => ({
      name: job.name || "",
      position: job.position || "",
      website: job.url,
      startDate: job.startDate,
      endDate: job.endDate,
      summary: job.summary,
      achievements: job.highlights || [],
    })),
    education: jsonResume.education?.map((edu) => {
      // Try to extract graduation year from endDate
      let graduationYear: number | undefined;
      if (edu.endDate) {
        const year = parseInt(edu.endDate.substring(0, 4), 10);
        if (!isNaN(year)) {
          graduationYear = year;
        }
      }

      return {
        institution: edu.institution || "",
        area: edu.area,
        studyType: edu.studyType,
        url: edu.url,
        startDate: edu.startDate,
        endDate: edu.endDate,
        graduationYear,
      };
    }),
    skills: jsonResume.skills?.map((skill) => ({
      name: skill.name || "Other",
      skills: (skill.keywords || []).map((keyword) => ({
        name: keyword,
        level: mapSkillLevel(skill.level),
      })),
    })),
    languages: jsonResume.languages?.map((lang) => ({
      name: lang.language || "",
      proficiency: mapLanguageProficiency(lang.fluency),
    })),
    projects: jsonResume.projects?.map((project) => ({
      name: project.name || "",
      url: project.url,
      summary: project.description,
      startDate: project.startDate,
      endDate: project.endDate,
      achievements: project.highlights || [],
      technologies: project.keywords || [],
    })),
    references: jsonResume.references?.map((ref) => ({
      author: ref.name || "",
      text: ref.reference || "",
    })),
  };

  return resumeData;
}

/**
 * Map JSON Resume skill level to internal format
 */
function mapSkillLevel(
  level?: string,
): "expert" | "proficient" | "intermediate" | "beginner" | undefined {
  if (!level) return undefined;

  const normalized = level.toLowerCase();

  if (normalized.includes("expert") || normalized.includes("master")) {
    return "expert";
  }
  if (
    normalized.includes("proficient") || normalized.includes("advanced") ||
    normalized.includes("senior")
  ) {
    return "proficient";
  }
  if (normalized.includes("intermediate") || normalized.includes("competent")) {
    return "intermediate";
  }
  if (normalized.includes("beginner") || normalized.includes("junior")) {
    return "beginner";
  }

  return undefined;
}

/**
 * Map JSON Resume language fluency to internal proficiency
 */
function mapLanguageProficiency(
  fluency?: string,
):
  | "native"
  | "fluent"
  | "proficient"
  | "conversational"
  | "basic"
  | undefined {
  if (!fluency) return undefined;

  const normalized = fluency.toLowerCase();

  if (normalized.includes("native")) {
    return "native";
  }
  if (normalized.includes("fluent")) {
    return "fluent";
  }
  if (
    normalized.includes("proficient") || normalized.includes("professional")
  ) {
    return "proficient";
  }
  if (normalized.includes("conversational") || normalized.includes("working")) {
    return "conversational";
  }
  if (
    normalized.includes("basic") || normalized.includes("elementary") ||
    normalized.includes("beginner")
  ) {
    return "basic";
  }

  return undefined;
}

/**
 * Validate JSON Resume schema
 * Basic validation - full validation would require @jsonresume/schema package
 */
export function validateJsonResume(data: unknown): data is JsonResumeSchema {
  if (!data || typeof data !== "object") {
    throw new Error("Invalid JSON Resume: data must be an object");
  }

  const resume = data as JsonResumeSchema;

  if (!resume.basics) {
    throw new Error("Invalid JSON Resume: missing 'basics' field");
  }

  if (!resume.basics.name) {
    throw new Error("Invalid JSON Resume: missing 'basics.name' field");
  }

  return true;
}
