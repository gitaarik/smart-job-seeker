/**
 * Tests for the capability registry — what the assistant may propose, and the
 * checks standing between a proposal and a write.
 *
 * The load-bearing behaviours here are the ones a reader would not guess:
 *
 *  - a capability resolves through the *page's* entity, so `edit_job_details`
 *    reaches a job from an application page as well as a job page;
 *  - `authorize` is asked independently of the entity resolving, because
 *    resolveEntity resolves any job to any signed-in user by design;
 *  - proposals are partial, so an omitted field must keep its current value —
 *    the alternative is a model that mentions one field wiping the other twelve.
 */
import { beforeEach, describe, expect, it, vi } from "vitest";
import { z } from "zod";

let applicationRow: unknown = null;
let jobRow: unknown = null;
const mockAppUpdateSet = vi.fn().mockReturnValue({
  where: vi.fn().mockResolvedValue(undefined),
});

vi.mock("$lib/server/db", () => ({
  db: {
    query: {
      applications: { findFirst: () => Promise.resolve(applicationRow) },
      jobs: { findFirst: () => Promise.resolve(jobRow) },
    },
    update: () => ({ set: (...a: unknown[]) => mockAppUpdateSet(...a) }),
  },
  dbDirect: {
    query: {
      applications: { findFirst: () => Promise.resolve(applicationRow) },
      jobs: { findFirst: () => Promise.resolve(jobRow) },
    },
  },
}));

vi.mock("$lib/server/db/schema", () => ({
  applications: {
    id: "applications.id",
    profile_id: "applications.profile_id",
  },
  jobs: { id: "jobs.id" },
  job_importers: {},
}));

const mockCanEditJob = vi.fn();
const mockApplyJobFields = vi.fn().mockResolvedValue(undefined);
const mockApplyJobTexts = vi.fn().mockResolvedValue(undefined);

vi.mock("$lib/server/jobs/edit-job", async (importOriginal) => ({
  ...(await importOriginal<typeof import("$lib/server/jobs/edit-job")>()),
  canEditJob: (...a: unknown[]) => mockCanEditJob(...a),
  applyJobFields: (...a: unknown[]) => mockApplyJobFields(...a),
  applyJobTexts: (...a: unknown[]) => mockApplyJobTexts(...a),
}));

import {
  buildProposalSchema,
  CAPABILITIES,
  type Capability,
  describeProposalChanges,
  fieldsFromChanges,
  pickCapabilityFields,
  renderCapabilityPrompt,
  resolveCapabilities,
} from "../capabilities";

const ACTOR = { profileId: 12, isStaff: false };

beforeEach(() => {
  vi.clearAllMocks();
  applicationRow = null;
  jobRow = null;
  mockCanEditJob.mockResolvedValue(true);
  mockApplyJobFields.mockResolvedValue(undefined);
  mockApplyJobTexts.mockResolvedValue(undefined);
  mockAppUpdateSet.mockReturnValue({
    where: vi.fn().mockResolvedValue(undefined),
  });
});

describe("registry invariants", () => {
  it("keeps field names unique across capabilities", () => {
    // buildProposalSchema merges the live capabilities' shapes into one object,
    // so a shared field name would let one capability's value validate inside
    // another's payload and be written to the wrong row.
    const seen = new Map<string, string>();
    for (const [name, def] of Object.entries(CAPABILITIES)) {
      for (const field of Object.keys(def.fields)) {
        expect(
          seen.has(field),
          `"${field}" is declared by both ${seen.get(field)} and ${name}`,
        ).toBe(false);
        seen.set(field, name);
      }
    }
  });

  it("makes every proposal field optional", () => {
    // "Absent means unchanged" only holds if nothing is required — a required
    // field would force the model to restate values it isn't changing, and
    // restated values are how a partial edit turns into a wipe.
    //
    // Asserted through the real wire schema rather than by inspecting each
    // field's type: it tests the shape the provider is actually handed.
    for (const [name, def] of Object.entries(CAPABILITIES)) {
      const result = buildProposalSchema([name as Capability])
        .safeParse({ reply: "x" });
      expect(result.success, `${name} must accept an empty proposal`).toBe(
        true,
      );
    }
  });
});

