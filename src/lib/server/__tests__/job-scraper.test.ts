import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  extractJobData,
  extractJobLinks,
  normalizeJobUrl,
  upsertJob,
} from "../job-scraper";

// Mock dependencies
vi.mock("../llm", () => ({
  generateChatCompletion: vi.fn(),
}));

vi.mock("../html-strip", () => ({
  stripHtmlForLlm: vi.fn((html) => html),
}));

vi.mock("../ai-chat-utils", () => ({
  interpolatePrompt: vi.fn((template, vars) => {
    return template.replace(/\{\{(\w+)\}\}/g, (_, key) => vars[key] || "");
  }),
}));

vi.mock("$lib/db", () => ({
  dbDirect: {
    ai_chat_prompts: {
      findUnique: vi.fn(),
    },
    jobs: {
      findFirst: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
    },
    job_platforms: {
      findUnique: vi.fn(),
    },
  },
}));

describe("extractJobLinks", () => {
  let mockGenerateChatCompletion: any;
  let mockDb: any;

  beforeEach(async () => {
    vi.clearAllMocks();
    const llmModule = await import("../llm");
    mockGenerateChatCompletion = vi.mocked(llmModule).generateChatCompletion;
    const dbModule = await import("$lib/db");
    mockDb = vi.mocked(dbModule).dbDirect;
  });

  it("should extract job links from HTML", async () => {
    const html = "<html>Job listings</html>";

    mockDb.ai_chat_prompts.findUnique.mockResolvedValueOnce({
      request: "extract_job_links",
      system_prompt: "Extract job links",
      user_prompt: "HTML: {{html}}",
      format: null,
    });

    mockGenerateChatCompletion.mockResolvedValueOnce(
      JSON.stringify({
        urls: [
          "https://example.com/job/123",
          "https://example.com/job/456",
        ],
      }),
    );

    const links = await extractJobLinks(html);

    expect(links).toEqual([
      "https://example.com/job/123",
      "https://example.com/job/456",
    ]);
  });

  it("should use structured output if format is provided", async () => {
    const html = "<html>Job listings</html>";

    const format = {
      type: "array",
      items: { type: "string" },
    };

    mockDb.ai_chat_prompts.findUnique.mockResolvedValueOnce({
      request: "extract_job_links",
      system_prompt: "Extract job links",
      user_prompt: "HTML: {{html}}",
      format,
    });

    mockGenerateChatCompletion.mockResolvedValueOnce(
      JSON.stringify({ urls: ["https://example.com/job/123"] }),
    );

    await extractJobLinks(html);

    expect(mockGenerateChatCompletion).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        temperature: 0.3,
        responseFormat: {
          type: "json_schema",
          json_schema: {
            name: "job_links",
            strict: true,
            schema: format,
          },
        },
      }),
    );
  });

  it("should throw error if prompt template not found", async () => {
    mockDb.ai_chat_prompts.findUnique.mockResolvedValueOnce(null);

    await expect(extractJobLinks("<html></html>")).rejects.toThrow(
      "Prompt template 'extract_job_links' not found",
    );
  });

  it("should throw error if LLM response is not an array", async () => {
    const consoleSpy = vi.spyOn(console, "error").mockImplementation(() => {});

    try {
      mockDb.ai_chat_prompts.findUnique.mockResolvedValueOnce({
        request: "extract_job_links",
        system_prompt: "Extract job links",
        user_prompt: "HTML: {{html}}",
        format: null,
      });

      mockGenerateChatCompletion.mockResolvedValueOnce(
        JSON.stringify({ links: [] }),
      );

      await expect(extractJobLinks("<html></html>")).rejects.toThrow(
        "Failed to extract job links: LLM response.urls is not an array",
      );
    } finally {
      consoleSpy.mockRestore();
    }
  });

  it("should throw error if JSON parsing fails", async () => {
    const consoleSpy = vi.spyOn(console, "error").mockImplementation(() => {});

    try {
      mockDb.ai_chat_prompts.findUnique.mockResolvedValueOnce({
        request: "extract_job_links",
        system_prompt: "Extract job links",
        user_prompt: "HTML: {{html}}",
        format: null,
      });

      mockGenerateChatCompletion.mockResolvedValueOnce("invalid json");

      await expect(extractJobLinks("<html></html>")).rejects.toThrow(
        /Failed to extract job links:/,
      );
    } finally {
      consoleSpy.mockRestore();
    }
  });
});

