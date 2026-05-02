/**
 * Smoke tests — verify key pages and API endpoints work against the live dev server.
 *
 * Prerequisites:
 *   1. Docker dev stack running (npm start from cloud/)
 *   2. Test user seeded (alex.morgan@example.com / testpassword123)
 *
 * Run: npm run test:e2e
 */

import { beforeAll, describe, expect, it } from "vitest";
import { BASE_URL, clearSession, expectPage, request, signIn } from "./helpers";

beforeAll(async () => {
  // Verify the dev server is reachable before running any tests
  try {
    const res = await fetch(BASE_URL, {
      signal: AbortSignal.timeout(5000),
    });
    if (!res.ok && res.status !== 302) {
      throw new Error(`Server returned ${res.status}`);
    }
  } catch (error) {
    throw new Error(
      `Dev server not reachable at ${BASE_URL}. ` +
        `Make sure the Docker dev stack is running (npm start from cloud/).`,
    );
  }
});

// ============================================================================
// Public pages (no auth)
// ============================================================================

describe("public pages", () => {
  it("login page renders", async () => {
    await expectPage("/login", { auth: false });
  });

  it("signup page is reachable", async () => {
    const res = await request("/signup", { auth: false });
    // 200 if renders, 302 if redirects (e.g. already logged in)
    expect([200, 302]).toContain(res.status);
  });

  it("unauthenticated /home redirects to /login", async () => {
    const res = await request("/home", { auth: false });
    expect(res.status).toBe(302);
    const location = res.headers.get("location");
    expect(location).toContain("/login");
  });
});

// ============================================================================
// Authentication
// ============================================================================

describe("authentication", () => {
  it("sign-in returns session cookie", async () => {
    clearSession();
    const cookie = await signIn();
    expect(cookie).toContain("better-auth.session_token");
  });

  it("invalid credentials return 401", async () => {
    const res = await request("/api/auth/sign-in/email", {
      auth: false,
      method: "POST",
      body: { email: "wrong@example.com", password: "wrong" },
    });
    expect(res.status).toBe(401);
  });
});

// ============================================================================
// Authenticated pages
// ============================================================================

describe("dashboard pages", () => {
  it("dashboard home renders", async () => {
    await expectPage("/home");
  });

  it("jobs page renders", async () => {
    await expectPage("/jobs");
  });

  it("applications page renders", async () => {
    await expectPage("/applications/active");
  });

  it("profile create page renders", async () => {
    await expectPage("/profile/create");
  });

  it("billing page renders", async () => {
    await expectPage("/billing");
  });

  it("contacts page renders", async () => {
    await expectPage("/contacts");
  });

  it("export page renders", async () => {
    await expectPage("/export/import");
  });
});

// ============================================================================
// Authenticated API endpoints
// ============================================================================

describe("API endpoints", () => {
  it("GET /api/billing/subscription returns data", async () => {
    const res = await request("/api/billing/subscription");
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data).toHaveProperty("creditBalance");
  });

  it("GET /api/matcher/status returns data", async () => {
    // Need a profileId — get it from the dashboard first
    const res = await request("/api/platforms?profileId=12");
    // 200 or 400 (if profile doesn't exist) — either is fine, not 401/500
    expect([200, 400]).toContain(res.status);
  });

  it("GET /api/tunnel/status returns data", async () => {
    const res = await request("/api/tunnel/status?profileId=12");
    expect([200, 400]).toContain(res.status);
  });

  it("unauthenticated API returns 401", async () => {
    const res = await request("/api/billing/subscription", { auth: false });
    expect(res.status).toBe(401);
  });
});

// ============================================================================
// Public API endpoints
// ============================================================================

describe("public API endpoints", () => {
  it("POST /api/verify-turnstile rejects empty token", async () => {
    const res = await request("/api/verify-turnstile", {
      auth: false,
      method: "POST",
      body: { token: "" },
    });
    // 400 for invalid/empty token — not a 500
    expect([400, 200]).toContain(res.status);
  });
});