describe("resolveCapabilities", () => {
  it("reaches the attached job from an application page", async () => {
    applicationRow = { id: 42, job_id: 900 };
    jobRow = { id: 900, title: "Staff Engineer", company: "Acme" };

    const live = await resolveCapabilities(
      ["edit_job_details"],
      { type: "application", id: 42 },
      ACTOR,
    );

    expect(live).toHaveLength(1);
    expect(live[0].target).toMatchObject({
      id: 900,
      label: "Staff Engineer at Acme",
    });
  });

  it("drops the job capabilities when the application has no job", async () => {
    applicationRow = { id: 42, job_id: null };

    const live = await resolveCapabilities(
      ["edit_job_details", "edit_job_description"],
      { type: "application", id: 42 },
      ACTOR,
    );

    expect(live).toEqual([]);
  });

  it("drops a capability the actor is not allowed to use", async () => {
    // A scraped job, or a manual one this profile didn't import. The assistant
    // is never told it could edit it, rather than offering an edit that 403s.
    jobRow = { id: 900, title: "Staff Engineer", company: "Acme" };
    mockCanEditJob.mockResolvedValue(false);

    const live = await resolveCapabilities(
      ["edit_job_details"],
      { type: "job", id: 900 },
      ACTOR,
    );

    expect(live).toEqual([]);
  });

  it("asks authorize even though the entity already resolved", async () => {
    // resolveEntity resolves any job to any signed-in user by design, because
    // /jobs/[id] renders any job to any signed-in user. Edit rights are a
    // separate question and must be asked separately.
    jobRow = { id: 900, title: "Staff Engineer", company: null };

    await resolveCapabilities(["edit_job_details"], {
      type: "job",
      id: 900,
    }, ACTOR);

    expect(mockCanEditJob).toHaveBeenCalledWith(900, 12, false);
  });

  it("resolves nothing without an entity", async () => {
    const live = await resolveCapabilities(
      ["edit_job_details", "edit_application_details"],
      null,
      ACTOR,
    );
    expect(live).toEqual([]);
  });

  it("does not offer application edits on a job page", async () => {
    jobRow = { id: 900, title: "Staff Engineer", company: null };

    const live = await resolveCapabilities(
      ["edit_application_details"],
      { type: "job", id: 900 },
      ACTOR,
    );

    expect(live).toEqual([]);
  });

  it("carries the current values so the model can propose a diff", async () => {
    jobRow = {
      id: 900,
      title: "Staff Engineer",
      company: "Acme",
      salary_min: 100,
      salary_period: "year",
      work_location: ["remote"],
    };

    const live = await resolveCapabilities(
      ["edit_job_details"],
      { type: "job", id: 900 },
      ACTOR,
    );

    expect(live[0].current).toMatchObject({
      title: "Staff Engineer",
      salary_min: 100,
      work_location: ["remote"],
    });
  });
});

describe("pickCapabilityFields", () => {
  it("drops fields that belong to another capability", () => {
    // The provider sees one merged object, so a model can put a job field in an
    // application proposal and have it validate. This is where that is undone.
    const picked = pickCapabilityFields("edit_application_details", {
      cv_sent_through: "LinkedIn",
      salary_min: 999,
      title: "Nope",
    });
    expect(picked).toEqual({ cv_sent_through: "LinkedIn" });
  });
});

describe("edit_job_details", () => {
  const def = CAPABILITIES.edit_job_details;
  const target = { id: 900, label: "Staff Engineer at Acme" };

  it("merges a partial proposal over the current row", async () => {
    // The single most important behaviour here: applyJobFields is authoritative
    // for every column it writes, so an unmerged partial would clear the twelve
    // fields the model didn't mention.
    const current = {
      title: "Staff Engineer",
      company: "Acme",
      salary_min: 100000,
      salary_max: 130000,
      salary_currency: "EUR",
      salary_period: "year",
      work_location: ["remote"],
    };

    await def.apply(target, { salary_max: 140000 }, current);

    expect(mockApplyJobFields).toHaveBeenCalledWith(
      900,
      expect.objectContaining({
        title: "Staff Engineer",
        company: "Acme",
        salary_min: 100000,
        salary_max: 140000,
        work_location: ["remote"],
      }),
    );
  });

  it("lets an explicit null clear a column", async () => {
    await def.apply(target, { salary_min: null }, {
      title: "Staff Engineer",
      salary_min: 100000,
    });

    expect(mockApplyJobFields).toHaveBeenCalledWith(
      900,
      expect.objectContaining({ salary_min: null }),
    );
  });

  it("rejects a proposal that would empty the title", () => {
    const res = def.validate({ title: null }, { title: "Staff Engineer" });
    expect(res.ok).toBe(false);
  });

  it("accepts a proposal that leaves the title alone", () => {
    const res = def.validate({ salary_min: 50 }, { title: "Staff Engineer" });
    expect(res.ok).toBe(true);
  });
});