describe("extractJobData", () => {
  let mockGenerateChatCompletion: any;
  let mockDb: any;

  beforeEach(async () => {
    vi.clearAllMocks();
    const llmModule = await import("../llm");
    mockGenerateChatCompletion = vi.mocked(llmModule).generateChatCompletion;
    const dbModule = await import("$lib/db");
    mockDb = vi.mocked(dbModule).dbDirect;
  });

  it("should extract job data from HTML", async () => {
    const html = "<html>Job posting</html>";
    const sourceUrl = "https://example.com/job/123";

    mockDb.ai_chat_prompts.findUnique.mockResolvedValueOnce({
      request: "extract_job_data",
      system_prompt: "Extract job data",
      user_prompt: "HTML: {{html}}",
      format: null,
    });

    const jobData = {
      title: "Software Engineer",
      job_description: "Great job",
      company_description: "Great company",
      job_poster: "Company Inc",
      date_posted: "2025-12-20",
      location: "Remote",
      remote: "yes",
      experience_level: "Senior",
      job_type: "Full-time",
      salary_min: 100000,
      salary_max: 150000,
      salary_currency: "USD",
      salary_period: "year",
      skills: ["JavaScript", "React", "Node.js"],
    };

    mockGenerateChatCompletion.mockResolvedValueOnce(JSON.stringify(jobData));

    const result = await extractJobData(html, sourceUrl);

    expect(result.title).toBe("Software Engineer");
    expect(result.job_description).toBe("Great job");
    expect(result.date_posted).toBeInstanceOf(Date);
  });

  it("should handle null date_posted", async () => {
    const html = "<html>Job posting</html>";
    const sourceUrl = "https://example.com/job/123";

    mockDb.ai_chat_prompts.findUnique.mockResolvedValueOnce({
      request: "extract_job_data",
      system_prompt: "Extract job data",
      user_prompt: "HTML: {{html}}",
      format: null,
    });

    const jobData = {
      title: "Software Engineer",
      job_description: "Great job",
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
    };

    mockGenerateChatCompletion.mockResolvedValueOnce(JSON.stringify(jobData));

    const result = await extractJobData(html, sourceUrl);

    expect(result.date_posted).toBeNull();
  });

  it("should throw error if prompt template not found", async () => {
    mockDb.ai_chat_prompts.findUnique.mockResolvedValueOnce(null);

    await expect(
      extractJobData("<html></html>", "https://example.com"),
    ).rejects.toThrow("Prompt template 'extract_job_data' not found");
  });

  it("should throw error if JSON parsing fails", async () => {
    const consoleSpy = vi.spyOn(console, "error").mockImplementation(() => {});

    try {
      mockDb.ai_chat_prompts.findUnique.mockResolvedValueOnce({
        request: "extract_job_data",
        system_prompt: "Extract job data",
        user_prompt: "HTML: {{html}}",
        format: null,
      });

      mockGenerateChatCompletion.mockResolvedValueOnce("invalid json");

      await expect(
        extractJobData("<html></html>", "https://example.com/job/123"),
      ).rejects.toThrow(/Failed to extract job data from/);
    } finally {
      consoleSpy.mockRestore();
    }
  });
});

