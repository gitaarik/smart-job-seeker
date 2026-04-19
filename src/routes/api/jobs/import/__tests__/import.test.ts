/**
 * Unit tests for Job Import API endpoints
 * Tests POST /api/jobs/import and POST /api/jobs/import/batch
 */

import { beforeEach, describe, expect, it, vi } from "vitest";

// Mock Drizzle insert chain (with returning)
const mockInsertReturning = vi.fn();
const mockInsertValues = vi.fn().mockReturnValue({ returning: mockInsertReturning });
const mockInsertFn = vi.fn().mockReturnValue({ values: mockInsertValues });

// Mock Drizzle update chain
const mockUpdateWhere = vi.fn().mockResolvedValue({});
const mockUpdateSet = vi.fn().mockReturnValue({ where: mockUpdateWhere });
const mockUpdateFn = vi.fn().mockReturnValue({ set: mockUpdateSet });

// Mock Drizzle query finders
const mockJobImportersFindFirst = vi.fn();

vi.mock("$lib/server/db", () => ({
  db: {
    query: {
      jobs: {
        findFirst: vi.fn(),
      },
      job_importers: {
        findFirst: (...a: any[]) => mockJobImportersFindFirst(...a),
      },
    },
    insert: (...a: any[]) => mockInsertFn(...a),
    update: (...a: any[]) => mockUpdateFn(...a),
  },
}));

vi.mock("drizzle-orm", () => ({
  eq: vi.fn((_col: any, val: any) => val),
}));

vi.mock("$lib/server/db/schema", () => ({
  jobs: { id: "jobs.id", source_url: "jobs.source_url" },
  job_importers: { job: "job_importers.job", profile: "job_importers.profile" },
}));

// Mock the import utilities
const mockFindExistingJob = vi.fn();
const mockGetProfileIdFromApiKey = vi.fn();

vi.mock("$lib/server/job/import-utils", () => ({
  findExistingJob: (...a: any[]) => mockFindExistingJob(...a),
  getProfileIdFromApiKey: (...a: any[]) => mockGetProfileIdFromApiKey(...a),
}));

// Mock the API key verification module (used by getProfileIdFromApiKey)
vi.mock("$lib/server/auth/api-key", () => ({
  verifyApiKey: vi.fn(),
}));

import { POST as importSingle } from "../+server";
import { POST as importBatch } from "../batch/+server";

/**
 * Helper to create mock Request
 */
function createMockRequest(
  body: Record<string, unknown>,
  apiKey?: string,
): Request {
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
  };
  if (apiKey) {
    headers["X-API-Key"] = apiKey;
  }

  return new Request("http://localhost:5173/api/jobs/import", {
    method: "POST",
    headers,
    body: JSON.stringify(body),
  });
}

/**
 * Helper to create mock RequestEvent
 */
function createMockEvent(
  request: Request,
  user?: App.Locals["user"],
) {
  return {
    request,
    locals: { user },
    url: new URL("http://localhost:5173/api/jobs/import"),
  } as any;
}

