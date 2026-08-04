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
  describeOffer,
  fitPipelineToBudget,
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
    summary: null,
    offer: null,
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
    const out = formatPipelineContext([row({ isCurrent: true })]);
    expect(out).toContain("Do NOT open every");
    expect(out).toContain("do not bring up other applications");
  });

  // It can read the current application's full history but only a summary line
  // for the others — conflating the two is how it would invent detail.
  it("warns that other applications are summaries, not full histories", () => {
    const out = formatPipelineContext([row({ isCurrent: true })]);
    expect(out).toContain("not of the others");
    expect(out).toContain("rather than");
  });

  /**
   * The same rows mean different things depending on where the user is, and the
   * framing is chosen from whether a row is marked rather than from a caller's
   * flag — so a page that forgets to say which mode it wants cannot get one
   * that contradicts the rows underneath it.
   */
  describe("without a current application (list pages)", () => {
    it("does not promise a THIS ONE marker that no row carries", () => {
      const out = formatPipelineContext([row(), row({ id: 2 })]);
      expect(out).not.toContain("THIS ONE");
    });

    it("says plainly that none of them is the current one", () => {
      const out = formatPipelineContext([row()]);
      expect(out).toContain("none of these is the current one");
    });

    // Page fact vs block fact. "The user is not looking at any one
    // application" belongs to page_scope, which states it once for every block;
    // this one only reports what is true of ITS rows. The two used to say it
    // both, from different evidence, which is how a rule drifts from itself.
    it("leaves where-the-user-is to the page_scope block", () => {
      const out = formatPipelineContext([row()]);

      expect(out).not.toContain("do not single one");
      expect(out).not.toContain("looking at a LIST");
      // What it still owns: no marker is present, so do not go looking. Said
      // without naming the marker — see the test above, which is what naming
      // it would break.
      expect(out).toContain("No row below is marked");
    });

    // The detail page's restraint, applied here, would make it decline the one
    // thing the page exists for.
    it("drops the do-not-bring-this-up guard, which would be backwards here", () => {
      const out = formatPipelineContext([row()]);
      expect(out).not.toContain("Do NOT open every");
      expect(out).not.toContain("do not bring up other applications");
      expect(out).toContain("normal rather than a");
    });

    it("still refuses to invent detail it cannot see", () => {
      const out = formatPipelineContext([row()]);
      expect(out).toContain("rather than inventing it");
    });

    // It was written twice, once per framing, in near-identical words. One
    // copy, both modes — a guard that has to be kept in sync in two places is
    // a guard that stops being in two places.
    it("gives both modes the same summary-not-the-whole-story guard", () => {
      const guard = "Each line is a summary, not the whole story";

      expect(formatPipelineContext([row()])).toContain(guard);
      expect(formatPipelineContext([row({ isCurrent: true })])).toContain(
        guard,
      );
    });

    it("keeps the guidance that does not depend on where the user is", () => {
      const out = formatPipelineContext([row()]);
      expect(out).toContain("RESPOND BY date is a deadline");
      expect(out).toContain(
        "never present a conversion as what the employer offered",
      );
    });

    it("switches back the moment a row is current", () => {
      const out = formatPipelineContext([
        row({ isCurrent: true }),
        row({ id: 2 }),
      ]);
      expect(out).toContain("THIS ONE");
      expect(out).not.toContain("none of these is the current one");
    });
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
    expect(out).toContain("(application 42)");
  });

  // The activity index names the same applications, and the model has to be
  // able to match the two up. It could not: one application appeared as
  // "Senior Backend Engineer" here and "Senior Backend Engineer (application
  // 16)" there, and the assistant duly reported a transcript belonging to
  // "another Senior Backend Engineer position" — a second application invented
  // out of two spellings of one. So the id is stated even when there is a
  // perfectly good name to use instead.
  it("states the id even when the application has a name", () => {
    const out = formatPipelineContext([
      row({ id: 16, title: "Senior Backend Engineer", company: "Acme" }),
    ]);

    expect(out).toContain("Senior Backend Engineer at Acme (application 16)");
  });

  // The digest is what turns a counting line into a saying-something line.
  it("carries the standing summary when there is one", () => {
    const out = formatPipelineContext([
      row({ summary: "Waiting on their feedback since the technical round." }),
    ]);
    expect(out).toContain("Waiting on their feedback");
  });

  it("flattens a multi-line summary so one application stays one block", () => {
    const out = formatPipelineContext([
      row({ summary: "First line.\n\nSecond line." }),
    ]);
    expect(out).toContain("First line. Second line.");
  });
});

