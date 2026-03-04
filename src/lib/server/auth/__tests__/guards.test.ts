import { describe, expect, it } from "vitest";
import { requireAuth, redirectIfAuthenticated } from "../guards";
import { redirect } from "@sveltejs/kit";
import type { RequestEvent } from "@sveltejs/kit";

function createMockEvent(
  user: any = null,
  pathname = "/dashboard",
  search = "",
): RequestEvent {
  return {
    locals: { user, session: null },
    url: { pathname, search } as URL,
  } as unknown as RequestEvent;
}

describe("requireAuth", () => {
  it("returns user when authenticated", () => {
    const user = { id: "user-1", name: "Test" };
    const result = requireAuth(createMockEvent(user));
    expect(result).toBe(user);
  });

  it("redirects to login when not authenticated", () => {
    expect(() => requireAuth(createMockEvent(null, "/dashboard"))).toThrow();

    try {
      requireAuth(createMockEvent(null, "/dashboard"));
    } catch (e: any) {
      expect(e.status).toBe(302);
      expect(e.location).toBe("/login?redirect=%2Fdashboard");
    }
  });

  it("preserves search params in redirect", () => {
    try {
      requireAuth(createMockEvent(null, "/dashboard/jobs", "?page=2"));
    } catch (e: any) {
      expect(e.status).toBe(302);
      expect(e.location).toBe("/login?redirect=%2Fdashboard%2Fjobs%3Fpage%3D2");
    }
  });
});

describe("redirectIfAuthenticated", () => {
  it("does nothing when not authenticated", () => {
    expect(() => redirectIfAuthenticated(createMockEvent(null))).not.toThrow();
  });

  it("redirects to / by default when authenticated", () => {
    const user = { id: "user-1" };
    try {
      redirectIfAuthenticated(createMockEvent(user));
    } catch (e: any) {
      expect(e.status).toBe(302);
      expect(e.location).toBe("/");
    }
  });

  it("redirects to custom path when authenticated", () => {
    const user = { id: "user-1" };
    try {
      redirectIfAuthenticated(createMockEvent(user), "/dashboard");
    } catch (e: any) {
      expect(e.status).toBe(302);
      expect(e.location).toBe("/dashboard");
    }
  });
});
