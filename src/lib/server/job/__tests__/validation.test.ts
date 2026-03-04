/**
 * Tests for Job Import Validation
 */

import { describe, expect, it } from "vitest";
import {
  validateJobImport,
  validateBatchJobImport,
  safeValidateJobImport,
  safeValidateBatchJobImport,
  formatValidationError,
  jobImportRequestSchema,
} from "../validation";
import { ZodError } from "zod";

const validJob = {
  title: "Software Engineer",
  company: "Acme Corp",
  sourceUrl: "https://example.com/jobs/123",
};

describe("validateJobImport", () => {
  it("accepts valid minimal job", () => {
    const result = validateJobImport(validJob);
    expect(result.title).toBe("Software Engineer");
    expect(result.company).toBe("Acme Corp");
    expect(result.sourceUrl).toBe("https://example.com/jobs/123");
  });

  it("accepts valid job with all optional fields", () => {
    const result = validateJobImport({
      ...validJob,
      description: "A great job",
      location: "Amsterdam, NL",
      salary: "$100k-$150k",
      salaryMin: 100000,
      salaryMax: 150000,
      salaryCurrency: "USD",
      salaryPeriod: "yearly",
      remote: "hybrid",
      jobType: "full-time",
      experienceLevel: "Senior",
      skills: ["TypeScript", "React"],
      applicationUrl: "https://example.com/apply",
      postedAt: "2025-01-15T00:00:00.000Z",
      platformId: 1,
      searchId: 5,
    });
    expect(result.salaryMin).toBe(100000);
    expect(result.remote).toBe("hybrid");
    expect(result.skills).toEqual(["TypeScript", "React"]);
  });

  it("accepts nullable optional fields as null", () => {
    const result = validateJobImport({
      ...validJob,
      description: null,
      location: null,
      salary: null,
      remote: null,
      jobType: null,
    });
    expect(result.description).toBeNull();
    expect(result.remote).toBeNull();
  });

  // Required field validation
  it("rejects missing title", () => {
    expect(() => validateJobImport({ company: "X", sourceUrl: "https://x.com" }))
      .toThrow(ZodError);
  });

  it("rejects empty title", () => {
    expect(() => validateJobImport({ ...validJob, title: "" }))
      .toThrow(ZodError);
  });

  it("rejects missing company", () => {
    expect(() => validateJobImport({ title: "X", sourceUrl: "https://x.com" }))
      .toThrow(ZodError);
  });

  it("rejects missing sourceUrl", () => {
    expect(() => validateJobImport({ title: "X", company: "Y" }))
      .toThrow(ZodError);
  });

  it("rejects invalid sourceUrl", () => {
    expect(() => validateJobImport({ ...validJob, sourceUrl: "not-a-url" }))
      .toThrow(ZodError);
  });

  // Length limits
  it("rejects title > 255 chars", () => {
    expect(() => validateJobImport({ ...validJob, title: "x".repeat(256) }))
      .toThrow(ZodError);
  });

  it("rejects sourceUrl > 500 chars", () => {
    expect(() => validateJobImport({
      ...validJob,
      sourceUrl: "https://example.com/" + "x".repeat(500),
    })).toThrow(ZodError);
  });

  // Enum validation
  it("rejects invalid salaryPeriod", () => {
    expect(() => validateJobImport({ ...validJob, salaryPeriod: "biweekly" }))
      .toThrow(ZodError);
  });

  it("rejects invalid remote option", () => {
    expect(() => validateJobImport({ ...validJob, remote: "partially" }))
      .toThrow(ZodError);
  });

  it("rejects invalid jobType", () => {
    expect(() => validateJobImport({ ...validJob, jobType: "volunteer" }))
      .toThrow(ZodError);
  });

  it("accepts all valid salaryPeriod values", () => {
    for (const period of ["yearly", "monthly", "weekly", "hourly"]) {
      const result = validateJobImport({ ...validJob, salaryPeriod: period });
      expect(result.salaryPeriod).toBe(period);
    }
  });

  it("accepts all valid remote options", () => {
    for (const remote of ["remote", "hybrid", "onsite"]) {
      const result = validateJobImport({ ...validJob, remote });
      expect(result.remote).toBe(remote);
    }
  });

  it("accepts all valid jobType values", () => {
    for (const jobType of ["full-time", "part-time", "contract", "internship", "freelance", "temporary"]) {
      const result = validateJobImport({ ...validJob, jobType });
      expect(result.jobType).toBe(jobType);
    }
  });

  // Number validation
  it("rejects negative salaryMin", () => {
    expect(() => validateJobImport({ ...validJob, salaryMin: -1 }))
      .toThrow(ZodError);
  });

  it("rejects non-integer salaryMax", () => {
    expect(() => validateJobImport({ ...validJob, salaryMax: 50000.5 }))
      .toThrow(ZodError);
  });

  // Skills validation
  it("rejects skills array > 50 items", () => {
    expect(() => validateJobImport({
      ...validJob,
      skills: Array.from({ length: 51 }, (_, i) => `skill-${i}`),
    })).toThrow(ZodError);
  });

  it("rejects skill name > 100 chars", () => {
    expect(() => validateJobImport({
      ...validJob,
      skills: ["x".repeat(101)],
    })).toThrow(ZodError);
  });
});

