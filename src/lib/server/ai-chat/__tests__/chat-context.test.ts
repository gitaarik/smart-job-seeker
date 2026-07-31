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

import {
  CHAT_BUDGET_CHARS,
  normalizeRouteId,
  resolveChatContext,
  scopeForRoute,
} from "../chat-context";

beforeEach(() => {
  applicationRow = null;
  jobRow = null;
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
    expect(scope.sources).toContain("application_records");
  });

  it("inherits the parent scope on a nested tab", () => {
    // The whole point of prefix matching: /texts, /documents, /timeline and
    // friends must not each need their own row.
    for (const tab of ["texts", "documents", "timeline", "salary"]) {
      const scope = scopeForRoute(`/(app)/applications/[id]/${tab}`);
      expect(scope.entity).toBe("application");
      expect(scope.sources).toContain("application_documents");
    }
  });

  it("scopes a job page to the job, without application-only sources", () => {
    const scope = scopeForRoute("/(app)/jobs/[id]");
    expect(scope.entity).toBe("job");
    expect(scope.sources).toContain("job");
    expect(scope.sources).not.toContain("application_records");
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
  const base = { profileId: 7, message: "How should I answer this?" };

  it("assembles the full application scope for an owned application", async () => {
    applicationRow = {
      id: 42,
      job: { title: "Staff Engineer", skills_required: ["Go"] },
    };

    const ctx = await resolveChatContext({
      ...base,
      routeId: "/(app)/applications/[id]",
      params: { id: "42" },
    });

    expect(ctx.entity).toEqual({ type: "application", id: 42 });
    expect(ctx.sources).toContain("application_records");
    expect(ctx.budgetChars).toBe(CHAT_BUDGET_CHARS);
  });

  it("ranks on the message plus the role title and its skills", async () => {
    applicationRow = {
      id: 42,
      job: { title: "Staff Engineer", skills_required: ["Go"] },
    };

    const ctx = await resolveChatContext({
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

    const ctx = await resolveChatContext({
      ...base,
      routeId: "/(app)/applications/[id]",
      params: { id: "9999" },
    });

    expect(ctx.entity).toBeUndefined();
    expect(ctx.sources).not.toContain("job");
    expect(ctx.sources).not.toContain("application_records");
    expect(ctx.sources).not.toContain("application_documents");
    expect(ctx.sources).toContain("profile");
  });

  it("drops entity sources when the route param isn't a usable id", async () => {
    const ctx = await resolveChatContext({
      ...base,
      routeId: "/(app)/applications/[id]",
      params: { id: "not-a-number" },
    });

    expect(ctx.entity).toBeUndefined();
    expect(ctx.sources).not.toContain("application_records");
  });

  it("resolves a job page without requiring an application", async () => {
    jobRow = { id: 5, title: "Backend Engineer", skills_required: ["Rust"] };

    const ctx = await resolveChatContext({
      ...base,
      routeId: "/(app)/jobs/[id]",
      params: { id: "5" },
    });

    expect(ctx.entity).toEqual({ type: "job", id: 5 });
    expect(ctx.query?.skills).toEqual(["Rust"]);
  });
});