describe("upsertJob", () => {
  let mockDb: any;

  beforeEach(async () => {
    vi.clearAllMocks();
    const dbModule = await import("$lib/db");
    mockDb = vi.mocked(dbModule).dbDirect;
  });

  it("should create new job if not exists", async () => {
    const jobData = {
      title: "Software Engineer",
      job_description: "Great job",
      company_description: "Great company",
      job_poster: "Company Inc",
      date_posted: new Date("2025-12-20"),
      location: "Remote",
      remote: "yes",
      experience_level: "Senior",
      job_type: "Full-time",
      salary_min: 100000,
      salary_max: 150000,
      salary_currency: "USD",
      salary_period: "year",
      skills: ["JavaScript", "React", "Node.js"],
    };

    const sourceUrl = "https://example.com/job/123";
    const platformId = 1;

    mockDb.jobs.findFirst.mockResolvedValueOnce(null);
    mockDb.jobs.create.mockResolvedValueOnce({ id: 1 });

    const result = await upsertJob(jobData, sourceUrl, platformId);

    expect(result.id).toBe(1);
    expect(result.created).toBe(true);
    expect(mockDb.jobs.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        title: jobData.title,
        job_description: jobData.job_description,
        company_description: jobData.company_description,
        job_poster: jobData.job_poster,
        location: jobData.location,
        salary_min: jobData.salary_min,
        salary_max: jobData.salary_max,
        salary_currency: jobData.salary_currency,
        salary_period: jobData.salary_period,
        skills: jobData.skills,
        remote_options: [jobData.remote],
        job_types: [jobData.job_type],
        experience_levels: [jobData.experience_level],
        source_url: sourceUrl,
        job_platform: platformId,
        status: "hiring",
        scrape_count: 1,
      }),
    });
  });

  it("should update existing job", async () => {
    const jobData = {
      title: "Software Engineer",
      job_description: "Great job",
      company_description: "Great company",
      job_poster: "Company Inc",
      date_posted: new Date("2025-12-20"),
      location: "Remote",
      remote: "yes",
      experience_level: "Senior",
      job_type: "Full-time",
      salary_min: 100000,
      salary_max: 150000,
      salary_currency: "USD",
      salary_period: "year",
      skills: ["JavaScript", "React", "Node.js"],
    };

    const sourceUrl = "https://example.com/job/123";
    const platformId = 1;

    mockDb.jobs.findFirst.mockResolvedValueOnce({
      id: 1,
      scrape_count: 2,
    });

    const result = await upsertJob(jobData, sourceUrl, platformId);

    expect(result.id).toBe(1);
    expect(result.created).toBe(false);
    expect(mockDb.jobs.update).toHaveBeenCalledWith({
      where: { id: 1 },
      data: expect.objectContaining({
        title: jobData.title,
        job_description: jobData.job_description,
        company_description: jobData.company_description,
        job_poster: jobData.job_poster,
        location: jobData.location,
        salary_min: jobData.salary_min,
        salary_max: jobData.salary_max,
        salary_currency: jobData.salary_currency,
        salary_period: jobData.salary_period,
        skills: jobData.skills,
        remote_options: [jobData.remote],
        job_types: [jobData.job_type],
        experience_levels: [jobData.experience_level],
        status: "hiring",
        import_error: null,
        scrape_count: 3,
      }),
    });
  });

  it("should increment scrape_count on update", async () => {
    const jobData = {
      title: "Software Engineer",
      job_description: null,
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
    };

    mockDb.jobs.findFirst.mockResolvedValueOnce({
      id: 1,
      scrape_count: 5,
    });

    await upsertJob(jobData, "https://example.com", 1);

    expect(mockDb.jobs.update).toHaveBeenCalledWith({
      where: { id: 1 },
      data: expect.objectContaining({
        scrape_count: 6,
      }),
    });
  });

  it("should handle null scrape_count in existing job", async () => {
    const jobData = {
      title: "Software Engineer",
      job_description: null,
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
    };

    mockDb.jobs.findFirst.mockResolvedValueOnce({
      id: 1,
      scrape_count: null,
    });

    await upsertJob(jobData, "https://example.com", 1);

    expect(mockDb.jobs.update).toHaveBeenCalledWith({
      where: { id: 1 },
      data: expect.objectContaining({
        scrape_count: 1,
      }),
    });
  });

  it("should use platform name when job_poster is null", async () => {
    const jobData = {
      title: "Software Engineer",
      job_description: null,
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
    };

    mockDb.jobs.findFirst.mockResolvedValueOnce(null);
    mockDb.job_platforms.findUnique.mockResolvedValueOnce({
      name: "LinkedIn",
    });
    mockDb.jobs.create.mockResolvedValueOnce({ id: 1 });

    await upsertJob(jobData, "https://example.com", 1);

    expect(mockDb.job_platforms.findUnique).toHaveBeenCalledWith({
      where: { id: 1 },
      select: { name: true },
    });

    expect(mockDb.jobs.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        job_poster: "LinkedIn",
      }),
    });
  });

  it("should use platform name when job_poster is empty string", async () => {
    const jobData = {
      title: "Software Engineer",
      job_description: null,
      company_description: null,
      job_poster: "   ",
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
    };

    mockDb.jobs.findFirst.mockResolvedValueOnce(null);
    mockDb.job_platforms.findUnique.mockResolvedValueOnce({
      name: "Indeed",
    });
    mockDb.jobs.create.mockResolvedValueOnce({ id: 1 });

    await upsertJob(jobData, "https://example.com", 2);

    expect(mockDb.jobs.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        job_poster: "Indeed",
      }),
    });
  });

  it("should keep original job_poster when provided", async () => {
    const jobData = {
      title: "Software Engineer",
      job_description: null,
      company_description: null,
      job_poster: "Company Inc",
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
    };

    mockDb.jobs.findFirst.mockResolvedValueOnce(null);
    mockDb.jobs.create.mockResolvedValueOnce({ id: 1 });

    await upsertJob(jobData, "https://example.com", 1);

    // Should NOT call job_platforms.findUnique
    expect(mockDb.job_platforms.findUnique).not.toHaveBeenCalled();

    expect(mockDb.jobs.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        job_poster: "Company Inc",
      }),
    });
  });

  it("should keep job_poster null when platformId is null", async () => {
    const jobData = {
      title: "Software Engineer",
      job_description: null,
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
    };

    mockDb.jobs.findFirst.mockResolvedValueOnce(null);
    mockDb.jobs.create.mockResolvedValueOnce({ id: 1 });

    await upsertJob(jobData, "https://example.com", null);

    // Should NOT call job_platforms.findUnique when platformId is null
    expect(mockDb.job_platforms.findUnique).not.toHaveBeenCalled();

    expect(mockDb.jobs.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        job_poster: null,
      }),
    });
  });

  it("should keep job_poster null when platform not found", async () => {
    const jobData = {
      title: "Software Engineer",
      job_description: null,
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
    };

    mockDb.jobs.findFirst.mockResolvedValueOnce(null);
    mockDb.job_platforms.findUnique.mockResolvedValueOnce(null);
    mockDb.jobs.create.mockResolvedValueOnce({ id: 1 });

    await upsertJob(jobData, "https://example.com", 999);

    expect(mockDb.job_platforms.findUnique).toHaveBeenCalled();

    expect(mockDb.jobs.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        job_poster: null,
      }),
    });
  });

  it("should use platform name in update operation when job_poster is null", async () => {
    const jobData = {
      title: "Software Engineer",
      job_description: null,
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
    };

    mockDb.jobs.findFirst.mockResolvedValueOnce({
      id: 1,
      scrape_count: 1,
    });
    mockDb.job_platforms.findUnique.mockResolvedValueOnce({
      name: "Glassdoor",
    });

    await upsertJob(jobData, "https://example.com", 3);

    expect(mockDb.job_platforms.findUnique).toHaveBeenCalledWith({
      where: { id: 3 },
      select: { name: true },
    });

    expect(mockDb.jobs.update).toHaveBeenCalledWith({
      where: { id: 1 },
      data: expect.objectContaining({
        job_poster: "Glassdoor",
      }),
    });
  });
});

