import { beforeEach, describe, expect, it, vi } from "vitest";

const mockGetEnv = vi.fn();

vi.mock("$lib/tools/get-env", () => ({
  getEnv: (...args: any[]) => mockGetEnv(...args),
}));

import { verifyWebhookAuth } from "../auth";

function createRequest(headers: Record<string, string> = {}): {
  request: Request;
} {
  return {
    request: new Request("http://localhost/api/webhook", {
      method: "POST",
      headers,
    }),
  };
}

describe("verifyWebhookAuth", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetEnv.mockReturnValue("webhook-secret-123");
  });

  it("returns 500 when webhook secret is not configured", async () => {
    mockGetEnv.mockReturnValue("");
    const result = await verifyWebhookAuth(createRequest());
    expect(result.success).toBe(false);
    expect(result.status).toBe(500);
    expect(result.error).toContain("not set");
  });

  it("returns 401 when header is missing", async () => {
    const result = await verifyWebhookAuth(createRequest());
    expect(result.success).toBe(false);
    expect(result.status).toBe(401);
    expect(result.error).toContain("Missing");
  });

  it("returns 401 when secret doesn't match", async () => {
    const result = await verifyWebhookAuth(
      createRequest({ "x-webhook-secret": "wrong-secret" }),
    );
    expect(result.success).toBe(false);
    expect(result.status).toBe(401);
    expect(result.error).toContain("Invalid");
  });

  it("returns success when secret matches", async () => {
    const result = await verifyWebhookAuth(
      createRequest({ "x-webhook-secret": "webhook-secret-123" }),
    );
    expect(result).toEqual({ success: true });
  });
});
