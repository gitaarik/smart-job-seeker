/**
 * Converts ExportedProfile (SJS export format) to ResumeData (internal editor format).
 * Shared between profile creation and profile import flows.
 */

import type { ResumeData } from "$lib/server/resume/types";
import type { ExportedProfile } from "$lib/server/profile/export-profile-json";

const validLevels = ["expert", "proficient", "intermediate", "beginner"] as const;
type Level = (typeof validLevels)[number];

const validProficiencies = [
  "native",
  "fluent",
  "proficient",
  "conversational",
  "basic",
] as const;
type Proficiency = (typeof validProficiencies)[number];

function normalizeLevel(value?: string): Level | undefined {
  if (!value) return undefined;
  return validLevels.includes(value as Level) ? (value as Level) : undefined;
}

function normalizeProficiency(value?: string): Proficiency | undefined {
  if (!value) return undefined;
  return validProficiencies.includes(value as Proficiency)
    ? (value as Proficiency)
    : undefined;
}

function dateToString(value: Date | string | null | undefined): string | undefined {
  if (!value) return undefined;
  if (value instanceof Date) return value.toISOString().split("T")[0];
  return String(value).split("T")[0];
}

export function convertExportToResumeData(exported: ExportedProfile): ResumeData {
  const p = exported.profile;

  return {
    basics: {
      name: p.name || "",
      title: p.title,
      email: p.email_address,
      phone: p.phone_number,
      location: p.location,
      summary: p.summary,
      website: p.personal_website,
      linkedin: p.linkedin_profile,
      github: p.github_profile,
      stackoverflow: p.stackoverflow_profile,
      headline: p.headline,
      subtitle: p.subtitle,
      coreStack: p.core_stack,
    },
    work: p.work_experiences?.map((w) => ({
      name: w.name || "",
      position: w.position || "",
      location: w.location,
      website: w.website,
      startDate: dateToString(w.start_date),
      endDate: dateToString(w.end_date),
      summary: w.summary,
      achievements:
        w.achievements?.filter((a) => a.description).map((a) => a.description!) || [],
      technologies:
        w.technologies?.filter((t) => t.name).map((t) => t.name!) || [],
    })),
    education: p.education?.map((e) => ({
      institution: e.institution || "",
      area: e.area,
      studyType: e.study_type,
      location: e.location,
      url: e.url,
      startDate: dateToString(e.start_date),
      endDate: dateToString(e.end_date),
      graduationYear: e.graduation_year ?? undefined,
      summary: e.summary,
    })),
    skills: p.tech_skill_categories?.map((cat) => ({
      name: cat.name || "",
      skills:
        cat.tech_skills?.map((s) => ({
          name: s.name || "",
          level: normalizeLevel(s.level),
          yearsExperience: s.years_experience
            ? parseFloat(s.years_experience)
            : undefined,
        })) || [],
    })),
    languages: p.languages?.map((l) => ({
      name: l.name || "",
      languageCode: l.language_code,
      proficiency: normalizeProficiency(l.proficiency),
    })),
    projects: p.side_projects?.map((proj) => ({
      name: proj.name || "",
      url: proj.url,
      urlLabel: proj.url_label,
      summary: proj.summary,
      startDate: dateToString(proj.start_date),
      endDate: dateToString(proj.end_date),
      achievements:
        proj.achievements?.filter((a) => a.description).map((a) => a.description!) ||
        [],
      technologies:
        proj.technologies?.filter((t) => t.name).map((t) => t.name!) || [],
      stars: proj.stars ?? undefined,
    })),
    certificates: p.certificates?.map((c) => ({
      name: c.name || "",
      issuer: c.issuer,
      date: dateToString(c.date),
      url: c.url,
    })),
    references: p.references?.map((r) => ({
      author: r.author || "",
      authorPosition: r.author_position,
      text: r.text || "",
    })),
  };
}
