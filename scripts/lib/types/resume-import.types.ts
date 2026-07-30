/**
 * Shared type definitions for resume import
 * Used by both JSON Resume and PDF resume importers
 */

/**
 * Basic profile information
 */
export interface ResumeBasics {
  name: string; // Required
  email?: string;
  phone?: string;
  title?: string;
  summary?: string;
  location?: string;
  website?: string;
  linkedin?: string;
  github?: string;
  stackoverflow?: string;
  headline?: string;
  subtitle?: string;
  coreStack?: string;
}

/**
 * Work experience entry
 */
export interface WorkExperience {
  name: string; // Company name
  position: string;
  location?: string;
  website?: string;
  startDate?: string; // ISO 8601 date
  endDate?: string; // ISO 8601 date or null for current
  summary?: string;
  description?: string;
  achievements?: string[]; // Highlights/accomplishments
  technologies?: string[]; // Tech stack used
}

/**
 * Education entry
 */
export interface Education {
  institution: string;
  area?: string; // Field of study
  studyType?: string; // Degree type (Bachelor's, Master's, etc.)
  location?: string;
  url?: string;
  startDate?: string;
  endDate?: string;
  graduationYear?: number;
  summary?: string;
}

/**
 * Individual technical skill
 */
export interface TechSkill {
  name: string;
  level?: "expert" | "proficient" | "intermediate" | "beginner";
  yearsExperience?: number;
}

/**
 * Technical skill category (e.g., "Frontend", "Backend")
 */
export interface SkillCategory {
  name: string;
  skills: TechSkill[];
}

/**
 * Language proficiency
 */
export interface Language {
  name: string;
  languageCode?: string; // ISO 639-1 code
  proficiency?:
    | "native"
    | "fluent"
    | "proficient"
    | "conversational"
    | "basic";
}

/**
 * Personal side project
 */
export interface SideProject {
  name: string;
  url?: string;
  repoUrl?: string;
  summary?: string;
  startDate?: string;
  endDate?: string;
  achievements?: string[];
  technologies?: string[];
  stars?: number; // GitHub stars
}

/**
 * Professional reference
 */
export interface Reference {
  author: string; // Person providing reference
  authorPosition?: string; // Their job title
  text: string; // Reference content
}

/**
 * Complete resume data structure (source-agnostic)
 */
export interface ResumeData {
  basics: ResumeBasics;
  work?: WorkExperience[];
  education?: Education[];
  skills?: SkillCategory[];
  languages?: Language[];
  projects?: SideProject[];
  references?: Reference[];
}

/**
 * Result of a profile import operation
 */
export interface ProfileImportResult {
  success: boolean;
  profileId?: number;
  message: string;
  stats?: {
    workExperiences?: number;
    education?: number;
    skillCategories?: number;
    totalSkills?: number;
    languages?: number;
    projects?: number;
    references?: number;
  };
  errors?: string[];
}
