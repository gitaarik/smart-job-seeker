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
      "summary": "Brief 1-2 sentence role description",
      "achievements": ["Specific accomplishment or bullet point 1", "Specific accomplishment or bullet point 2"],
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
      "endDate": "YYYY-MM-DD",
      "graduationYear": 2020
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
- Be thorough - extract all relevant details
- For work experience: "summary" is a brief 1-2 sentence overview of the role. All bullet points, accomplishments, metrics, and specific results go in "achievements". Do NOT put bullet-point content in summary.
- For education: if the resume only shows a single year (e.g. "MSc Computer Science, 2020"), treat it as the graduation year, NOT as a start or end date. Only use startDate/endDate when the resume explicitly provides date ranges for the education period.`;

// Helper: accept string, null, or undefined → string | undefined
const nullableString = z.string().nullable().optional().transform(
  (v) => v ?? undefined,
);

// Zod schema for resume data
const ResumeBasicsSchema = z.object({
  name: z.string().min(1),
  email: nullableString,
  phone: nullableString,
  title: nullableString,
  summary: nullableString,
  location: nullableString,
  website: nullableString,
  linkedin: nullableString,
  github: nullableString,
  stackoverflow: nullableString,
});

const WorkExperienceSchema = z.object({
  name: nullableString,
  position: nullableString,
  location: nullableString,
  website: nullableString,
  startDate: nullableString,
  endDate: nullableString,
  summary: nullableString,
  achievements: z.array(z.string()).nullable().optional().transform(
    (v) => v ?? undefined,
  ),
  technologies: z.array(z.string()).nullable().optional().transform(
    (v) => v ?? undefined,
  ),
});

const EducationSchema = z.object({
  institution: nullableString,
  area: nullableString,
  studyType: nullableString,
  location: nullableString,
  url: nullableString,
  startDate: nullableString,
  endDate: nullableString,
  graduationYear: z.number().nullable().optional().transform(
    (v) => v ?? undefined,
  ),
});

const validSkillLevels = ["expert", "proficient", "intermediate", "beginner"] as const;
const TechSkillSchema = z.object({
  name: nullableString,
  level: z.string().nullable().optional().transform(
    (v) => v && (validSkillLevels as readonly string[]).includes(v)
      ? (v as typeof validSkillLevels[number])
      : undefined,
  ),
  yearsExperience: z.number().nullable().optional().transform(
    (v) => v ?? undefined,
  ),
});

const SkillCategorySchema = z.object({
  name: nullableString,
  skills: z.array(TechSkillSchema),
});

const validProficiencies = ["native", "fluent", "proficient", "conversational", "basic"] as const;
const LanguageSchema = z.object({
  name: nullableString,
  languageCode: nullableString,
  proficiency: z.string().nullable().optional().transform(
    (v) => v && (validProficiencies as readonly string[]).includes(v)
      ? (v as typeof validProficiencies[number])
      : undefined,
  ),
});

const SideProjectSchema = z.object({
  name: nullableString,
  url: nullableString,
  summary: nullableString,
  startDate: nullableString,
  endDate: nullableString,
  achievements: z.array(z.string()).nullable().optional().transform(
    (v) => v ?? undefined,
  ),
  technologies: z.array(z.string()).nullable().optional().transform(
    (v) => v ?? undefined,
  ),
});

const ReferenceSchema = z.object({
  author: nullableString,
  authorPosition: nullableString,
  text: nullableString,
});

const nullableArray = <T extends z.ZodTypeAny>(schema: T) =>
  z.array(schema).nullable().optional().transform((v) => v ?? undefined);

const ResumeDataSchema = z.object({
  basics: ResumeBasicsSchema,
  work: nullableArray(WorkExperienceSchema),
  education: nullableArray(EducationSchema),
  skills: nullableArray(SkillCategorySchema),
  languages: nullableArray(LanguageSchema),
  projects: nullableArray(SideProjectSchema),
  references: nullableArray(ReferenceSchema),
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

  // Filter out entries with missing identity fields and coerce required DB fields
  if (resumeData.work) {
    resumeData.work = resumeData.work.filter((w) => w.name && w.position);
  }
  if (resumeData.education) {
    resumeData.education = resumeData.education.map((e) => ({
      ...e,
      institution: e.institution || "Unknown",
    }));
  }
  if (resumeData.skills) {
    resumeData.skills = resumeData.skills
      .filter((c) => c.name)
      .map((c) => ({
        ...c,
        skills: c.skills.filter((s) => s.name),
      }));
  }
  if (resumeData.languages) {
    resumeData.languages = resumeData.languages.filter((l) => l.name);
  }
  if (resumeData.projects) {
    resumeData.projects = resumeData.projects.filter((p) => p.name);
  }
  if (resumeData.references) {
    resumeData.references = resumeData.references
      .filter((r) => r.author)
      .map((r) => ({ ...r, text: r.text || "" }));
  }

  return resumeData as ResumeData;
}