describe("edit_job_description", () => {
  const def = CAPABILITIES.edit_job_description;
  const target = { id: 900, label: "x" };

  it("rejects an empty job description", () => {
    expect(def.validate({ job_description: "   " }, {}).ok).toBe(false);
  });

  it("accepts a proposal that only touches the company profile", () => {
    // The gap this closes: with job_description as the only field, a request to
    // fix the "About the company" blurb had nowhere to go, so the model wrote
    // company text into the posting and then claimed it had removed details
    // that were still sitting in the field it could not reach.
    expect(def.validate({ company_description: "About G2i…" }, {}).ok).toBe(
      true,
    );
  });

  it("covers both long-form texts", () => {
    expect(Object.keys(def.fields).sort()).toEqual([
      "company_description",
      "job_description",
    ]);
  });

  it("writes only the text that was proposed", async () => {
    // applyJobTexts leaves an omitted field alone, so rewriting one text must
    // never blank the other.
    await def.apply(target, { company_description: "About G2i" }, {});
    expect(mockApplyJobTexts).toHaveBeenCalledWith(900, {
      company_description: "About G2i",
    });
    expect(mockApplyJobTexts.mock.calls[0][1]).not.toHaveProperty(
      "job_description",
    );
  });

  it("writes both when both are proposed", async () => {
    await def.apply(target, {
      job_description: "New posting",
      company_description: "New blurb",
    }, {});
    expect(mockApplyJobTexts).toHaveBeenCalledWith(900, {
      job_description: "New posting",
      company_description: "New blurb",
    });
  });

  it("tells the model which field holds which subject", async () => {
    // Without this the model routes a company correction into the posting —
    // the exact failure that produced three rewrites of the wrong field.
    jobRow = { id: 900, title: "Evaluator", company: "G2i" };
    const live = await resolveCapabilities(
      ["edit_job_description"],
      { type: "job", id: 900 },
      ACTOR,
    );
    const prompt = renderCapabilityPrompt(live);
    expect(prompt).toMatch(/about the ROLE/i);
    expect(prompt).toMatch(/about the COMPANY/i);
    expect(prompt).toMatch(/change THAT field/i);
  });
});

describe("edit_application_details", () => {
  const def = CAPABILITIES.edit_application_details;

  it("rejects a date that isn't YYYY-MM-DD", () => {
    expect(
      def.validate({ application_sent_date: "30-07-2026" }, {}).ok,
    ).toBe(false);
    expect(
      def.validate({ application_sent_date: "2026-07-30" }, {}).ok,
    ).toBe(true);
  });

  it("merges over current values rather than clearing the rest", async () => {
    await def.apply({ id: 42, label: "x" }, {
      application_seen_date: "2026-08-01",
    }, {
      cv_sent_through: "LinkedIn",
      application_sent_date: "2026-07-30",
      application_seen_date: null,
    });

    expect(mockAppUpdateSet).toHaveBeenCalledWith(
      expect.objectContaining({
        cv_sent_through: "LinkedIn",
        application_sent_date: "2026-07-30",
        application_seen_date: "2026-08-01",
      }),
    );
  });

  it("only authorizes an application this profile owns", async () => {
    applicationRow = null;
    expect(await def.authorize({ id: 42, label: "x" }, ACTOR)).toBe(false);

    applicationRow = { id: 42 };
    expect(await def.authorize({ id: 42, label: "x" }, ACTOR)).toBe(true);
  });
});

