/**
 * LLM-based resume parsing
 * Extracts structured data from resume text using AI
 */

import { z } from "zod";
import { generateChatCompletion } from "$lib/server/llm";
import type { ChatMessage } from "$lib/server/llm";
import type { ResumeData } from "./types";

const SYSTEM_PROMPT =
  `You are a resume parser that extracts structured information from resume text.

Return a JSON object with this exact structure:
{
  "basics": {
    "name": "Full Name",
    "email": "email@example.com",
    "phone": "+1234567890",
    "title": "Job Title",
    "summary": "Professional summary",
    "location": "City, Country",
    "website": "https://...",
    "linkedin": "https://linkedin.com/in/...",
    "github": "https://github.com/..."
  },
  "work": [
    {
      "name": "Company Name",
      "position": "Job Title",
      "location": "City, Country",
      "startDate": "YYYY-MM-DD",
      "endDate": "YYYY-MM-DD",
      "summary": "Role description",
      "achievements": ["Achievement 1", "Achievement 2"],
      "technologies": ["Tech1", "Tech2"]
    }
  ],
  "education": [
    {
      "institution": "University Name",
      "area": "Field of Study",
      "studyType": "Bachelor's/Master's/etc.",
      "location": "City, Country",
      "startDate": "YYYY-MM-DD",
      "endDate": "YYYY-MM-DD"
    }
  ],
  "skills": [
    {
      "name": "Category Name",
      "skills": [
        { "name": "Skill Name", "level": "expert|proficient|intermediate|beginner" }
      ]
    }
  ],
  "languages": [
    { "name": "Language", "proficiency": "native|fluent|proficient|conversational|basic" }
  ],
  "projects": [
    {
      "name": "Project Name",
      "url": "https://...",
      "summary": "Description",
      "technologies": ["Tech1"]
    }
  ],
  "references": [
    { "author": "Name", "authorPosition": "Their Title", "text": "Reference text" }
  ]
}

Guidelines:
- The "basics" object is REQUIRED and must contain at least "name"
- Omit optional fields/sections if not found in the resume
- Use ISO 8601 dates (YYYY-MM-DD) when possible
- Categorize skills into logical groups (e.g., "Frontend", "Backend", "Databases")
- Be thorough - extract all relevant details`;

// Zod schema for resume data
const ResumeBasicsSchema = z.object({
  name: z.string().min(1),
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
    maxTokens: 8192,
    temperature: 0.1,
    structuredOutput: {
      name: "resume_data",
      schema: ResumeDataSchema,
    },
  });

  if (!resumeData.basics || !resumeData.basics.name) {
    console.error(
      "[Resume Parser] Missing basics.name. Response keys:",
      Object.keys(resumeData),
      "basics:",
      JSON.stringify(resumeData.basics)?.substring(0, 200),
    );
    throw new Error("Failed to extract profile name from resume");
  }

  return resumeData;
}
