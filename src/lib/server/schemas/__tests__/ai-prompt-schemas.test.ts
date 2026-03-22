import { describe, expect, it } from "vitest";
import {
  aiPromptSchemas,
  detectLoginPageSchema,
  extractJobDataSchema,
  findNextPageButtonSchema,
  getSchemaForPrompt,
  scoreJobMatchSchema,
} from "../ai-prompt-schemas";

describe("AI Prompt Schemas", () => {
  describe("Schema Registry", () => {
    it("should have all expected schemas in registry", () => {
      expect(aiPromptSchemas).toHaveProperty("extract_job_data");
      expect(aiPromptSchemas).toHaveProperty("score_job_match");
      expect(aiPromptSchemas).toHaveProperty("detect_login_page");
      expect(aiPromptSchemas).toHaveProperty("find_next_page_button");
    });

    it("should get schema by request name", () => {
      const schema = getSchemaForPrompt("extract_job_data");
      expect(schema).toBeDefined();
      expect(schema).toBe(extractJobDataSchema);
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

  describe("extractJobDataSchema", () => {
    it("should validate complete job data", () => {
      const validData = {
        title: "Software Engineer",
        job_description: "Full description here",
        company_description: "Company info",
        company: "Tech Corp",
        job_poster: "HR Manager",
        date_posted: "2026-01-08",
        location: "Remote",
        remote: "remote",
        experience_levels: ["senior"],
        job_type: "full_time",
        salary_min: 80000,
        salary_max: 120000,
        salary_currency: "EUR",
        salary_period: "year",
        skills_required: ["JavaScript", "React", "Node.js"],
        skills_preferred: ["TypeScript", "AWS"],
        responsibilities: ["Design systems", "Lead team"],
        soft_skills: ["Communication", "Leadership"],
        status: "hiring",
      };
      expect(() => extractJobDataSchema.parse(validData)).not.toThrow();
    });

    it("should allow null values for optional fields", () => {
      const dataWithNulls = {
        title: "Software Engineer",
        job_description: "Full description",
        company_description: null,
        company: null,
        job_poster: null,
        date_posted: null,
        location: null,
        remote: null,
        experience_levels: null,
        job_type: null,
        salary_min: null,
        salary_max: null,
        salary_currency: null,
        salary_period: null,
        skills_required: null,
        skills_preferred: null,
        responsibilities: null,
        soft_skills: null,
        status: null,
      };
      expect(() => extractJobDataSchema.parse(dataWithNulls)).not.toThrow();
    });

    it("should accept float salary values and round them", () => {
      const dataWithFloats = {
        title: "Software Engineer",
        job_description: "Description",
        salary_min: 80000.0,
        salary_max: 120000.5,
      };
      const result = extractJobDataSchema.parse(dataWithFloats);
      expect(result.salary_min).toBe(80000);
      expect(result.salary_max).toBe(120001);
    });

    it("should coerce numeric strings and 'null' strings from LLM responses", () => {
      const llmData = {
        title: "Software Engineer",
        job_description: "Description",
        salary_min: "80000", // Numeric string — should coerce to 80000
        salary_max: "null",  // String "null" — should coerce to null
      };
      const result = extractJobDataSchema.parse(llmData);
      expect(result.salary_min).toBe(80000);
      expect(result.salary_max).toBeNull();
    });

    it("should reject non-numeric salary strings", () => {
      const invalidData = {
        title: "Software Engineer",
        job_description: "Description",
        salary_min: "competitive", // Non-numeric string — should fail
        salary_max: 120000,
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

  describe("findNextPageButtonSchema", () => {
    it("should validate next page button response", () => {
      const validData = {
        found: true,
        dataXxxId: 42,
        paginationType: "next_prev",
      };
      expect(() => findNextPageButtonSchema.parse(validData)).not.toThrow();
    });

    it("should allow null dataXxxId when not found", () => {
      const notFoundData = {
        found: false,
        dataXxxId: null,
        paginationType: "none",
      };
      expect(() => findNextPageButtonSchema.parse(notFoundData)).not.toThrow();
    });

    it("should enforce valid pagination type enum", () => {
      const invalidType = {
        found: true,
        dataXxxId: 1,
        paginationType: "unknown", // Invalid enum
      };
      expect(() => findNextPageButtonSchema.parse(invalidType)).toThrow();
    });
  });
});