describe("buildProposalSchema", () => {
  it("accepts the loose shapes both providers actually return", () => {
    // gpt-oss returns bare values where arrays belong and quotes its numbers.
    // The wire schema has to ADMIT those rather than reject the turn — it
    // cannot fix them, because a schema that coerces can't be converted to
    // JSON Schema, and the provider needs JSON Schema. fieldsFromChanges does
    // the fixing, below.
    const schema = buildProposalSchema(["edit_job_details"]);
    const parsed = schema.parse({
      reply: "Sure.",
      proposals: [{
        capability: "edit_job_details",
        rationale: "Matches the posting.",
        changes: [
          { field: "salary_min", value: "55,000" },
          { field: "work_location", value: "remote" },
          { field: "job_types", value: ["contract"] },
        ],
      }],
    });

    expect(parsed.proposals?.[0].changes[0].value).toBe("55,000");
    expect(parsed.proposals?.[0].changes[1].value).toBe("remote");
  });

  it("rejects a field name outside the live capabilities", () => {
    // The enum constrains the provider at generation time, so a cross-
    // capability field can't be produced in the first place.
    const schema = buildProposalSchema(["edit_job_description"]);
    expect(() =>
      schema.parse({
        reply: "x",
        proposals: [{
          capability: "edit_job_description",
          rationale: "y",
          changes: [{ field: "salary_min", value: 1 }],
        }],
      })
    ).toThrow();
  });

  it("carries two proposals from one turn", () => {
    // The shape that removes the two-turn dance: a message asking for a field
    // fix AND a rewrite comes back as two entries, which become two cards with
    // independent Apply buttons. Measured against the real model before it was
    // built — 3/3 runs returned both, populated.
    const schema = buildProposalSchema([
      "edit_job_details",
      "edit_job_description",
    ]);
    const parsed = schema.parse({
      reply: "Both done.",
      proposals: [
        {
          capability: "edit_job_details",
          rationale: "Corrects the salary.",
          changes: [{ field: "salary_min", value: 120000 }],
        },
        {
          capability: "edit_job_description",
          rationale: "Leads with the migration.",
          changes: [{ field: "job_description", value: "New text." }],
        },
      ],
    });

    expect(parsed.proposals).toHaveLength(2);
    expect(parsed.proposals?.map((p) => p.capability)).toEqual([
      "edit_job_details",
      "edit_job_description",
    ]);
  });

  it("folds a change list into coerced fields", () => {
    expect(
      fieldsFromChanges("edit_job_details", [
        { field: "salary_min", value: "55,000" },
        { field: "work_location", value: "remote" },
        { field: "cv_sent_through", value: "LinkedIn" },
      ]),
    ).toEqual({ salary_min: 55000, work_location: ["remote"] });
  });

  it("lets a repeated field's last entry win", () => {
    expect(
      fieldsFromChanges("edit_job_details", [
        { field: "salary_min", value: 100 },
        { field: "salary_min", value: 200 },
      ]),
    ).toEqual({ salary_min: 200 });
  });

  it("stays convertible to JSON Schema", () => {
    // The reason the wire types are plain. A transform anywhere in here makes
    // LangChain throw "Transforms cannot be represented in JSON Schema" and
    // every capable turn fails — which is exactly how this shipped the first
    // time. z.toJSONSchema is the same conversion the provider path does.
    for (const capability of Object.keys(CAPABILITIES) as Capability[]) {
      expect(() => z.toJSONSchema(buildProposalSchema([capability])))
        .not.toThrow();
    }
    expect(() =>
      z.toJSONSchema(
        buildProposalSchema(Object.keys(CAPABILITIES) as Capability[]),
      )
    ).not.toThrow();
  });

  it("treats absent, null or empty proposals as no proposal", () => {
    const schema = buildProposalSchema(["edit_job_details"]);
    expect(schema.parse({ reply: "Just answering." }).proposals)
      .toBeUndefined();
    expect(schema.parse({ reply: "x", proposals: null }).proposals).toBeNull();
    expect(schema.parse({ reply: "x", proposals: [] }).proposals).toEqual([]);
  });

  it("only admits the capabilities that are live this turn", () => {
    const schema = buildProposalSchema(["edit_job_description"]);
    expect(() =>
      schema.parse({
        reply: "x",
        proposals: [{
          capability: "edit_job_details",
          rationale: "y",
          changes: [],
        }],
      })
    ).toThrow();
  });
});