describe("POST /api/jobs/import - Single Job Import", () => {
  const validJob = {
    title: "Senior Developer",
    company: "Acme Corp",
    sourceUrl: "https://example.com/jobs/123",
    description: "A great job opportunity",
    location: "Amsterdam",
    remote: "hybrid",
  };

  beforeEach(() => {
    vi.resetAllMocks();
    mockJobImportersFindFirst.mockResolvedValue(null);
    mockInsertFn.mockReturnValue({ values: mockInsertValues });
    mockInsertValues.mockReturnValue({ returning: mockInsertReturning });
    mockInsertReturning.mockResolvedValue([{ id: 42 }]);
    mockUpdateFn.mockReturnValue({ set: mockUpdateSet });
    mockUpdateSet.mockReturnValue({ where: mockUpdateWhere });
    mockUpdateWhere.mockResolvedValue({});
  });

  describe("authentication", () => {
    it("should reject request without authentication", async () => {
      mockGetProfileIdFromApiKey.mockResolvedValueOnce({ profileId: null, error: "API key required" });

      const request = createMockRequest(validJob);
      const event = createMockEvent(request);

      const response = await importSingle(event);

      expect(response.status).toBe(401);
      const data = await response.json();
      expect(data.success).toBe(false);
      expect(data.message).toContain("API key required");
    });

    it("should reject invalid API key", async () => {
      mockGetProfileIdFromApiKey.mockResolvedValueOnce({ profileId: null, error: "Invalid API key" });

      const request = createMockRequest(validJob, "sjs_invalid_key");
      const event = createMockEvent(request);

      const response = await importSingle(event);

      expect(response.status).toBe(401);
      const data = await response.json();
      expect(data.success).toBe(false);
      expect(data.message).toBe("Invalid API key");
    });

    it("should accept valid API key", async () => {
      mockGetProfileIdFromApiKey.mockResolvedValueOnce({ profileId: 1 });
      mockFindExistingJob.mockResolvedValueOnce(null); // No existing job
      mockInsertReturning.mockResolvedValueOnce([{ id: 42 }]);

      const request = createMockRequest(validJob, "sjs_valid_key_here");
      const event = createMockEvent(request);

      const response = await importSingle(event);

      expect(response.status).toBe(200);
      const data = await response.json();
      expect(data.success).toBe(true);
      expect(data.action).toBe("created");
      expect(data.jobId).toBe(42);
    });
  });

  describe("validation", () => {
    beforeEach(() => {
      mockGetProfileIdFromApiKey.mockResolvedValue({ profileId: 1 });
    });

    it("should reject missing required fields", async () => {
      const request = createMockRequest(
        { title: "Developer" }, // Missing company and sourceUrl
        "sjs_valid_key",
      );
      const event = createMockEvent(request);

      const response = await importSingle(event);

      expect(response.status).toBe(400);
      const data = await response.json();
      expect(data.success).toBe(false);
      expect(data.message).toContain("company");
    });

    it("should reject invalid URL", async () => {
      const request = createMockRequest(
        {
          title: "Developer",
          company: "Acme",
          sourceUrl: "not-a-url",
        },
        "sjs_valid_key",
      );
      const event = createMockEvent(request);

      const response = await importSingle(event);

      expect(response.status).toBe(400);
      const data = await response.json();
      expect(data.success).toBe(false);
      expect(data.message).toContain("URL");
    });

    it("should accept valid optional fields", async () => {
      mockFindExistingJob.mockResolvedValueOnce(null);
      mockInsertReturning.mockResolvedValueOnce([{ id: 42 }]);

      const fullJob = {
        ...validJob,
        salaryMin: 80000,
        salaryMax: 120000,
        salaryCurrency: "EUR",
        salaryPeriod: "yearly",
        jobType: "full-time",
        experienceLevel: "Senior",
        skills: ["TypeScript", "React", "Node.js"],
        postedAt: "2025-01-15T10:00:00Z",
      };

      const request = createMockRequest(fullJob, "sjs_valid_key");
      const event = createMockEvent(request);

      const response = await importSingle(event);

      expect(response.status).toBe(200);
      const data = await response.json();
      expect(data.success).toBe(true);
    });
  });

  describe("deduplication", () => {
    beforeEach(() => {
      mockGetProfileIdFromApiKey.mockResolvedValue({ profileId: 1 });
    });

    it("should skip duplicate job with same data", async () => {
      mockFindExistingJob.mockResolvedValueOnce({
        id: 99,
        job_description: "A great job opportunity",
      });

      const request = createMockRequest(validJob, "sjs_valid_key");
      const event = createMockEvent(request);

      const response = await importSingle(event);

      expect(response.status).toBe(200);
      const data = await response.json();
      expect(data.success).toBe(true);
      expect(data.action).toBe("skipped");
      expect(data.duplicateOf).toBe(99);
    });

    it("should update duplicate job when data changed", async () => {
      mockFindExistingJob.mockResolvedValueOnce({
        id: 99,
        job_description: "Old description",
      });

      const request = createMockRequest(validJob, "sjs_valid_key");
      const event = createMockEvent(request);

      const response = await importSingle(event);

      expect(response.status).toBe(200);
      const data = await response.json();
      expect(data.success).toBe(true);
      expect(data.action).toBe("updated");
      expect(data.jobId).toBe(99);
    });

    it("should normalize URLs by removing only tracking params", async () => {
      mockFindExistingJob.mockResolvedValueOnce(null);
      mockInsertReturning.mockResolvedValueOnce([{ id: 42 }]);

      const linkedInJob = {
        ...validJob,
        sourceUrl:
          "https://www.linkedin.com/jobs/view/123456?utm_source=google&currentJobId=789",
      };

      const request = createMockRequest(linkedInJob, "sjs_valid_key");
      const event = createMockEvent(request);

      await importSingle(event);

      // Check that insert was called with the normalized URL
      expect(mockInsertFn).toHaveBeenCalled();
      expect(mockInsertValues).toHaveBeenCalledWith(
        expect.objectContaining({
          source_url:
            "https://www.linkedin.com/jobs/view/123456?currentJobId=789",
        }),
      );
    });
  });

  describe("job creation", () => {
    beforeEach(() => {
      mockGetProfileIdFromApiKey.mockResolvedValue({ profileId: 1 });
    });

    it("should create new job successfully", async () => {
      mockFindExistingJob.mockResolvedValueOnce(null);
      mockInsertReturning.mockResolvedValueOnce([{ id: 42 }]);

      const request = createMockRequest(validJob, "sjs_valid_key");
      const event = createMockEvent(request);

      const response = await importSingle(event);

      expect(response.status).toBe(200);
      const data = await response.json();
      expect(data.success).toBe(true);
      expect(data.action).toBe("created");
      expect(data.jobId).toBe(42);
      expect(data.message).toBe("Job imported successfully");
    });

    it("should handle database errors gracefully", async () => {
      mockFindExistingJob.mockResolvedValueOnce(null);
      mockInsertReturning.mockRejectedValueOnce(new Error("Database error"));

      const request = createMockRequest(validJob, "sjs_valid_key");
      const event = createMockEvent(request);

      const response = await importSingle(event);

      expect(response.status).toBe(500);
      const data = await response.json();
      expect(data.success).toBe(false);
      expect(data.message).toContain("Database error");
    });
  });
});

