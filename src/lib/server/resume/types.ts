/**
 * Resume import types
 * Used for CV/resume parsing and profile creation
 */

/**
 * Basic profile information
 */
export interface ResumeBasics {
  name: string;
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
  name: string;
  position: string;
  location?: string;
  website?: string;
  startDate?: string;
  endDate?: string;
  summary?: string;
  achievements?: string[];
  technologies?: string[];
}

/**
 * Education entry
 */
export interface Education {
  institution: string;
  area?: string;
  studyType?: string;
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
 * Technical skill category
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
  languageCode?: string;
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
  urlLabel?: string;
  summary?: string;
  startDate?: string;
  endDate?: string;
  achievements?: string[];
  technologies?: string[];
  stars?: number;
}

/**
 * Professional certificate
 */
export interface Certificate {
  name: string;
  issuer?: string;
  date?: string;
  url?: string;
}

/**
 * Professional reference
 */
export interface Reference {
  author: string;
  authorPosition?: string;
  text: string;
}

/**
 * Complete resume data structure
 */
export interface ResumeData {
  basics: ResumeBasics;
  work?: WorkExperience[];
  education?: Education[];
  skills?: SkillCategory[];
  languages?: Language[];
  projects?: SideProject[];
  certificates?: Certificate[];
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
    certificates?: number;
    references?: number;
  };
  errors?: string[];
}