describe("normalizeJobUrl", () => {
  it("should preserve pseudoURL hash fragments for SPA jobs", () => {
    const url = "https://developers.turing.com/jobs#job-1";
    const normalized = normalizeJobUrl(url);
    expect(normalized).toBe("https://developers.turing.com/jobs#job-1");
  });

  it("should preserve multiple digit job IDs", () => {
    const url = "https://example.com/jobs#job-123";
    const normalized = normalizeJobUrl(url);
    expect(normalized).toBe("https://example.com/jobs#job-123");
  });

  it("should remove query parameters for normal URLs", () => {
    const url = "https://example.com/job/123?utm_source=twitter&ref=abc";
    const normalized = normalizeJobUrl(url);
    expect(normalized).toBe("https://example.com/job/123");
  });

  it("should remove hash fragments for normal URLs", () => {
    const url = "https://example.com/job/123#section";
    const normalized = normalizeJobUrl(url);
    expect(normalized).toBe("https://example.com/job/123");
  });

  it("should remove both query params and hash for normal URLs", () => {
    const url = "https://example.com/job/123?source=feed#description";
    const normalized = normalizeJobUrl(url);
    expect(normalized).toBe("https://example.com/job/123");
  });

  it("should handle URLs without path", () => {
    const url = "https://example.com?param=value";
    const normalized = normalizeJobUrl(url);
    expect(normalized).toBe("https://example.com/");
  });

  it("should preserve trailing slash in pathname", () => {
    const url = "https://example.com/jobs/?source=feed";
    const normalized = normalizeJobUrl(url);
    expect(normalized).toBe("https://example.com/jobs/");
  });

  it("should not preserve non-pseudoURL hash fragments", () => {
    const url = "https://example.com/jobs#other-fragment";
    const normalized = normalizeJobUrl(url);
    expect(normalized).toBe("https://example.com/jobs");
  });

  it("should handle pseudoURL with query params", () => {
    const url = "https://example.com/jobs?page=1#job-5";
    const normalized = normalizeJobUrl(url);
    // Query params should be removed, but hash should be preserved for pseudoURLs
    expect(normalized).toBe("https://example.com/jobs#job-5");
  });

  it("should handle invalid URLs gracefully", () => {
    const url = "not-a-valid-url";
    const normalized = normalizeJobUrl(url);
    expect(normalized).toBe("not-a-valid-url");
  });

  it("should handle empty string", () => {
    const url = "";
    const normalized = normalizeJobUrl(url);
    expect(normalized).toBe("");
  });

  it("should handle relative URLs gracefully", () => {
    const url = "/jobs/123";
    const normalized = normalizeJobUrl(url);
    expect(normalized).toBe("/jobs/123");
  });

  it("should differentiate between different pseudoURL jobs on same base URL", () => {
    const url1 = "https://example.com/jobs#job-1";
    const url2 = "https://example.com/jobs#job-2";
    expect(normalizeJobUrl(url1)).not.toBe(normalizeJobUrl(url2));
  });

  it("should treat query params as equivalent for normal URLs", () => {
    const url1 = "https://example.com/job/123?source=feed";
    const url2 = "https://example.com/job/123?utm_campaign=winter";
    expect(normalizeJobUrl(url1)).toBe(normalizeJobUrl(url2));
  });
});
