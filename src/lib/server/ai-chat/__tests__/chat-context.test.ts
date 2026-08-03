import { beforeEach, describe, expect, it, vi } from "vitest";

// Ownership lookups and the ranking-terms lookup both go through db.query;
// each test sets what the next findFirst calls resolve to.
let applicationRow: unknown = null;
let jobRow: unknown = null;

vi.mock("$lib/server/db", () => ({
  db: {
    query: {
      applications: { findFirst: () => Promise.resolve(applicationRow) },
      jobs: { findFirst: () => Promise.resolve(jobRow) },
    },
  },
}));

// The registry has its own tests. What matters here is which capabilities a
// route hands it and who it says is asking — the resolve/authorize behaviour
// behind them is capabilities.test.ts's business.
const mockResolveCapabilities = vi.fn().mockResolvedValue([]);
vi.mock("../capabilities", () => ({
  resolveCapabilities: (...a: unknown[]) => mockResolveCapabilities(...a),
}));

import {
  CHAT_BUDGET_CHARS,
  normalizeRouteId,
  resolveChatContext,
  scopeForRoute,
} from "../chat-context";

beforeEach(() => {
  applicationRow = null;
  jobRow = null;
  mockResolveCapabilities.mockClear();
  mockResolveCapabilities.mockResolvedValue([]);
});

describe("normalizeRouteId", () => {
  it("strips SvelteKit group segments", () => {
    expect(normalizeRouteId("/(app)/applications/[id]/texts")).toBe(
      "/applications/[id]/texts",
    );
    expect(normalizeRouteId("/(app)/profile/(data)/skills")).toBe(
      "/profile/skills",
    );
  });

  it("treats a missing route as the empty route", () => {
    expect(normalizeRouteId(null)).toBe("");
    expect(normalizeRouteId(undefined)).toBe("");
  });
});

describe("scopeForRoute", () => {
  it("scopes an application page to that application", () => {
    const scope = scopeForRoute("/(app)/applications/[id]");
    expect(scope.entity).toBe("application");
    expect(scope.sources).toContain("application_activity");
  });

  it("inherits the parent scope on a nested tab", () => {
    // The whole point of prefix matching: /texts, /documents, /timeline and
    // friends must not each need their own row.
    for (const tab of ["texts", "documents", "timeline", "salary"]) {
      const scope = scopeForRoute(`/(app)/applications/[id]/${tab}`);
      expect(scope.entity).toBe("application");
      expect(scope.sources).toContain("application_activity");
    }
  });

  it("scopes a job page to the job, without application-only sources", () => {
    const scope = scopeForRoute("/(app)/jobs/[id]");
    expect(scope.entity).toBe("job");
    expect(scope.sources).toContain("job");
    expect(scope.sources).not.toContain("application_activity");
  });

  it("does not confuse a sibling route with a prefix match", () => {
    // "/applications/interview" must not match "/applications/[id]".
    expect(scopeForRoute("/(app)/applications/interview").entity).toBeNull();
  });

  it("falls back to profile-only for unmapped and unknown routes", () => {
    for (const route of ["/(app)/home", "/(app)/settings", null]) {
      const scope = scopeForRoute(route);
      expect(scope.entity).toBeNull();
      expect(scope.sources).toEqual(["profile", "projects", "stories"]);
    }
  });
});

