/**
 * Tests for the job write helpers that aren't already covered through their
 * callers.
 *
 * `applyJobSkills` is here because its two non-obvious behaviours are both
 * invisible from the capability that calls it: an omitted list must not reach
 * the column (each list is written whole, so passing one through as null would
 * empty it), and a skill change must invalidate the job's match scores, because
 * these two columns are the only job-side inputs the matcher reads.
 */
import { beforeEach, describe, expect, it, vi } from "vitest";

interface UpdateCall {
  table: unknown;
  values: Record<string, unknown>;
}

const updates: UpdateCall[] = [];

vi.mock("$lib/server/db", () => ({
  dbDirect: {
    update: (table: unknown) => ({
      set: (values: Record<string, unknown>) => ({
        where: () => {
          updates.push({ table, values });
          return Promise.resolve();
        },
      }),
    }),
  },
}));

vi.mock("$lib/server/db/schema", () => ({
  jobs: { id: "jobs.id", __table: "jobs" },
  job_matches: { job_id: "job_matches.job_id", __table: "job_matches" },
  job_importers: {},
  job_platforms: {},
}));

import { applyJobSkills } from "../edit-job";

const jobWrite = () =>
  updates.find((u) => (u.table as { __table: string }).__table === "jobs");
const matchWrite = () =>
  updates.find((u) =>
    (u.table as { __table: string }).__table === "job_matches"
  );

beforeEach(() => {
  updates.length = 0;
});

describe("applyJobSkills", () => {
  it("writes only the list it was given", async () => {
    await applyJobSkills(3822, { skills_required: ["React", "Node.js"] });

    expect(jobWrite()?.values).toMatchObject({
      skills_required: ["React", "Node.js"],
    });
    // The one that matters: the untouched list must not appear in the patch at
    // all. A `skills_preferred: undefined` key would be written as null by
    // Drizzle and silently empty the column.
    expect(jobWrite()?.values).not.toHaveProperty("skills_preferred");
  });

  it("writes both when both are given", async () => {
    await applyJobSkills(3822, {
      skills_required: ["React"],
      skills_preferred: ["pgvector"],
    });

    expect(jobWrite()?.values).toMatchObject({
      skills_required: ["React"],
      skills_preferred: ["pgvector"],
    });
  });

  it("clears a list on an explicit null", async () => {
    await applyJobSkills(3822, { skills_preferred: null });
    expect(jobWrite()?.values).toMatchObject({ skills_preferred: null });
  });

  it("flags the job's matches for re-scoring", async () => {
    // Skills are the score's inputs, so a hand-edited list with the old number
    // still on the page is worse than either alone.
    await applyJobSkills(3822, { skills_required: ["React"] });

    expect(matchWrite()?.values.rescore_requested_at).toBeInstanceOf(Date);
  });

  it("writes nothing at all when given nothing", async () => {
    // Without the guard this bumps date_updated and invalidates every match row
    // for the job — a fleet-wide re-score for a no-op.
    await applyJobSkills(3822, {});
    expect(updates).toEqual([]);
  });
});
