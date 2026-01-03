/**
 * PDF Resume Extractor
 * Extracts structured resume data from PDF files using LLM
 */

import { readFileSync } from "fs";
import pdf from "pdf-parse";
import { generateChatCompletion } from "$lib/server/llm";
import type { ChatMessage, ResponseFormat } from "$lib/server/llm";
import type { ResumeData } from "./types/resume-import.types";

/**
 * Extract resume data from a PDF file using LLM
 */
export async function extractResumeFromPdf(
  pdfPath: string,
): Promise<ResumeData> {
  try {
    console.log(`📄 Reading PDF file: ${pdfPath}`);

    // Read PDF file
    const dataBuffer = readFileSync(pdfPath);

    // Extract text from PDF
    console.log("📝 Extracting text from PDF...");
    const pdfData = await pdf(dataBuffer);
    const resumeText = pdfData.text;

    if (!resumeText || resumeText.trim().length === 0) {
      throw new Error("No text could be extracted from PDF");
    }

    console.log(`✅ Extracted ${resumeText.length} characters of text\n`);

    // Prepare LLM messages
    const systemPrompt =
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

    const userPrompt = `Extract structured resume data from the following text:

${resumeText}`;

    const messages: ChatMessage[] = [
      { role: "system", content: systemPrompt },
      { role: "user", content: userPrompt },
    ];

    // Define the JSON schema for structured output
    const responseFormat: ResponseFormat = {
      type: "json_schema",
      json_schema: {
        name: "resume_data",
        strict: true,
        schema: {
          type: "object",
          properties: {
            basics: {
              type: "object",
              properties: {
                name: { type: "string" },
                email: { type: "string" },
                phone: { type: "string" },
                title: { type: "string" },
                summary: { type: "string" },
                location: { type: "string" },
                website: { type: "string" },
                linkedin: { type: "string" },
                github: { type: "string" },
                stackoverflow: { type: "string" },
              },
              required: ["name"],
              additionalProperties: false,
            },
            work: {
              type: "array",
              items: {
                type: "object",
                properties: {
                  name: { type: "string" },
                  position: { type: "string" },
                  location: { type: "string" },
                  website: { type: "string" },
                  startDate: { type: "string" },
                  endDate: { type: "string" },
                  summary: { type: "string" },
                  achievements: { type: "array", items: { type: "string" } },
                  technologies: { type: "array", items: { type: "string" } },
                },
                required: ["name", "position"],
                additionalProperties: false,
              },
            },
            education: {
              type: "array",
              items: {
                type: "object",
                properties: {
                  institution: { type: "string" },
                  area: { type: "string" },
                  studyType: { type: "string" },
                  location: { type: "string" },
                  url: { type: "string" },
                  startDate: { type: "string" },
                  endDate: { type: "string" },
                  graduationYear: { type: "number" },
                },
                required: ["institution"],
                additionalProperties: false,
              },
            },
            skills: {
              type: "array",
              items: {
                type: "object",
                properties: {
                  name: { type: "string" },
                  skills: {
                    type: "array",
                    items: {
                      type: "object",
                      properties: {
                        name: { type: "string" },
                        level: {
                          type: "string",
                          enum: [
                            "expert",
                            "proficient",
                            "intermediate",
                            "beginner",
                          ],
                        },
                        yearsExperience: { type: "number" },
                      },
                      required: ["name"],
                      additionalProperties: false,
                    },
                  },
                },
                required: ["name", "skills"],
                additionalProperties: false,
              },
            },
            languages: {
              type: "array",
              items: {
                type: "object",
                properties: {
                  name: { type: "string" },
                  languageCode: { type: "string" },
                  proficiency: {
                    type: "string",
                    enum: [
                      "native",
                      "fluent",
                      "proficient",
                      "conversational",
                      "basic",
                    ],
                  },
                },
                required: ["name"],
                additionalProperties: false,
              },
            },
            projects: {
              type: "array",
              items: {
                type: "object",
                properties: {
                  name: { type: "string" },
                  url: { type: "string" },
                  summary: { type: "string" },
                  startDate: { type: "string" },
                  endDate: { type: "string" },
                  achievements: { type: "array", items: { type: "string" } },
                  technologies: { type: "array", items: { type: "string" } },
                },
                required: ["name"],
                additionalProperties: false,
              },
            },
            references: {
              type: "array",
              items: {
                type: "object",
                properties: {
                  author: { type: "string" },
                  authorPosition: { type: "string" },
                  text: { type: "string" },
                },
                required: ["author", "text"],
                additionalProperties: false,
              },
            },
          },
          required: ["basics"],
          additionalProperties: false,
        },
      },
    };

    // Call LLM with structured output (automatically parses JSON)
    console.log("🤖 Calling LLM to extract structured data...");
    const resumeData = await generateChatCompletion<ResumeData>(messages, {
      model: "meta-llama/llama-4-scout-17b-16e-instruct",
      maxTokens: 4096,
      temperature: 0.1, // Low temperature for more consistent extraction
      responseFormat,
    });

    console.log("✅ LLM extraction complete\n");

    // Validate that we got at least a name
    if (!resumeData.basics || !resumeData.basics.name) {
      throw new Error("Failed to extract profile name from resume");
    }

    return resumeData;
  } catch (error) {
    if (error instanceof Error) {
      throw new Error(`Failed to extract resume from PDF: ${error.message}`);
    }
    throw new Error("Failed to extract resume from PDF: Unknown error");
  }
}