describe("validateBatchJobImport", () => {
  it("accepts valid batch", () => {
    const result = validateBatchJobImport({ jobs: [validJob] });
    expect(result.jobs).toHaveLength(1);
  });

  it("rejects empty jobs array", () => {
    expect(() => validateBatchJobImport({ jobs: [] })).toThrow(ZodError);
  });

  it("rejects > 100 jobs", () => {
    const jobs = Array.from({ length: 101 }, () => validJob);
    expect(() => validateBatchJobImport({ jobs })).toThrow(ZodError);
  });

  it("rejects if any job is invalid", () => {
    expect(() => validateBatchJobImport({
      jobs: [validJob, { title: "Missing fields" }],
    })).toThrow(ZodError);
  });
});

describe("safeValidateJobImport", () => {
  it("returns success with parsed data", () => {
    const result = safeValidateJobImport(validJob);
    expect(result.success).toBe(true);
    expect(result.data?.title).toBe("Software Engineer");
    expect(result.error).toBeUndefined();
  });

  it("returns error without throwing", () => {
    const result = safeValidateJobImport({});
    expect(result.success).toBe(false);
    expect(result.error).toBeInstanceOf(ZodError);
    expect(result.data).toBeUndefined();
  });
});

describe("safeValidateBatchJobImport", () => {
  it("returns success with parsed data", () => {
    const result = safeValidateBatchJobImport({ jobs: [validJob] });
    expect(result.success).toBe(true);
    expect(result.data?.jobs).toHaveLength(1);
  });

  it("returns error without throwing", () => {
    const result = safeValidateBatchJobImport({ jobs: [] });
    expect(result.success).toBe(false);
    expect(result.error).toBeInstanceOf(ZodError);
  });
});

describe("formatValidationError", () => {
  it("formats single error", () => {
    const result = safeValidateJobImport({ company: "X", sourceUrl: "https://x.com" });
    const msg = formatValidationError(result.error!);
    expect(msg).toContain("title");
  });

  it("formats multiple errors with semicolons", () => {
    const result = safeValidateJobImport({});
    const msg = formatValidationError(result.error!);
    expect(msg).toContain(";");
    expect(msg).toContain("title");
    expect(msg).toContain("company");
    expect(msg).toContain("sourceUrl");
  });

  it("includes field path", () => {
    const result = safeValidateJobImport({ ...validJob, salaryMin: -1 });
    const msg = formatValidationError(result.error!);
    expect(msg).toContain("salaryMin");
  });
});