describe("POST /api/jobs/import/batch - Batch Job Import", () => {
  const validJobs = [
    {
      title: "Senior Developer",
      company: "Acme Corp",
      sourceUrl: "https://example.com/jobs/1",
    },
    {
      title: "Junior Developer",
      company: "Beta Inc",
      sourceUrl: "https://example.com/jobs/2",
    },
  ];

  beforeEach(() => {
    vi.resetAllMocks();
    mockJobImportersFindFirst.mockResolvedValue(null);
    mockInsertFn.mockReturnValue({ values: mockInsertValues });
    mockInsertValues.mockReturnValue({ returning: mockInsertReturning });
    mockInsertReturning.mockResolvedValue([{ id: 42 }]);
    mockUpdateFn.mockReturnValue({ set: mockUpdateSet });
    mockUpdateSet.mockReturnValue({ where: mockUpdateWhere });
    mockUpdateWhere.mockResolvedValue({});
  });

  describe("authentication", () => {
    it("should reject request without authentication", async () => {
      mockGetProfileIdFromApiKey.mockResolvedValueOnce({ profileId: null, error: "API key required" });

      const request = createMockRequest({ jobs: validJobs });
      const event = createMockEvent(request);

      const response = await importBatch(event);

      expect(response.status).toBe(401);
      const data = await response.json();
      expect(data.success).toBe(false);
    });
  });

  describe("validation", () => {
    beforeEach(() => {
      mockGetProfileIdFromApiKey.mockResolvedValue({ profileId: 1 });
    });

    it("should reject empty jobs array", async () => {
      const request = createMockRequest({ jobs: [] }, "sjs_valid_key");
      const event = createMockEvent(request);

      const response = await importBatch(event);

      expect(response.status).toBe(400);
      const data = await response.json();
      expect(data.success).toBe(false);
    });

    it("should reject more than 100 jobs", async () => {
      const tooManyJobs = Array(101)
        .fill(null)
        .map((_, i) => ({
          title: `Job ${i}`,
          company: "Company",
          sourceUrl: `https://example.com/jobs/${i}`,
        }));

      const request = createMockRequest({ jobs: tooManyJobs }, "sjs_valid_key");
      const event = createMockEvent(request);

      const response = await importBatch(event);

      expect(response.status).toBe(400);
      const data = await response.json();
      expect(data.success).toBe(false);
      expect(data.message).toContain("100");
    });
  });

  describe("batch processing", () => {
    beforeEach(() => {
      mockGetProfileIdFromApiKey.mockResolvedValue({ profileId: 1 });
    });

    it("should create multiple jobs successfully", async () => {
      mockFindExistingJob.mockResolvedValue(null);
      mockInsertReturning
        .mockResolvedValueOnce([{ id: 1 }])
        .mockResolvedValueOnce([{ id: 2 }]);
      // Each job also inserts a job_importer record
      mockInsertValues.mockReturnValue({ returning: mockInsertReturning });

      const request = createMockRequest({ jobs: validJobs }, "sjs_valid_key");
      const event = createMockEvent(request);

      const response = await importBatch(event);

      expect(response.status).toBe(200);
      const data = await response.json();
      expect(data.success).toBe(true);
      expect(data.summary.total).toBe(2);
      expect(data.summary.created).toBe(2);
      expect(data.results).toHaveLength(2);
    });

    it("should handle partial failures", async () => {
      mockFindExistingJob.mockResolvedValue(null);
      mockInsertReturning
        .mockResolvedValueOnce([{ id: 1 }])
        .mockResolvedValueOnce(undefined) // insert job_importer for first job
        .mockRejectedValueOnce(new Error("DB error"));
      mockInsertValues.mockReturnValue({ returning: mockInsertReturning });

      const request = createMockRequest({ jobs: validJobs }, "sjs_valid_key");
      const event = createMockEvent(request);

      const response = await importBatch(event);

      expect(response.status).toBe(200);
      const data = await response.json();
      expect(data.success).toBe(false); // Not all succeeded
      expect(data.summary.created).toBe(1);
      expect(data.summary.failed).toBe(1);
    });

    it("should handle mixed create/skip/update results", async () => {
      // First job: no existing, create
      mockFindExistingJob.mockResolvedValueOnce(null);
      mockInsertReturning.mockResolvedValueOnce([{ id: 1 }]);
      mockInsertValues.mockReturnValue({ returning: mockInsertReturning });
      // Second job: existing with same data, skip
      mockFindExistingJob.mockResolvedValueOnce({
        id: 99,
        job_description: null,
      });

      const request = createMockRequest({ jobs: validJobs }, "sjs_valid_key");
      const event = createMockEvent(request);

      const response = await importBatch(event);

      expect(response.status).toBe(200);
      const data = await response.json();
      expect(data.summary.created).toBe(1);
      expect(data.summary.skipped).toBe(1);
    });
  });
});
