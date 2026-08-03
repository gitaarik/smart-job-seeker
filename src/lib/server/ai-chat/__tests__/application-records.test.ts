/**
 * Budget behaviour for the interview-records prompt block.
 *
 * The caps are the whole reason this module exists instead of interpolating
 * the rows directly: a pasted two-hour transcript can be larger than every
 * other part of the prompt combined. What matters is not just that the block
 * stays bounded, but WHAT survives the trimming — the most recent and most
 * useful records — and that the model is told when it is seeing a partial
 * picture.
 */
import { describe, expect, it } from "vitest";
import {
  formatRecordsContext,
  type RecordForContext,
  TRIM_ORDER,
  truncateKeepingEnds,
} from "../application-records";
import { recordTypeValues } from "$lib/application-records";

function record(over: Partial<RecordForContext> = {}): RecordForContext {
  return {
    record_type: "interview_recap",
    title: "A round",
    content: "Something happened.",
    step: null,
    event_date: null,
    ...over,
  };
}

const filler = (n: number, char = "x") => char.repeat(n);

describe("TRIM_ORDER", () => {
  // trimRank() returns 0 for anything it doesn't find, and 0 means "sacrifice
  // this first". So a type added to the vocabulary but forgotten here does not
  // fail loudly — it quietly becomes the cheapest thing in the budget. That is
  // how an `offer` could end up dropped before a raw transcript.
  it("ranks every type the vocabulary offers", () => {
    expect([...TRIM_ORDER].sort()).toEqual([...recordTypeValues].sort());
  });

  it("puts offers and contracts last, so they are sacrificed last", () => {
    expect(TRIM_ORDER.slice(-2)).toEqual(["offer", "contract"]);
  });
});

describe("truncateKeepingEnds", () => {
  it("leaves short text alone", () => {
    expect(truncateKeepingEnds("short", 100)).toBe("short");
  });

  it("keeps both ends, not just the head", () => {
    // The close of an interview holds the next steps and parting feedback.
    const text = `OPENING${filler(5000)}CLOSING`;
    const out = truncateKeepingEnds(text, 500);

    expect(out).toContain("OPENING");
    expect(out).toContain("CLOSING");
    expect(out.length).toBeLessThanOrEqual(500);
  });

  it("marks the omission so the gap is visible to the model", () => {
    const out = truncateKeepingEnds(filler(5000), 500);
    expect(out).toContain("[…middle omitted…]");
  });
});

