import { beforeEach, describe, expect, it, vi } from "vitest";
import { extractJobData, extractJobLinks, upsertJob } from "../job-scraper";

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
  db: {
    ai_chat_prompts: {
      findUnique: vi.fn(),
    },
    jobs: {
      findFirst: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
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
    mockDb = vi.mocked(dbModule).db;
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
      JSON.stringify([
        "https://example.com/job/123",
        "https://example.com/job/456",
      ]),
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
      JSON.stringify(["https://example.com/job/123"]),
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
        "Failed to extract job links: LLM response is not an array",
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
    mockDb = vi.mocked(dbModule).db;
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
      salary_range: "$100k-$150k",
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
      salary_range: null,
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
    mockDb = vi.mocked(dbModule).db;
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
      salary_range: "$100k-$150k",
    };

    const sourceUrl = "https://example.com/job/123";
    const importSource = "LinkedIn";

    mockDb.jobs.findFirst.mockResolvedValueOnce(null);
    mockDb.jobs.create.mockResolvedValueOnce({ id: 1 });

    const result = await upsertJob(jobData, sourceUrl, importSource);

    expect(result.id).toBe(1);
    expect(result.created).toBe(true);
    expect(mockDb.jobs.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        ...jobData,
        source_url: sourceUrl,
        import_source: importSource,
        import_status: "published",
        status: "published",
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
      salary_range: "$100k-$150k",
    };

    const sourceUrl = "https://example.com/job/123";
    const importSource = "LinkedIn";

    mockDb.jobs.findFirst.mockResolvedValueOnce({
      id: 1,
      scrape_count: 2,
    });

    const result = await upsertJob(jobData, sourceUrl, importSource);

    expect(result.id).toBe(1);
    expect(result.created).toBe(false);
    expect(mockDb.jobs.update).toHaveBeenCalledWith({
      where: { id: 1 },
      data: expect.objectContaining({
        ...jobData,
        import_status: "published",
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
      salary_range: null,
    };

    mockDb.jobs.findFirst.mockResolvedValueOnce({
      id: 1,
      scrape_count: 5,
    });

    await upsertJob(jobData, "https://example.com", "Test");

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
      salary_range: null,
    };

    mockDb.jobs.findFirst.mockResolvedValueOnce({
      id: 1,
      scrape_count: null,
    });

    await upsertJob(jobData, "https://example.com", "Test");

    expect(mockDb.jobs.update).toHaveBeenCalledWith({
      where: { id: 1 },
      data: expect.objectContaining({
        scrape_count: 1,
      }),
    });
  });
});
