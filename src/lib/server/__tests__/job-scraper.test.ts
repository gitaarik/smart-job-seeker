import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  getPlatformIdFromUrl,
  normalizeJobUrl,
  upsertJob,
} from "../job-scraper";

// Mock dependencies
vi.mock("$lib/db", () => ({
  dbDirect: {
    jobs: {
      findFirst: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
    },
    job_platforms: {
      findFirst: vi.fn(),
      findUnique: vi.fn(),
    },
  },
}));

describe("getPlatformIdFromUrl", () => {
  let mockDb: any;

  beforeEach(async () => {
    vi.clearAllMocks();
    const dbModule = await import("$lib/db");
    mockDb = vi.mocked(dbModule).dbDirect;
  });

  it("should find platform by hostname", async () => {
    mockDb.job_platforms.findFirst.mockResolvedValueOnce({ id: 1 });

    const result = await getPlatformIdFromUrl("https://example.com/job/123");

    expect(result).toBe(1);
    expect(mockDb.job_platforms.findFirst).toHaveBeenCalledWith({
      where: {
        OR: [
          { url: { contains: "example.com" } },
          { url: { contains: "example.com" } },
        ],
      },
    });
  });

  it("should strip www from hostname", async () => {
    mockDb.job_platforms.findFirst.mockResolvedValueOnce({ id: 2 });

    const result = await getPlatformIdFromUrl("https://www.linkedin.com/jobs");

    expect(result).toBe(2);
    expect(mockDb.job_platforms.findFirst).toHaveBeenCalledWith({
      where: {
        OR: [
          { url: { contains: "www.linkedin.com" } },
          { url: { contains: "linkedin.com" } },
        ],
      },
    });
  });

  it("should return null when platform not found", async () => {
    mockDb.job_platforms.findFirst.mockResolvedValueOnce(null);

    const result = await getPlatformIdFromUrl("https://unknown.com/job");

    expect(result).toBeNull();
  });

  it("should return null for invalid URLs", async () => {
    const result = await getPlatformIdFromUrl("not-a-url");

    expect(result).toBeNull();
    expect(mockDb.job_platforms.findFirst).not.toHaveBeenCalled();
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
      status: "hiring",
      strippedHtml: "<p>Job content</p>",
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
        status: jobData.status,
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
      status: "hiring",
      strippedHtml: "<p>Job content</p>",
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
        status: jobData.status,
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
      status: null,
      strippedHtml: "",
    };

    mockDb.jobs.findFirst.mockResolvedValueOnce({
      id: 1,
      scrape_count: 5,
    });

    await upsertJob(jobData, "https://example.com", 1);

    expect(mockDb.jobs.update).toHaveBeenCalledWith({
      where: { id: 1 },
      data: expect.objectContaining({
        status: "hiring", // Should default to hiring when null
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
      status: null,
      strippedHtml: "",
    };

    mockDb.jobs.findFirst.mockResolvedValueOnce({
      id: 1,
      scrape_count: null,
    });

    await upsertJob(jobData, "https://example.com", 1);

    expect(mockDb.jobs.update).toHaveBeenCalledWith({
      where: { id: 1 },
      data: expect.objectContaining({
        status: "hiring", // Should default to hiring when null
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
      status: null,
      strippedHtml: "",
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
        status: "hiring", // Should default to hiring when null
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
      status: null,
      strippedHtml: "",
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
        status: "hiring", // Should default to hiring when null
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
      status: null,
      strippedHtml: "",
    };

    mockDb.jobs.findFirst.mockResolvedValueOnce(null);
    mockDb.jobs.create.mockResolvedValueOnce({ id: 1 });

    await upsertJob(jobData, "https://example.com", 1);

    // Should NOT call job_platforms.findUnique
    expect(mockDb.job_platforms.findUnique).not.toHaveBeenCalled();

    expect(mockDb.jobs.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        job_poster: "Company Inc",
        status: "hiring", // Should default to hiring when null
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
      status: null,
      strippedHtml: "",
    };

    mockDb.jobs.findFirst.mockResolvedValueOnce(null);
    mockDb.jobs.create.mockResolvedValueOnce({ id: 1 });

    await upsertJob(jobData, "https://example.com", null);

    // Should NOT call job_platforms.findUnique when platformId is null
    expect(mockDb.job_platforms.findUnique).not.toHaveBeenCalled();

    expect(mockDb.jobs.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        job_poster: null,
        status: "hiring", // Should default to hiring when null
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
      status: null,
      strippedHtml: "",
    };

    mockDb.jobs.findFirst.mockResolvedValueOnce(null);
    mockDb.job_platforms.findUnique.mockResolvedValueOnce(null);
    mockDb.jobs.create.mockResolvedValueOnce({ id: 1 });

    await upsertJob(jobData, "https://example.com", 999);

    expect(mockDb.job_platforms.findUnique).toHaveBeenCalled();

    expect(mockDb.jobs.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        job_poster: null,
        status: "hiring", // Should default to hiring when null
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
      status: null,
      strippedHtml: "",
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
        status: "hiring", // Should default to hiring when null
      }),
    });
  });

  it("should default status to 'hiring' when null", async () => {
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
      status: null,
      strippedHtml: "",
    };

    mockDb.jobs.findFirst.mockResolvedValueOnce(null);
    mockDb.jobs.create.mockResolvedValueOnce({ id: 1 });

    await upsertJob(jobData, "https://example.com", null);

    expect(mockDb.jobs.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        status: "hiring", // Should default to hiring when null
      }),
    });
  });

  it("should preserve 'closed' status when explicitly set", async () => {
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
      status: "closed",
      strippedHtml: "",
    };

    mockDb.jobs.findFirst.mockResolvedValueOnce({
      id: 1,
      scrape_count: 1,
    });

    await upsertJob(jobData, "https://example.com", null);

    expect(mockDb.jobs.update).toHaveBeenCalledWith({
      where: { id: 1 },
      data: expect.objectContaining({
        status: "closed", // Should preserve explicit status
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

  it("should remove tracking params but keep job identifiers", () => {
    const url = "https://example.com/job/123?utm_source=twitter&ref=abc";
    const normalized = normalizeJobUrl(url);
    expect(normalized).toBe("https://example.com/job/123");
  });

  it("should preserve listingId parameter (Mercor pattern)", () => {
    const url =
      "https://work.mercor.com/explore?listingId=list_AAABmWKD-ht4QOtsw1hPkL0K";
    const normalized = normalizeJobUrl(url);
    expect(normalized).toBe(
      "https://work.mercor.com/explore?listingId=list_AAABmWKD-ht4QOtsw1hPkL0K",
    );
  });

  it("should differentiate jobs with different listingIds", () => {
    const url1 =
      "https://work.mercor.com/explore?listingId=list_AAABmWKD-ht4QOtsw1hPkL0K";
    const url2 =
      "https://work.mercor.com/explore?listingId=list_AAABmpOFrI8_o1919ypMPoR-";
    expect(normalizeJobUrl(url1)).not.toBe(normalizeJobUrl(url2));
  });

  it("should preserve jobId parameter", () => {
    const url = "https://example.com/jobs?jobId=12345&utm_source=feed";
    const normalized = normalizeJobUrl(url);
    expect(normalized).toBe("https://example.com/jobs?jobId=12345");
  });

  it("should preserve id parameter", () => {
    const url = "https://example.com/jobs?id=abc123&ref=newsletter";
    const normalized = normalizeJobUrl(url);
    expect(normalized).toBe("https://example.com/jobs?id=abc123");
  });

  it("should preserve gh_jid parameter (Greenhouse)", () => {
    const url = "https://example.com/jobs?gh_jid=4567890&source=linkedin";
    const normalized = normalizeJobUrl(url);
    expect(normalized).toBe("https://example.com/jobs?gh_jid=4567890");
  });

  it("should preserve multiple important params", () => {
    const url = "https://example.com/jobs?jobId=123&posting=abc&utm_source=x";
    const normalized = normalizeJobUrl(url);
    expect(normalized).toBe("https://example.com/jobs?jobId=123&posting=abc");
  });

  it("should remove hash fragments for normal URLs", () => {
    const url = "https://example.com/job/123#section";
    const normalized = normalizeJobUrl(url);
    expect(normalized).toBe("https://example.com/job/123");
  });

  it("should remove both tracking params and hash for normal URLs", () => {
    const url = "https://example.com/job/123?source=feed#description";
    const normalized = normalizeJobUrl(url);
    expect(normalized).toBe("https://example.com/job/123");
  });

  it("should handle URLs without important params", () => {
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

  it("should treat tracking params as equivalent for normal URLs", () => {
    const url1 = "https://example.com/job/123?source=feed";
    const url2 = "https://example.com/job/123?utm_campaign=winter";
    expect(normalizeJobUrl(url1)).toBe(normalizeJobUrl(url2));
  });

  it("should preserve listingId but remove tracking params", () => {
    const url =
      "https://work.mercor.com/explore?listingId=list_123&utm_source=twitter&ref=email";
    const normalized = normalizeJobUrl(url);
    expect(normalized).toBe(
      "https://work.mercor.com/explore?listingId=list_123",
    );
  });
});