/**
 * The ladder's whole point is the ORDER in which things are given up, so these
 * assert the ordering property rather than any particular char count — an
 * arithmetic assertion here would pass for the wrong reason the moment the row
 * layout changed by a few characters.
 */
describe("fitPipelineToBudget", () => {
  const LINE = "Waiting on their feedback since the technical round. ";
  const SUMMARY = LINE.repeat(8);

  /** A pipeline sorted the way the loader hands it over: current first, then
   * most-recently-active, so later rows are staler. */
  function pipeline(n: number, over: Partial<PipelineRow> = {}): PipelineRow[] {
    return Array.from({ length: n }, (_, i) =>
      row({
        id: i,
        company: `Co${i}`,
        isCurrent: i === 0,
        daysInStage: i * 5,
        summary: SUMMARY,
        ...over,
      }));
  }

  const chars = (rows: PipelineRow[], o = {}) =>
    formatPipelineContext(rows, o).length;

  it("changes nothing when the whole pipeline fits", () => {
    const rows = pipeline(4);
    const out = fitPipelineToBudget(rows, 100_000);
    expect(out.rows).toEqual(rows);
    expect(out.omitted).toBe(0);
    expect(out.shed).toBe(0);
  });

  it("actually gets under the budget", () => {
    const rows = pipeline(20);
    const budget = 6000;
    const out = fitPipelineToBudget(rows, budget);
    expect(chars(rows)).toBeGreaterThan(budget);
    expect(chars(out.rows, { omitted: out.omitted, shed: out.shed }))
      .toBeLessThanOrEqual(budget);
  });

  // The invariant the whole source rests on: a comparison over a partial set is
  // wrong, not thin. Depth is negotiable, presence is not.
  it("gives up every summary before it gives up a single application", () => {
    const rows = pipeline(20);
    // Tight enough to shed all 20 summaries, loose enough for 20 bare rows.
    const bare = chars(rows.map((r) => ({ ...r, summary: null })), {
      shed: 20,
    });
    const out = fitPipelineToBudget(rows, bare);
    expect(out.rows).toHaveLength(20);
    expect(out.omitted).toBe(0);
    expect(out.rows.every((r) => r.summary === null)).toBe(true);
  });

  // Its full history is in application_activity alongside, so this is the most
  // redundant text in the whole prompt.
  it("sheds the current application's summary first", () => {
    const rows = pipeline(6);
    const out = fitPipelineToBudget(rows, chars(rows) - 100);
    expect(out.rows[0].isCurrent).toBe(true);
    expect(out.rows[0].summary).toBeNull();
    expect(out.rows.slice(1).every((r) => r.summary)).toBe(true);
  });

  it("then sheds the stalest, keeping the ones still in motion", () => {
    const rows = pipeline(6);
    // Room for the frame and roughly half the summaries.
    const out = fitPipelineToBudget(rows, chars(rows) - 3 * SUMMARY.length);
    const kept = out.rows.filter((r) => r.summary).map((r) => r.daysInStage!);
    const gone = out.rows.filter((r) => !r.summary).map((r) => r.daysInStage!);
    expect(kept.length).toBeGreaterThan(0);
    expect(gone.length).toBeGreaterThan(0);
    // Every surviving summary is on a fresher application than every shed one,
    // except the current row, which is shed first by design.
    expect(Math.max(...kept)).toBeLessThan(
      Math.max(...gone.filter((d) => d !== rows[0].daysInStage)),
    );
  });

  // An offer means a decision is pending, however long the row has sat.
  it("holds back a stalled application that has an offer", () => {
    const rows = pipeline(6);
    rows[5].offer = {
      base: 92000,
      bonus: null,
      equity: null,
      currency: "EUR",
      period: "year",
      start_date: null,
      respond_by: "2026-08-15",
      notes: null,
    };
    const out = fitPipelineToBudget(rows, chars(rows) - 3 * SUMMARY.length);
    // The stalest row in the set, and the last to lose its summary anyway.
    expect(out.rows[5].summary).not.toBeNull();
  });

  it("keeps the offer terms even once that summary does go", () => {
    const rows = pipeline(6);
    const offer = {
      base: 92000,
      bonus: null,
      equity: null,
      currency: "EUR",
      period: "year",
      start_date: null,
      respond_by: "2026-08-15",
      notes: null,
    };
    rows[5].offer = offer;
    // Tight enough that even the protected row loses its summary, loose enough
    // that no row is dropped — the rung where offer terms could go missing.
    const bare = chars(rows.map((r) => ({ ...r, summary: null })), { shed: 6 });
    const out = fitPipelineToBudget(rows, bare);
    expect(out.rows).toHaveLength(6);
    expect(out.rows[5].summary).toBeNull();
    expect(out.rows[5].offer).toEqual(offer);
  });

  it("drops rows only once no summary is left to give", () => {
    const rows = pipeline(20);
    const out = fitPipelineToBudget(rows, 3000);
    expect(out.omitted).toBeGreaterThan(0);
    expect(out.rows.every((r) => r.summary === null)).toBe(true);
    // Dropped from the stale end, never the application in front of the user.
    expect(out.rows[0].isCurrent).toBe(true);
  });

  it("never drops the last row, however small the budget", () => {
    const out = fitPipelineToBudget(pipeline(20), 10);
    expect(out.rows).toHaveLength(1);
    expect(out.rows[0].isCurrent).toBe(true);
    expect(out.omitted).toBe(19);
  });

  // A shed summary and a never-generated one look identical on the row, and
  // read as the latter a busy application looks dormant.
  it("reports shedding so the model does not read it as an empty history", () => {
    const rows = pipeline(6);
    const out = fitPipelineToBudget(rows, chars(rows) - 100);
    expect(out.shed).toBeGreaterThan(0);
    const text = formatPipelineContext(out.rows, { shed: out.shed });
    expect(text).toContain("NOT an");
    expect(text).toContain("empty history");
  });

  it("does not count summaries on rows it dropped anyway", () => {
    const out = fitPipelineToBudget(pipeline(20), 10);
    // One row survives and it lost its summary — the other 19 are omitted, not
    // shed, and saying "19 shown without a summary" would be a lie.
    expect(out.shed).toBe(1);
  });

  it("says nothing about shedding when nothing was shed", () => {
    const out = fitPipelineToBudget(pipeline(3), 100_000);
    expect(formatPipelineContext(out.rows, { shed: out.shed }))
      .not.toContain("without a summary");
  });

  it("survives a pipeline with no summaries to shed", () => {
    const rows = pipeline(20, { summary: null });
    const out = fitPipelineToBudget(rows, 2000);
    expect(out.shed).toBe(0);
    expect(out.omitted).toBeGreaterThan(0);
    expect(chars(out.rows, { omitted: out.omitted })).toBeLessThanOrEqual(2000);
  });

  // The loader sorts current-first, so dropping from the end never reaches it —
  // but this function is exported and priced independently, and a caller that
  // sorted differently would not just lose a row: the block would switch to
  // "the applicant is looking at a list of these", which on an application page
  // is a statement about the user that is false.
  it("keeps the current row even when it sorted to the stale end", () => {
    const rows = pipeline(20).map((r, i) => ({
      ...r,
      isCurrent: i === 19,
      daysInStage: 100 - i,
    }));
    const out = fitPipelineToBudget(rows, 2500);
    expect(out.rows.some((r) => r.isCurrent)).toBe(true);
    expect(formatPipelineContext(out.rows, { omitted: out.omitted }))
      .toContain("THIS ONE");
  });

  it("survives an empty pipeline", () => {
    expect(fitPipelineToBudget([], 100)).toEqual({
      rows: [],
      omitted: 0,
      shed: 0,
    });
  });
});

