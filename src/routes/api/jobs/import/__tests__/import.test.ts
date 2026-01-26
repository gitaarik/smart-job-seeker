/**
 * Unit tests for Job Import API endpoints
 * Tests POST /api/jobs/import and POST /api/jobs/import/batch
 */

import { beforeEach, describe, expect, it, vi } from "vitest";

// Mock the database module
vi.mock("$lib/db", () => ({
  db: {
    profiles: {
      findFirst: vi.fn(),
    },
    jobs: {
      findFirst: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
    },
    api_keys: {
      findUnique: vi.fn(),
      update: vi.fn(),
    },
  },
}));

// Mock the API key verification module
vi.mock("$lib/server/auth/api-key", () => ({
  verifyApiKey: vi.fn(),
}));

import { db } from "$lib/db";
import { verifyApiKey } from "$lib/server/auth/api-key";
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
    vi.clearAllMocks();
  });

  describe("authentication", () => {
    it("should reject request without authentication", async () => {
      const request = createMockRequest(validJob);
      const event = createMockEvent(request);

      const response = await importSingle(event);

      expect(response.status).toBe(401);
      const data = await response.json();
      expect(data.success).toBe(false);
      expect(data.message).toContain("Authentication required");
    });

    it("should reject invalid API key", async () => {
      const mockVerifyApiKey = verifyApiKey as ReturnType<typeof vi.fn>;
      mockVerifyApiKey.mockResolvedValueOnce(null);

      const request = createMockRequest(validJob, "sjs_invalid_key");
      const event = createMockEvent(request);

      const response = await importSingle(event);

      expect(response.status).toBe(401);
      const data = await response.json();
      expect(data.success).toBe(false);
      expect(data.message).toBe("Invalid API key");
    });

    it("should accept valid API key", async () => {
      const mockVerifyApiKey = verifyApiKey as ReturnType<typeof vi.fn>;
      mockVerifyApiKey.mockResolvedValueOnce(1); // Returns profile ID

      const mockDbJobs = db.jobs as any;
      mockDbJobs.findFirst.mockResolvedValueOnce(null); // No existing job
      mockDbJobs.create.mockResolvedValueOnce({ id: 42 });

      const request = createMockRequest(validJob, "sjs_valid_key_here");
      const event = createMockEvent(request);

      const response = await importSingle(event);

      expect(response.status).toBe(200);
      const data = await response.json();
      expect(data.success).toBe(true);
      expect(data.action).toBe("created");
      expect(data.jobId).toBe(42);
    });

    it("should accept session authentication", async () => {
      const mockDbProfiles = db.profiles as any;
      mockDbProfiles.findFirst.mockResolvedValueOnce({ id: 1 });

      const mockDbJobs = db.jobs as any;
      mockDbJobs.findFirst.mockResolvedValueOnce(null);
      mockDbJobs.create.mockResolvedValueOnce({ id: 42 });

      const request = createMockRequest(validJob);
      const event = createMockEvent(request, {
        id: "user-123",
        email: "test@example.com",
        firstName: "Test",
        lastName: "User",
        role: "USER",
      });

      const response = await importSingle(event);

      expect(response.status).toBe(200);
      const data = await response.json();
      expect(data.success).toBe(true);
    });
  });

  describe("validation", () => {
    beforeEach(() => {
      const mockVerifyApiKey = verifyApiKey as ReturnType<typeof vi.fn>;
      mockVerifyApiKey.mockResolvedValue(1);
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
      const mockDbJobs = db.jobs as any;
      mockDbJobs.findFirst.mockResolvedValueOnce(null);
      mockDbJobs.create.mockResolvedValueOnce({ id: 42 });

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
      const mockVerifyApiKey = verifyApiKey as ReturnType<typeof vi.fn>;
      mockVerifyApiKey.mockResolvedValue(1);
    });

    it("should skip duplicate job with same data", async () => {
      const mockDbJobs = db.jobs as any;
      mockDbJobs.findFirst.mockResolvedValueOnce({
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
      const mockDbJobs = db.jobs as any;
      mockDbJobs.findFirst.mockResolvedValueOnce({
        id: 99,
        job_description: "Old description",
      });
      mockDbJobs.update.mockResolvedValueOnce({ id: 99 });

      const request = createMockRequest(validJob, "sjs_valid_key");
      const event = createMockEvent(request);

      const response = await importSingle(event);

      expect(response.status).toBe(200);
      const data = await response.json();
      expect(data.success).toBe(true);
      expect(data.action).toBe("updated");
      expect(data.jobId).toBe(99);
    });

    it("should normalize LinkedIn URLs for deduplication", async () => {
      const mockDbJobs = db.jobs as any;
      mockDbJobs.findFirst.mockResolvedValueOnce(null);
      mockDbJobs.create.mockResolvedValueOnce({ id: 42 });

      const linkedInJob = {
        ...validJob,
        sourceUrl:
          "https://www.linkedin.com/jobs/view/123456?utm_source=google&trackingId=abc",
      };

      const request = createMockRequest(linkedInJob, "sjs_valid_key");
      const event = createMockEvent(request);

      await importSingle(event);

      // Check that the normalized URL was used (without query params for LinkedIn)
      expect(mockDbJobs.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            source_url: "https://www.linkedin.com/jobs/view/123456",
          }),
        }),
      );
    });
  });

  describe("job creation", () => {
    beforeEach(() => {
      const mockVerifyApiKey = verifyApiKey as ReturnType<typeof vi.fn>;
      mockVerifyApiKey.mockResolvedValue(1);
    });

    it("should create new job successfully", async () => {
      const mockDbJobs = db.jobs as any;
      mockDbJobs.findFirst.mockResolvedValueOnce(null);
      mockDbJobs.create.mockResolvedValueOnce({ id: 42 });

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
      const mockDbJobs = db.jobs as any;
      mockDbJobs.findFirst.mockResolvedValueOnce(null);
      mockDbJobs.create.mockRejectedValueOnce(new Error("Database error"));

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
    vi.clearAllMocks();
  });

  describe("authentication", () => {
    it("should reject request without authentication", async () => {
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
      const mockVerifyApiKey = verifyApiKey as ReturnType<typeof vi.fn>;
      mockVerifyApiKey.mockResolvedValue(1);
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
      const mockVerifyApiKey = verifyApiKey as ReturnType<typeof vi.fn>;
      mockVerifyApiKey.mockResolvedValue(1);
    });

    it("should create multiple jobs successfully", async () => {
      const mockDbJobs = db.jobs as any;
      mockDbJobs.findFirst.mockResolvedValue(null);
      mockDbJobs.create
        .mockResolvedValueOnce({ id: 1 })
        .mockResolvedValueOnce({ id: 2 });

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
      const mockDbJobs = db.jobs as any;
      mockDbJobs.findFirst.mockResolvedValue(null);
      mockDbJobs.create
        .mockResolvedValueOnce({ id: 1 })
        .mockRejectedValueOnce(new Error("DB error"));

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
      const mockDbJobs = db.jobs as any;
      // First job: no existing, create
      mockDbJobs.findFirst.mockResolvedValueOnce(null);
      mockDbJobs.create.mockResolvedValueOnce({ id: 1 });
      // Second job: existing with same data, skip
      mockDbJobs.findFirst.mockResolvedValueOnce({
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