describe("resolveChatContext", () => {
  const base = {
    profileId: 7,
    isStaff: false,
    message: "How should I answer this?",
  };

  it("assembles the full application scope for an owned application", async () => {
    applicationRow = {
      id: 42,
      job: { title: "Staff Engineer", skills_required: ["Go"] },
    };

    const { context: ctx } = await resolveChatContext({
      ...base,
      routeId: "/(app)/applications/[id]",
      params: { id: "42" },
    });

    expect(ctx.entity).toEqual({ type: "application", id: 42 });
    expect(ctx.sources).toContain("application_activity");
    expect(ctx.budgetChars).toBe(CHAT_BUDGET_CHARS);
  });

  it("ranks on the message plus the role title and its skills", async () => {
    applicationRow = {
      id: 42,
      job: { title: "Staff Engineer", skills_required: ["Go"] },
    };

    const { context: ctx } = await resolveChatContext({
      ...base,
      routeId: "/(app)/applications/[id]",
      params: { id: "42" },
    });

    // The message leads — what they just asked is what they want evidence
    // about — with the role folded in so a vague question still ranks.
    expect(ctx.query?.text).toContain("How should I answer this?");
    expect(ctx.query?.text).toContain("Staff Engineer");
    expect(ctx.query?.skills).toEqual(["Go"]);
  });

  it("drops entity sources when the application belongs to someone else", async () => {
    // findFirst is filtered on profile_id, so a foreign application returns
    // nothing — the chat degrades to profile-only rather than failing.
    applicationRow = null;

    const { context: ctx } = await resolveChatContext({
      ...base,
      routeId: "/(app)/applications/[id]",
      params: { id: "9999" },
    });

    expect(ctx.entity).toBeUndefined();
    expect(ctx.sources).not.toContain("job");
    expect(ctx.sources).not.toContain("application_activity");
    expect(ctx.sources).not.toContain("application_activity");
    expect(ctx.sources).toContain("profile");
  });

  it("drops entity sources when the route param isn't a usable id", async () => {
    const { context: ctx } = await resolveChatContext({
      ...base,
      routeId: "/(app)/applications/[id]",
      params: { id: "not-a-number" },
    });

    expect(ctx.entity).toBeUndefined();
    expect(ctx.sources).not.toContain("application_activity");
  });

  it("resolves a job page without requiring an application", async () => {
    jobRow = { id: 5, title: "Backend Engineer", skills_required: ["Rust"] };

    const { context: ctx } = await resolveChatContext({
      ...base,
      routeId: "/(app)/jobs/[id]",
      params: { id: "5" },
    });

    expect(ctx.entity).toEqual({ type: "job", id: 5 });
    expect(ctx.query?.skills).toEqual(["Rust"]);
  });
});

describe("resolveChatContext — capabilities", () => {
  const base = {
    profileId: 7,
    isStaff: false,
    message: "Set the salary to 50-150 per hour",
  };

  it("offers the job edits on a job page", async () => {
    jobRow = { id: 5, title: "Backend Engineer" };

    await resolveChatContext({
      ...base,
      routeId: "/(app)/jobs/[id]",
      params: { id: "5" },
    });

    expect(mockResolveCapabilities).toHaveBeenCalledWith(
      ["edit_job_details", "edit_job_description"],
      { type: "job", id: 5 },
      { profileId: 7, isStaff: false },
    );
  });

  it("offers the attached job's edits from an application page", async () => {
    // The point of keying the registry by capability rather than by page: an
    // application page reaches the job through application.job_id.
    applicationRow = { id: 42, job: { title: "Staff Engineer" } };

    await resolveChatContext({
      ...base,
      routeId: "/(app)/applications/[id]",
      params: { id: "42" },
    });

    const [declared] = mockResolveCapabilities.mock.calls[0];
    expect(declared).toContain("edit_application_details");
    expect(declared).toContain("edit_job_details");
    expect(declared).toContain("edit_job_description");
  });

  it("inherits capabilities on a nested application tab", async () => {
    applicationRow = { id: 42, job: { title: "Staff Engineer" } };

    await resolveChatContext({
      ...base,
      routeId: "/(app)/applications/[id]/texts",
      params: { id: "42" },
    });

    expect(mockResolveCapabilities.mock.calls[0][0]).toContain(
      "edit_application_details",
    );
  });

  it("offers nothing on a page with no capabilities declared", async () => {
    const { capabilities } = await resolveChatContext({
      ...base,
      routeId: "/(app)/profile",
      params: {},
    });

    expect(mockResolveCapabilities).toHaveBeenCalledWith(
      [],
      null,
      expect.anything(),
    );
    expect(capabilities).toEqual([]);
  });

  it("passes staff status through to the registry rather than assuming it", async () => {
    // Staff can edit manual jobs they didn't import, so this flag decides real
    // access. It comes from the session — never from the request body, which is
    // where the route and params come from.
    jobRow = { id: 5, title: "Backend Engineer" };

    await resolveChatContext({
      ...base,
      isStaff: true,
      routeId: "/(app)/jobs/[id]",
      params: { id: "5" },
    });

    expect(mockResolveCapabilities).toHaveBeenCalledWith(
      expect.anything(),
      expect.anything(),
      { profileId: 7, isStaff: true },
    );
  });

  it("still resolves capabilities when the entity did not resolve", async () => {
    // resolveCapabilities is what decides a null entity means nothing to act
    // on — chat-context must not silently skip the call and let a stale
    // capability list survive.
    applicationRow = null;

    await resolveChatContext({
      ...base,
      routeId: "/(app)/applications/[id]",
      params: { id: "9999" },
    });

    expect(mockResolveCapabilities).toHaveBeenCalledWith(
      expect.anything(),
      null,
      expect.anything(),
    );
  });
});