describe("pickCapabilityFields — coercion", () => {
  it("repairs the shapes the wire schema had to let through", () => {
    const picked = pickCapabilityFields("edit_job_details", {
      salary_min: "55,000",
      salary_max: 70000.4,
      work_location: "remote",
      job_types: ["contract"],
      company: "  Acme  ",
    });

    expect(picked).toEqual({
      salary_min: 55000,
      salary_max: 70000,
      work_location: ["remote"],
      job_types: ["contract"],
      company: "Acme",
    });
  });

  it("splits a comma-joined list into an array", () => {
    expect(
      pickCapabilityFields("edit_job_details", {
        experience_levels: "senior, lead",
      }),
    ).toEqual({ experience_levels: ["senior", "lead"] });
  });

  it("empties a blank string rather than writing one", () => {
    expect(
      pickCapabilityFields("edit_job_details", { company: "   " }),
    ).toEqual({ company: null });
  });

  it("keeps an explicit null as a clear instruction", () => {
    expect(
      pickCapabilityFields("edit_job_details", { salary_min: null }),
    ).toEqual({ salary_min: null });
  });

  it("drops a number it cannot make sense of", () => {
    expect(
      pickCapabilityFields("edit_job_details", { salary_min: "competitive" }),
    ).toEqual({ salary_min: null });
  });
});

describe("describeProposalChanges", () => {
  it("pairs each proposed field with what it replaces", () => {
    const changes = describeProposalChanges(
      "edit_job_details",
      { salary_min: 55000, work_location: ["hybrid"] },
      { salary_min: 50000, work_location: ["remote"], company: "Acme" },
    );

    expect(changes).toEqual([
      { field: "salary_min", label: "Salary min", from: "50000", to: "55000" },
      {
        field: "work_location",
        label: "Work arrangement",
        from: "remote",
        to: "hybrid",
      },
    ]);
  });

  it("drops fields the model restated without changing", () => {
    // Models echo unchanged values back despite being told not to; a "change"
    // that changes nothing is noise between the user and the real one.
    const changes = describeProposalChanges(
      "edit_job_details",
      { company: "Acme", salary_min: 55000 },
      { company: "Acme", salary_min: 50000 },
    );
    expect(changes.map((c) => c.field)).toEqual(["salary_min"]);
  });

  it("renders an unset current value as a dash", () => {
    const changes = describeProposalChanges(
      "edit_job_details",
      { company: "Acme" },
      { company: null },
    );
    expect(changes[0].from).toBe("—");
  });
});

describe("renderCapabilityPrompt", () => {
  it("is empty when nothing is proposable", () => {
    expect(renderCapabilityPrompt([])).toBe("");
  });

  it("spells the JSON contract out in prose, not just in the schema", async () => {
    // Passing a schema is not enough with either provider in use — this is the
    // text that makes structured output hold, so its absence is a real failure.
    jobRow = { id: 900, title: "Staff Engineer", company: "Acme" };
    const live = await resolveCapabilities(
      ["edit_job_details"],
      { type: "job", id: 900 },
      ACTOR,
    );

    const prompt = renderCapabilityPrompt(live);
    expect(prompt).toContain('"reply"');
    expect(prompt).toContain('"proposals"');
    expect(prompt).toContain("edit_job_details");
    // The three rules that stop a partial edit losing or wiping data. `\s+`
    // because the contract is hard-wrapped prose — asserting on the wrapping
    // would make this fail on a reflow that changes nothing.
    expect(prompt).toMatch(/keep\s+their\s+current\s+value/i);
    expect(prompt).toMatch(/clears\s+that\s+field/i);
    // The count-what-they-asked-for rule, which is what stopped the model
    // promising a salary change in its reply and then omitting it.
    expect(prompt).toMatch(/count\s+the\s+distinct\s+things/i);
    // And the same rule one level up: two kinds of change asked for in one
    // message must come back as two entries, not one plus an apology.
    expect(prompt).toMatch(/TWO\s+entries/);
    expect(prompt).toMatch(/separate\s+card/i);
  });

  it("shows the current values so the model proposes a diff", async () => {
    jobRow = {
      id: 900,
      title: "Staff Engineer",
      company: "Acme",
      salary_min: 100000,
    };
    const live = await resolveCapabilities(
      ["edit_job_details"],
      { type: "job", id: 900 },
      ACTOR,
    );

    expect(renderCapabilityPrompt(live)).toContain("100000");
  });
});