describe("describeOffer", () => {
  const terms = {
    base: 92000,
    bonus: null,
    equity: null,
    currency: "EUR",
    period: "year",
    start_date: null,
    respond_by: null,
    notes: null,
  };

  it("states the terms as offered", () => {
    expect(describeOffer(terms)).toBe("EUR 92,000/year");
  });

  // The only field here with a deadline attached, and missing it costs the
  // applicant the offer — so it is shouted, not tucked in.
  it("shouts a response deadline", () => {
    const out = describeOffer({ ...terms, respond_by: "2026-08-15" });
    expect(out).toContain("RESPOND BY 2026-08-15");
  });

  it("survives an offer whose terms were never stated", () => {
    expect(
      describeOffer({
        base: null,
        bonus: null,
        equity: null,
        currency: null,
        period: null,
        start_date: null,
        respond_by: null,
        notes: null,
      }),
    ).toBe("terms not stated");
  });

  it("keeps bonus, equity and free-text notes", () => {
    const out = describeOffer({
      ...terms,
      bonus: "10% annual",
      equity: "0.15% over 4 years",
      notes: "27 days leave",
    });
    expect(out).toContain("bonus 10% annual");
    expect(out).toContain("equity 0.15% over 4 years");
    expect(out).toContain("27 days leave");
  });
});
