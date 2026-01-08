import { describe, expect, it } from "vitest";
import {
  aiPromptSchemas,
  detectLoginPageSchema,
  detectPaginationSchema,
  extractJobDataSchema,
  extractJobLinksSchema,
  extractResumeDataSchema,
  getSchemaForPrompt,
  scoreJobMatchSchema,
} from "../ai-prompt-schemas";

describe("AI Prompt Schemas", () => {
  describe("Schema Registry", () => {
    it("should have all expected schemas in registry", () => {
      expect(aiPromptSchemas).toHaveProperty("extract_job_links");
      expect(aiPromptSchemas).toHaveProperty("extract_job_data");
      expect(aiPromptSchemas).toHaveProperty("extract_job_data_browser_use");
      expect(aiPromptSchemas).toHaveProperty("score_job_match");
      expect(aiPromptSchemas).toHaveProperty("detect_login_page");
      expect(aiPromptSchemas).toHaveProperty("detect_pagination");
      expect(aiPromptSchemas).toHaveProperty("extract_resume_data");
    });

    it("should get schema by request name", () => {
      const schema = getSchemaForPrompt("extract_job_links");
      expect(schema).toBeDefined();
      expect(schema).toBe(extractJobLinksSchema);
    });

    it("should return undefined for unknown request", () => {
      const schema = getSchemaForPrompt("unknown_request");
      expect(schema).toBeUndefined();
    });

    it("should return undefined for text-only prompts without structured output", () => {
      // These prompts return plain text, not structured JSON
      expect(getSchemaForPrompt("write_cover_letter")).toBeUndefined();
      expect(getSchemaForPrompt("write_motivation_letter")).toBeUndefined();
      expect(getSchemaForPrompt("answer_application_question")).toBeUndefined();
    });
  });

  describe("extractJobLinksSchema", () => {
    it("should validate valid job links data", () => {
      const validData = {
        urls: [
          "https://example.com/job1",
          "https://example.com/job2",
        ],
      };
      expect(() => extractJobLinksSchema.parse(validData)).not.toThrow();
    });

    it("should reject invalid data structure", () => {
      const invalidData = ["https://example.com/job1"]; // Array instead of object
      expect(() => extractJobLinksSchema.parse(invalidData)).toThrow();
    });

    it("should reject non-array urls field", () => {
      const invalidData = { urls: "not-an-array" };
      expect(() => extractJobLinksSchema.parse(invalidData)).toThrow();
    });
  });

  describe("extractJobDataSchema", () => {
    it("should validate complete job data", () => {
      const validData = {
        title: "Software Engineer",
        job_description: "Full description here",
        company_description: "Company info",
        job_poster: "HR Manager",
        date_posted: "2026-01-08",
        location: "Remote",
        remote: "remote",
        experience_level: "senior",
        job_type: "full_time",
        salary_min: 80000,
        salary_max: 120000,
        salary_currency: "EUR",
        salary_period: "year",
        skills: ["JavaScript", "React", "Node.js"],
        status: "hiring",
      };
      expect(() => extractJobDataSchema.parse(validData)).not.toThrow();
    });

    it("should allow null values for optional fields", () => {
      const dataWithNulls = {
        title: "Software Engineer",
        job_description: "Full description",
        company_description: null,
        job_poster: null,
        date_posted: null,
        location: null,
        remote: null,
        experience_level: null,
        job_type: null,
        salary_min: null,
        salary_max: null,
        salary_currency: null,
        salary_period: null,
        skills: null,
        status: null,
      };
      expect(() => extractJobDataSchema.parse(dataWithNulls)).not.toThrow();
    });

    it("should reject invalid salary values", () => {
      const invalidData = {
        title: "Software Engineer",
        job_description: "Description",
        company_description: null,
        job_poster: null,
        date_posted: null,
        location: null,
        remote: null,
        experience_level: null,
        job_type: null,
        salary_min: "80000", // String instead of number
        salary_max: 120000,
        salary_currency: "EUR",
        salary_period: "year",
        skills: null,
        status: null,
      };
      expect(() => extractJobDataSchema.parse(invalidData)).toThrow();
    });
  });

  describe("scoreJobMatchSchema", () => {
    it("should validate valid job match score", () => {
      const validData = {
        score: 85,
        summary: "Strong match with minor gaps",
        reasoning: "Detailed reasoning here",
        skill_match_percentage: 80,
        strengths: [
          "Strong React experience",
          "Good TypeScript skills",
          "Relevant industry background",
        ],
        gaps: ["Limited AWS experience", "No Kubernetes knowledge"],
        recommendation: "recommend",
      };
      expect(() => scoreJobMatchSchema.parse(validData)).not.toThrow();
    });

    it("should enforce score boundaries", () => {
      const invalidScore = {
        score: 150, // > 100
        summary: "Summary",
        reasoning: "Reasoning",
        skill_match_percentage: 80,
        strengths: ["Strength 1"],
        gaps: ["Gap 1"],
        recommendation: "recommend",
      };
      expect(() => scoreJobMatchSchema.parse(invalidScore)).toThrow();
    });

    it("should enforce valid recommendation enum", () => {
      const invalidRecommendation = {
        score: 85,
        summary: "Summary",
        reasoning: "Reasoning",
        skill_match_percentage: 80,
        strengths: ["Strength 1"],
        gaps: ["Gap 1"],
        recommendation: "maybe", // Invalid enum value
      };
      expect(() => scoreJobMatchSchema.parse(invalidRecommendation)).toThrow();
    });

    it("should enforce array size limits", () => {
      const tooManyStrengths = {
        score: 85,
        summary: "Summary",
        reasoning: "Reasoning",
        skill_match_percentage: 80,
        strengths: Array(15).fill("Strength"), // > 10
        gaps: ["Gap 1"],
        recommendation: "recommend",
      };
      expect(() => scoreJobMatchSchema.parse(tooManyStrengths)).toThrow();
    });
  });

  describe("detectLoginPageSchema", () => {
    it("should validate login detection response", () => {
      const validData = {
        isLoginPage: true,
        confidence: 0.95,
        indicators: [
          "Login form found",
          "Password field present",
          "Sign in button detected",
        ],
      };
      expect(() => detectLoginPageSchema.parse(validData)).not.toThrow();
    });

    it("should enforce confidence boundaries", () => {
      const invalidConfidence = {
        isLoginPage: true,
        confidence: 1.5, // > 1.0
        indicators: ["Login form"],
      };
      expect(() => detectLoginPageSchema.parse(invalidConfidence)).toThrow();
    });
  });

  describe("detectPaginationSchema", () => {
    it("should validate pagination detection response", () => {
      const validData = {
        hasPagination: true,
        hasInfiniteScroll: false,
        nextButtonSelector: ".pagination .next",
        loadMoreSelector: undefined,
        paginationType: "next_prev",
      };
      expect(() => detectPaginationSchema.parse(validData)).not.toThrow();
    });

    it("should enforce valid pagination type enum", () => {
      const invalidType = {
        hasPagination: false,
        hasInfiniteScroll: false,
        paginationType: "unknown", // Invalid enum
      };
      expect(() => detectPaginationSchema.parse(invalidType)).toThrow();
    });
  });

  describe("extractResumeDataSchema", () => {
    it("should validate minimal resume data", () => {
      const minimalData = {
        basics: {
          name: "John Doe",
        },
      };
      expect(() => extractResumeDataSchema.parse(minimalData)).not.toThrow();
    });

    it("should validate complete resume data", () => {
      const completeData = {
        basics: {
          name: "John Doe",
          email: "john@example.com",
          phone: "+1234567890",
          title: "Software Engineer",
          summary: "Experienced developer",
          location: "San Francisco, CA",
          linkedin: "https://linkedin.com/in/johndoe",
          github: "https://github.com/johndoe",
        },
        work: [
          {
            name: "Acme Corp",
            position: "Senior Engineer",
            startDate: "2020-01",
            endDate: "2025-12",
            summary: "Built great things",
            technologies: ["JavaScript", "React"],
          },
        ],
        education: [
          {
            institution: "University of Example",
            area: "Computer Science",
            studyType: "Bachelor",
            graduationYear: 2020,
          },
        ],
        skills: [
          {
            name: "Frontend",
            skills: [
              {
                name: "React",
                level: "expert",
                yearsExperience: 5,
              },
            ],
          },
        ],
        languages: [
          {
            name: "English",
            languageCode: "en",
            proficiency: "native",
          },
        ],
      };
      expect(() => extractResumeDataSchema.parse(completeData)).not.toThrow();
    });

    it("should require basics.name", () => {
      const missingName = {
        basics: {
          email: "john@example.com",
        },
      };
      expect(() => extractResumeDataSchema.parse(missingName)).toThrow();
    });
  });
});
