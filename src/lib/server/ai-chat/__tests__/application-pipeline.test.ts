/**
 * The pipeline block exists to answer questions retrieval structurally cannot —
 * which, how many, rank these — so what matters is that the SET is complete and
 * honestly labelled, not that any one line is well phrased.
 *
 * Three properties carry that weight and each has a test below: the current
 * application is present and marked, a truncated set says so, and "nobody has
 * looked yet" never renders as "nobody was involved".
 */
import { describe, expect, it } from "vitest";
import {
  formatPipelineContext,
  type PipelineRow,
} from "../application-pipeline";

function row(over: Partial<PipelineRow> = {}): PipelineRow {
  return {
    id: 1,
    isCurrent: false,
    title: "Senior Backend Engineer",
    company: "Northwind",
    status: "interviewing",
    step: "Technical interview",
    action: "Scheduled",
    daysInStage: 4,
    appliedOn: "2026-07-20",
    salary: "EUR 70,000-90,000/year",
    salaryAnnual: 80000,
    workLocation: "hybrid",
    matchScore: 82,
    matchRecommendation: "strong",
    entryCount: 5,
    hasOffer: false,
    employerContact: true,
    ...over,
  };
}

describe("formatPipelineContext", () => {
  it("returns empty string when there is no pipeline", () => {
    expect(formatPipelineContext([])).toBe("");
  });

  // Without this the model holds the current application in prose and the rest
  // in a table, and has to bridge two formats to compare them.
  it("marks the application the user is looking at", () => {
    const out = formatPipelineContext([
      row({ id: 1, isCurrent: true, company: "Northwind" }),
      row({ id: 2, company: "Acme" }),
    ]);
    expect(out).toMatch(/\*\*THIS ONE\*\* — .*Northwind/);
    expect(out.split("Acme")[0]).toContain("THIS ONE");
  });

  it("renders every application given, not a selection", () => {
    const rows = Array.from(
      { length: 12 },
      (_, i) => row({ id: i, company: `Co${i}` }),
    );
    const out = formatPipelineContext(rows);
    for (const r of rows) expect(out).toContain(`Co${r.id}`);
  });

  // A comparison over a truncated set is not vague, it is wrong — so the model
  // has to be told before it ranks anything.
  it("says so when the set was capped", () => {
    const out = formatPipelineContext([row()], { omitted: 3 });
    expect(out).toContain("3 further application(s)");
    expect(out).toContain("partial");
  });

  it("says nothing about omissions when nothing was omitted", () => {
    expect(formatPipelineContext([row()])).not.toContain("further application");
  });

  it("surfaces an offer prominently, since it changes every other answer", () => {
    const out = formatPipelineContext([row({ hasOffer: true })]);
    expect(out).toContain("OFFER RECORDED");
  });

  // The empty-vs-never-looked distinction, one more time. An un-analysed
  // application reporting "no employer contact" would look stalled when it may
  // be the most active one in the pipeline.
  it("distinguishes no contact from nobody having looked", () => {
    const none = formatPipelineContext([row({ employerContact: false })]);
    expect(none).toContain("no employer contact recorded");

    const unknown = formatPipelineContext([row({ employerContact: null })]);
    expect(unknown).toContain("employer contact unknown");
    expect(unknown).not.toContain("no employer contact recorded");
  });

  it("says nothing at all when contact is established", () => {
    const out = formatPipelineContext([row({ employerContact: true })]);
    expect(out).not.toContain("employer contact");
  });

  it("shows the stated salary alongside the comparable one", () => {
    const out = formatPipelineContext([
      row({ salary: "USD 90,000-110,000/year", salaryAnnual: 92_000 }),
    ]);
    expect(out).toContain("USD 90,000-110,000/year");
    expect(out).toContain("92,000 EUR/yr");
  });

  // A missing FX rate must read as "cannot compare", never as zero.
  it("shows the stated salary alone when it cannot be converted", () => {
    const out = formatPipelineContext([
      row({ salary: "SGD 12,000/month", salaryAnnual: null }),
    ]);
    expect(out).toContain("SGD 12,000/month");
    expect(out).not.toContain("(~");
  });

  it("says so plainly when a job states no salary", () => {
    const out = formatPipelineContext([
      row({ salary: null, salaryAnnual: null }),
    ]);
    expect(out).toContain("no salary stated");
  });

  it("reports an unscored application as unscored rather than as zero", () => {
    const out = formatPipelineContext([
      row({ matchScore: null, matchRecommendation: null }),
    ]);
    expect(out).toContain("not scored");
    expect(out).not.toMatch(/match 0\b/);
  });

  it("carries how long the stage has been stuck", () => {
    expect(formatPipelineContext([row({ daysInStage: 19 })]))
      .toContain("19d in stage");
    expect(formatPipelineContext([row({ daysInStage: null })]))
      .toContain("age unknown");
  });

  // Always-on context makes an assistant volunteer summaries nobody asked for.
  it("tells the model this is background, not a thing to lead with", () => {
    const out = formatPipelineContext([row()]);
    expect(out).toContain("Do NOT open every");
    expect(out).toContain("do not bring up other applications");
  });

  // It can read the current application's full history but only a summary line
  // for the others — conflating the two is how it would invent detail.
  it("warns that other applications are summaries, not full histories", () => {
    const out = formatPipelineContext([row()]);
    expect(out).toContain("not of the others");
    expect(out).toContain("rather than");
  });

  it("forbids quoting a converted figure as the employer's", () => {
    const out = formatPipelineContext([row()]);
    expect(out).toContain(
      "never present a conversion as what the employer offered",
    );
  });

  it("survives an application with no job attached", () => {
    const out = formatPipelineContext([
      row({ id: 42, title: null, company: null }),
    ]);
    expect(out).toContain("application #42");
  });
});
