/**
 * LLM-based resume parsing
 * Extracts structured data from resume text using AI
 */

import { z } from "zod";
import { generateChatCompletion } from "$lib/server/llm";
import type { ChatMessage } from "$lib/server/llm";
import type { ResumeData } from "./types";

const SYSTEM_PROMPT =
  `You are a resume parser that extracts structured information from resume text. Extract all available information and return it in the specified JSON format.

Guidelines:
- Extract all work experience, including company name, position, dates, and accomplishments
- Identify education history with institution names, degrees, and dates
- Categorize technical skills into logical groups (e.g., "Frontend", "Backend", "Databases")
- Extract language proficiencies if mentioned
- Find personal projects or side projects
- Include contact information (email, phone, location, social profiles)
- For dates, use ISO 8601 format (YYYY-MM-DD) when possible
- If information is not available, omit those fields rather than guessing
- Be thorough - extract all relevant details from the resume text`;

// Zod schema for resume data
const ResumeBasicsSchema = z.object({
  name: z.string(),
  email: z.string().optional(),
  phone: z.string().optional(),
  title: z.string().optional(),
  summary: z.string().optional(),
  location: z.string().optional(),
  website: z.string().optional(),
  linkedin: z.string().optional(),
  github: z.string().optional(),
  stackoverflow: z.string().optional(),
});

const WorkExperienceSchema = z.object({
  name: z.string(),
  position: z.string(),
  location: z.string().optional(),
  website: z.string().optional(),
  startDate: z.string().optional(),
  endDate: z.string().optional(),
  summary: z.string().optional(),
  achievements: z.array(z.string()).optional(),
  technologies: z.array(z.string()).optional(),
});

const EducationSchema = z.object({
  institution: z.string(),
  area: z.string().optional(),
  studyType: z.string().optional(),
  location: z.string().optional(),
  url: z.string().optional(),
  startDate: z.string().optional(),
  endDate: z.string().optional(),
  graduationYear: z.number().optional(),
});

const TechSkillSchema = z.object({
  name: z.string(),
  level: z.enum(["expert", "proficient", "intermediate", "beginner"])
    .optional(),
  yearsExperience: z.number().optional(),
});

const SkillCategorySchema = z.object({
  name: z.string(),
  skills: z.array(TechSkillSchema),
});

const LanguageSchema = z.object({
  name: z.string(),
  languageCode: z.string().optional(),
  proficiency: z
    .enum(["native", "fluent", "proficient", "conversational", "basic"])
    .optional(),
});

const SideProjectSchema = z.object({
  name: z.string(),
  url: z.string().optional(),
  summary: z.string().optional(),
  startDate: z.string().optional(),
  endDate: z.string().optional(),
  achievements: z.array(z.string()).optional(),
  technologies: z.array(z.string()).optional(),
});

const ReferenceSchema = z.object({
  author: z.string(),
  authorPosition: z.string().optional(),
  text: z.string(),
});

const ResumeDataSchema = z.object({
  basics: ResumeBasicsSchema,
  work: z.array(WorkExperienceSchema).optional(),
  education: z.array(EducationSchema).optional(),
  skills: z.array(SkillCategorySchema).optional(),
  languages: z.array(LanguageSchema).optional(),
  projects: z.array(SideProjectSchema).optional(),
  references: z.array(ReferenceSchema).optional(),
});

/**
 * Parse resume text using LLM to extract structured data
 * @throws Error if parsing fails or name cannot be extracted
 */
export async function parseResumeWithLLM(
  resumeText: string,
): Promise<ResumeData> {
  const userPrompt =
    `Extract structured resume data from the following text:\n\n${resumeText}`;

  const messages: ChatMessage[] = [
    { role: "system", content: SYSTEM_PROMPT },
    { role: "user", content: userPrompt },
  ];

  const resumeData = await generateChatCompletion<ResumeData>(messages, {
    model: "meta-llama/llama-4-scout-17b-16e-instruct",
    maxTokens: 4096,
    temperature: 0.1,
    structuredOutput: {
      name: "resume_data",
      schema: ResumeDataSchema,
    },
  });

  if (!resumeData.basics || !resumeData.basics.name) {
    throw new Error("Failed to extract profile name from resume");
  }

  return resumeData;
}
