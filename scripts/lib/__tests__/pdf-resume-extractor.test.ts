/**
 * Unit tests for PDF resume extractor
 * Tests LLM-powered extraction of structured data from PDF files
 */

import { beforeEach, describe, expect, it, vi } from "vitest";
import type { ResumeData } from "../types/resume-import.types";

// Mock dependencies
vi.mock("fs", () => ({
  readFileSync: vi.fn(),
}));

vi.mock("pdf-parse", () => ({
  default: vi.fn(),
}));

vi.mock("$lib/server/llm", () => ({
  generateChatCompletion: vi.fn(),
}));

import { extractResumeFromPdf } from "../pdf-resume-extractor";
import { readFileSync } from "fs";
import pdf from "pdf-parse";
import { generateChatCompletion } from "$lib/server/llm";

describe("extractResumeFromPdf", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should extract resume data from PDF successfully", async () => {
    const mockPdfBuffer = Buffer.from("mock pdf data");
    const mockPdfText = `
      John Doe
      Senior Software Engineer
      john@example.com | (555) 123-4567
      San Francisco, CA

      Experience:
      Tech Corp - Senior Developer (2020-2023)
      - Improved performance by 50%
      - Led team of 5 developers

      Education:
      University of Technology - BS Computer Science (2014)

      Skills:
      JavaScript, TypeScript, React, Node.js
    `;

    const mockResumeData: ResumeData = {
      basics: {
        name: "John Doe",
        title: "Senior Software Engineer",
        email: "john@example.com",
        phone: "(555) 123-4567",
        location: "San Francisco, CA",
      },
      work: [
        {
          name: "Tech Corp",
          position: "Senior Developer",
          startDate: "2020-01-01",
          endDate: "2023-12-31",
          achievements: [
            "Improved performance by 50%",
            "Led team of 5 developers",
          ],
        },
      ],
      education: [
        {
          institution: "University of Technology",
          area: "Computer Science",
          studyType: "Bachelor",
          graduationYear: 2014,
        },
      ],
      skills: [
        {
          name: "Programming",
          skills: [
            { name: "JavaScript" },
            { name: "TypeScript" },
            { name: "React" },
            { name: "Node.js" },
          ],
        },
      ],
    };

    // Mock file reading
    (readFileSync as any).mockReturnValue(mockPdfBuffer);

    // Mock PDF parsing
    (pdf as any).mockResolvedValue({
      text: mockPdfText,
      numpages: 1,
      info: {},
    });

    // Mock LLM response
    (generateChatCompletion as any).mockResolvedValue(
      JSON.stringify(mockResumeData),
    );

    const result = await extractResumeFromPdf("/path/to/resume.pdf");

    expect(result).toEqual(mockResumeData);
    expect(readFileSync).toHaveBeenCalledWith("/path/to/resume.pdf");
    expect(pdf).toHaveBeenCalledWith(mockPdfBuffer);
    expect(generateChatCompletion).toHaveBeenCalled();
  });

  it("should throw error for empty PDF text", async () => {
    const mockPdfBuffer = Buffer.from("mock pdf data");

    (readFileSync as any).mockReturnValue(mockPdfBuffer);
    (pdf as any).mockResolvedValue({
      text: "",
      numpages: 1,
      info: {},
    });

    await expect(extractResumeFromPdf("/path/to/resume.pdf")).rejects.toThrow(
      "No text could be extracted from PDF",
    );
  });

  it("should throw error if LLM fails to extract name", async () => {
    const mockPdfBuffer = Buffer.from("mock pdf data");
    const mockPdfText = "Some resume text without proper structure";

    const mockIncompleteData = {
      basics: {
        // Missing name
        email: "john@example.com",
      },
    };

    (readFileSync as any).mockReturnValue(mockPdfBuffer);
    (pdf as any).mockResolvedValue({
      text: mockPdfText,
      numpages: 1,
      info: {},
    });
    (generateChatCompletion as any).mockResolvedValue(
      JSON.stringify(mockIncompleteData),
    );

    await expect(extractResumeFromPdf("/path/to/resume.pdf")).rejects.toThrow(
      "Failed to extract profile name from resume",
    );
  });

  it("should call LLM with correct parameters", async () => {
    const mockPdfBuffer = Buffer.from("mock pdf data");
    const mockPdfText = "Resume text";
    const mockResumeData: ResumeData = {
      basics: {
        name: "John Doe",
      },
    };

    (readFileSync as any).mockReturnValue(mockPdfBuffer);
    (pdf as any).mockResolvedValue({
      text: mockPdfText,
      numpages: 1,
      info: {},
    });
    (generateChatCompletion as any).mockResolvedValue(
      JSON.stringify(mockResumeData),
    );

    await extractResumeFromPdf("/path/to/resume.pdf");

    const llmCall = (generateChatCompletion as any).mock.calls[0];
    const [messages, options] = llmCall;

    // Verify messages structure
    expect(messages).toHaveLength(2);
    expect(messages[0].role).toBe("system");
    expect(messages[1].role).toBe("user");
    expect(messages[1].content).toContain(mockPdfText);

    // Verify options
    expect(options.model).toBe("meta-llama/llama-4-scout-17b-16e-instruct");
    expect(options.maxTokens).toBe(4096);
    expect(options.temperature).toBe(0.1);
    expect(options.responseFormat).toBeDefined();
    expect(options.responseFormat.type).toBe("json_schema");
  });

  it("should handle PDF parsing errors", async () => {
    const mockPdfBuffer = Buffer.from("mock pdf data");

    (readFileSync as any).mockReturnValue(mockPdfBuffer);
    (pdf as any).mockRejectedValue(new Error("Invalid PDF format"));

    await expect(extractResumeFromPdf("/path/to/resume.pdf")).rejects.toThrow(
      "Failed to extract resume from PDF: Invalid PDF format",
    );
  });

  it("should handle LLM errors", async () => {
    const mockPdfBuffer = Buffer.from("mock pdf data");
    const mockPdfText = "Resume text";

    (readFileSync as any).mockReturnValue(mockPdfBuffer);
    (pdf as any).mockResolvedValue({
      text: mockPdfText,
      numpages: 1,
      info: {},
    });
    (generateChatCompletion as any).mockRejectedValue(
      new Error("LLM service unavailable"),
    );

    await expect(extractResumeFromPdf("/path/to/resume.pdf")).rejects.toThrow(
      "Failed to extract resume from PDF: LLM service unavailable",
    );
  });

  it("should handle file reading errors", async () => {
    (readFileSync as any).mockImplementation(() => {
      throw new Error("File not found");
    });

    await expect(extractResumeFromPdf("/path/to/resume.pdf")).rejects.toThrow(
      "Failed to extract resume from PDF: File not found",
    );
  });

  it("should extract all resume sections when present", async () => {
    const mockPdfBuffer = Buffer.from("mock pdf data");
    const mockPdfText = "Complete resume with all sections";

    const mockCompleteData: ResumeData = {
      basics: {
        name: "Jane Smith",
        title: "Full Stack Developer",
        email: "jane@example.com",
        phone: "555-1234",
        location: "New York, NY",
        website: "https://janesmith.dev",
        linkedin: "https://linkedin.com/in/janesmith",
        github: "https://github.com/janesmith",
        summary: "Experienced developer with 8 years in web development",
      },
      work: [
        {
          name: "Company A",
          position: "Lead Developer",
          startDate: "2020-01-01",
          achievements: ["Achievement 1", "Achievement 2"],
          technologies: ["React", "Node.js"],
        },
      ],
      education: [
        {
          institution: "Tech University",
          area: "Computer Science",
          studyType: "Master",
          graduationYear: 2015,
        },
      ],
      skills: [
        {
          name: "Frontend",
          skills: [
            { name: "React", level: "expert" },
            { name: "Vue", level: "proficient" },
          ],
        },
      ],
      languages: [
        { name: "English", proficiency: "native" },
        { name: "Spanish", proficiency: "fluent" },
      ],
      projects: [
        {
          name: "Open Source Project",
          url: "https://github.com/project",
          summary: "A cool project",
          technologies: ["TypeScript", "React"],
        },
      ],
      references: [
        {
          author: "John Manager",
          authorPosition: "CTO",
          text: "Jane is an excellent developer",
        },
      ],
    };

    (readFileSync as any).mockReturnValue(mockPdfBuffer);
    (pdf as any).mockResolvedValue({
      text: mockPdfText,
      numpages: 2,
      info: {},
    });
    (generateChatCompletion as any).mockResolvedValue(
      JSON.stringify(mockCompleteData),
    );

    const result = await extractResumeFromPdf("/path/to/resume.pdf");

    expect(result.basics.name).toBe("Jane Smith");
    expect(result.work).toHaveLength(1);
    expect(result.education).toHaveLength(1);
    expect(result.skills).toHaveLength(1);
    expect(result.languages).toHaveLength(2);
    expect(result.projects).toHaveLength(1);
    expect(result.references).toHaveLength(1);
  });
});
