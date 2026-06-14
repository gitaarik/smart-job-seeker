/**
 * Tests for the per-device / per-sharee scrape rate budget.
 *
 * Invariants:
 *   - under all limits → allowed
 *   - device daily ceiling reached → blocked (everyone)
 *   - a run moments ago on the device → blocked on spacing
 *   - sharee daily cap reached → blocked (sharees only)
 *   - the device owner is not subject to the per-sharee cap
 */

import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  checkDeviceRateBudget,
  DEVICE_MAX_RUNS_PER_DAY,
  SHAREE_MAX_RUNS_PER_DAY,
} from "$lib/server/device-rate-budget";

// db.select(...).from(...).innerJoin(...)[.innerJoin(...)].where(...)[.orderBy(...)]
// resolves to the next queued result array. One queued entry is consumed per
// db.select() call (device query first, then the optional sharee query).
let selectResults: unknown[][] = [];
let selectCallCount = 0;

function makeChain() {
  const result = selectResults.shift() ?? [];
  const chain: Record<string, unknown> = {};
  for (const m of ["from", "innerJoin", "where", "orderBy"]) {
    chain[m] = () => chain;
  }
  chain.then = (resolve: (v: unknown) => unknown) => resolve(result);
  return chain;
}

vi.mock("$lib/server/db", () => ({
  db: {
    select: () => {
      selectCallCount++;
      return makeChain();
    },
  },
}));

vi.mock("drizzle-orm", () => ({
  eq: vi.fn(() => ({})),
  and: vi.fn(() => ({})),
  desc: vi.fn(() => ({})),
  gt: vi.fn(() => ({})),
}));

vi.mock("$lib/server/db/schema", () => ({
  profiles: { id: "profiles.id", user_id: "profiles.user_id" },
  search_task_runs: {
    id: "str.id",
    search_task_id: "str.search_task_id",
    started_at: "str.started_at",
  },
  search_tasks: {
    id: "st.id",
    profile_id: "st.profile_id",
    sjsbrowser_api_key: "st.sjsbrowser_api_key",
  },
}));

function runsAgo(...minutesAgo: number[]): { started_at: Date }[] {
  const now = Date.now();
  return minutesAgo.map((m) => ({
    started_at: new Date(now - m * 60 * 1000),
  }));
}

beforeEach(() => {
  selectResults = [];
  selectCallCount = 0;
});

describe("checkDeviceRateBudget", () => {
  it("allows a run when under all limits", async () => {
    selectResults = [
      runsAgo(30, 120), // device: 2 runs, last 30m ago
      [{ id: 1 }], // sharee: 1 run
    ];
    const res = await checkDeviceRateBudget({
      apiKeyId: 42,
      requesterId: "bob",
      isShared: true,
    });
    expect(res.allowed).toBe(true);
  });

  it("blocks when the device hit its daily ceiling", async () => {
    selectResults = [
      runsAgo(
        ...Array.from({ length: DEVICE_MAX_RUNS_PER_DAY }, (_, i) => 30 + i),
      ),
    ];
    const res = await checkDeviceRateBudget({
      apiKeyId: 42,
      requesterId: "bob",
      isShared: true,
    });
    expect(res.allowed).toBe(false);
    expect(res.error).toMatch(/daily scrape limit/i);
    // ceiling short-circuits before the sharee query runs
    expect(selectCallCount).toBe(1);
  });

  it("blocks on spacing when a run just happened on the device", async () => {
    selectResults = [runsAgo(1)]; // last run 1 min ago (< 3 min)
    const res = await checkDeviceRateBudget({
      apiKeyId: 42,
      requesterId: "bob",
      isShared: true,
    });
    expect(res.allowed).toBe(false);
    expect(res.error).toMatch(/wait a few minutes/i);
  });

  it("blocks a sharee who reached their per-sharee daily cap", async () => {
    selectResults = [
      runsAgo(30, 90), // device: fine on count + spacing
      Array.from({ length: SHAREE_MAX_RUNS_PER_DAY }, (_, i) => ({ id: i })),
    ];
    const res = await checkDeviceRateBudget({
      apiKeyId: 42,
      requesterId: "bob",
      isShared: true,
    });
    expect(res.allowed).toBe(false);
    expect(res.error).toMatch(/daily limit on this shared device/i);
  });

  it("does not apply the per-sharee cap to the device owner", async () => {
    // Only the device query runs for an owner (isShared: false).
    selectResults = [runsAgo(30, 90)];
    const res = await checkDeviceRateBudget({
      apiKeyId: 42,
      requesterId: "alice",
      isShared: false,
    });
    expect(res.allowed).toBe(true);
    expect(selectCallCount).toBe(1); // no sharee query
  });
});