describe("formatRecordsContext", () => {
  it("returns empty string when there is nothing recorded", () => {
    expect(formatRecordsContext([])).toBe("");
  });

  it("returns empty string when every record is contentless", () => {
    // A title with no body would otherwise emit a heading-only block that
    // reads to the model as "an interview happened and went unrecorded".
    const out = formatRecordsContext([
      record({ content: null }),
      record({ content: "   " }),
    ]);
    expect(out).toBe("");
  });

  it("renders type, title, stage and date so rounds are distinguishable", () => {
    const out = formatRecordsContext([
      record({
        record_type: "feedback",
        title: "What the recruiter said",
        step: "Screening call",
        event_date: "2026-07-20",
        content: "Budget is tight.",
      }),
    ]);

    expect(out).toContain("Feedback: What the recruiter said");
    expect(out).toContain("Stage: Screening call");
    expect(out).toContain("Date: 2026-07-20");
    expect(out).toContain("Budget is tight.");
  });

  it("preserves the order it was given, so rounds read chronologically", () => {
    const out = formatRecordsContext([
      record({ title: "First round", content: "one" }),
      record({ title: "Second round", content: "two" }),
      record({ title: "Third round", content: "three" }),
    ]);

    expect(out.indexOf("First round")).toBeLessThan(
      out.indexOf("Second round"),
    );
    expect(out.indexOf("Second round")).toBeLessThan(
      out.indexOf("Third round"),
    );
  });

  it("gives compact mode a tighter budget than full mode", () => {
    const records = Array.from(
      { length: 6 },
      (_, i) => record({ title: `Round ${i}`, content: filler(3000) }),
    );

    const full = formatRecordsContext(records, "full");
    const compact = formatRecordsContext(records, "compact");

    expect(compact.length).toBeLessThan(full.length);
  });

  it("keeps compact output within its total budget", () => {
    const records = Array.from(
      { length: 30 },
      (_, i) => record({ title: `Round ${i}`, content: filler(9000) }),
    );

    const out = formatRecordsContext(records, "compact");

    // 12k total + the guidance/omission preamble.
    expect(out.length).toBeLessThan(14000);
  });

  it("keeps full output within its total budget", () => {
    const records = Array.from(
      { length: 30 },
      (_, i) => record({ title: `Round ${i}`, content: filler(9000) }),
    );

    const out = formatRecordsContext(records, "full");

    expect(out.length).toBeLessThan(42000);
  });

  it("truncates rather than drops while the total still fits", () => {
    // Per-record capping is the first line of defence. A few oversized
    // records all fit once trimmed, so none should be sacrificed.
    const records = [
      record({
        record_type: "transcript",
        title: "Verbatim notes",
        content: filler(9000),
      }),
      record({
        record_type: "feedback",
        title: "Interviewer feedback",
        content: filler(9000),
      }),
      record({
        record_type: "interview_recap",
        title: "My recap",
        content: filler(9000),
      }),
    ];

    const out = formatRecordsContext(records, "compact");

    expect(out).toContain("Verbatim notes");
    expect(out).toContain("Interviewer feedback");
    expect(out).toContain("My recap");
    expect(out).not.toContain("omitted to fit");
  });

  it("sacrifices transcripts before recaps once the total overflows", () => {
    // Lowest signal-per-token goes first: a writer needs the gist, and a raw
    // transcript is the most expensive way to convey it.
    const records = [
      ...Array.from({ length: 8 }, (_, i) =>
        record({
          record_type: "transcript",
          title: `Transcript ${i}`,
          content: filler(9000),
        })),
      ...Array.from({ length: 8 }, (_, i) =>
        record({
          record_type: "interview_recap",
          title: `Recap ${i}`,
          content: filler(9000),
        })),
    ];

    const out = formatRecordsContext(records, "compact");

    expect(out).not.toMatch(/Transcript \d/);
    expect(out).toMatch(/Recap \d/);
  });

  it("drops the oldest first among equally-valuable records", () => {
    const records = Array.from(
      { length: 20 },
      (_, i) => record({ title: `Round ${i}`, content: filler(2000) }),
    );

    const out = formatRecordsContext(records, "compact");

    // The newest survive; the oldest are the ones sacrificed.
    expect(out).toContain("Round 19");
    expect(out).not.toContain("Round 0");
  });

  it("tells the model when the picture it has is partial", () => {
    const records = Array.from(
      { length: 30 },
      (_, i) => record({ title: `Round ${i}`, content: filler(9000) }),
    );

    const out = formatRecordsContext(records, "compact");

    // Without this the model reads a trimmed set as the complete history.
    expect(out).toMatch(/record\(s\) exist but were omitted/);
    expect(out).toContain("partial rather than complete");
  });

  it("says nothing about omissions when everything fits", () => {
    const out = formatRecordsContext([record({ content: "short" })], "compact");
    expect(out).not.toContain("omitted to fit");
  });

  it("keeps one record rather than none when a single one blows the budget", () => {
    // A truncated record still beats handing the writer no context at all.
    const out = formatRecordsContext(
      [record({ title: "Marathon interview", content: filler(200000) })],
      "compact",
    );

    expect(out).toContain("Marathon interview");
    expect(out.length).toBeLessThan(14000);
  });

  it("warns writing prompts not to invent a shared history", () => {
    const out = formatRecordsContext([record()], "compact");
    expect(out).toContain("Never imply a conversation");
  });

  it("tells interview-prep prompts to build on covered ground instead", () => {
    const out = formatRecordsContext([record()], "full");
    expect(out).toContain("do not re-prepare ground already covered");
    expect(out).not.toContain("Never imply a conversation");
  });

  // The records used to read as optional colour ("use them ONLY where they
  // genuinely help"), and a real generation duly skimmed them: it kept the
  // employer framing the records had explicitly corrected. Outward-facing text
  // still must not invent a shared history, so the guard is now drawn between
  // what was learned and the fact that it was learned in a conversation —
  // which permits acting on the content without claiming the meeting.
  it("tells writing prompts the records outrank the job posting", () => {
    const out = formatRecordsContext([record()], "compact");
    expect(out).toContain("the records win");
    expect(out).toContain("the corrected version is the one to use");
  });

  it("still forbids referencing the interaction in writing prompts", () => {
    const out = formatRecordsContext([record()], "compact");
    expect(out).toContain("Never imply a conversation");
    expect(out).toContain(
      "Use what was learned, not the fact that it was learned",
    );
  });

  it("tells interview-prep prompts to act on records, not nod at them", () => {
    const out = formatRecordsContext([record()], "full");
    expect(out).toContain("do not merely acknowledge them");
    expect(out).toContain("surface them explicitly");
  });

  // The SURF records were Dutch and the sheet English; the points that went
  // missing were the ones written in the other language.
  it("tells both modes to translate rather than drop", () => {
    for (const mode of ["compact", "full"] as const) {
      const out = formatRecordsContext([record()], mode);
      expect(out, mode).toContain("different language");
      expect(out, mode).toContain("Translate what you use");
    }
  });

  it("survives a record with no title", () => {
    const out = formatRecordsContext([record({ title: null })]);
    expect(out).toContain("Untitled");
  });
});
