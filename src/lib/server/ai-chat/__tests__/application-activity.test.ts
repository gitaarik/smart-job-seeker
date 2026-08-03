/**
 * Budget behaviour for the application-activity prompt block.
 *
 * The caps are the whole reason this module exists instead of interpolating the
 * rows directly: a pasted two-hour transcript, or a 40-page contract extracted
 * from a PDF, can be larger than every other part of the prompt combined. What
 * matters is not just that the block stays bounded, but WHAT survives the
 * trimming — the most recent and most useful entries — and that the model is
 * told when it is seeing a partial picture.
 */
import { describe, expect, it } from "vitest";
import {
  type ActivityEntry,
  formatActivityContext,
  RECORD_WEIGHTS,
  truncateKeepingEnds,
} from "../application-activity";
import { recordTypeValues } from "$lib/application-records";

function record(over: Partial<ActivityEntry> = {}): ActivityEntry {
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

describe("RECORD_WEIGHTS", () => {
  // weightFor() falls back to rank 0 for anything it doesn't find, and rank 0
  // means "sacrifice this first". So a type added to the vocabulary but
  // forgotten here does not fail loudly — it quietly becomes the cheapest thing
  // in the budget. That is how an `offer` could end up dropped before a raw
  // transcript, which is the exact reverse of what anyone wants.
  it("weights every type the vocabulary offers", () => {
    expect(Object.keys(RECORD_WEIGHTS).sort()).toEqual(
      [...recordTypeValues].sort(),
    );
  });

  it("makes offers and contracts the last things sacrificed", () => {
    const dearest = Object.entries(RECORD_WEIGHTS)
      .sort((a, b) => b[1].rank - a[1].rank)
      .slice(0, 2)
      .map(([type]) => type);
    expect(dearest.sort()).toEqual(["contract", "offer"]);
  });

  it("gives every type a distinct rank, so trimming is deterministic", () => {
    const ranks = Object.values(RECORD_WEIGHTS).map((w) => w.rank);
    expect(new Set(ranks).size).toBe(ranks.length);
  });

  // One table, not two. These were separate before — TRIM_ORDER said what to
  // sacrifice, BUDGETS.perRecord said how much to keep — and two tables
  // encoding the same judgement drift the first time a type lands in one only.
  it("gives the dearest types the most room, not just the best rank", () => {
    expect(RECORD_WEIGHTS.offer.ceiling)
      .toBeGreaterThan(RECORD_WEIGHTS.transcript.ceiling);
    expect(RECORD_WEIGHTS.contract.ceiling)
      .toBeGreaterThan(RECORD_WEIGHTS.note.ceiling);
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

describe("formatActivityContext", () => {
  it("returns empty string when there is nothing recorded", () => {
    expect(formatActivityContext([])).toBe("");
  });

  it("returns empty string when every record is contentless", () => {
    // A title with no body would otherwise emit a heading-only block that
    // reads to the model as "an interview happened and went unrecorded".
    const out = formatActivityContext([
      record({ content: null }),
      record({ content: "   " }),
    ]);
    expect(out).toBe("");
  });

  it("renders type, title, stage and date so rounds are distinguishable", () => {
    const out = formatActivityContext([
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
    const out = formatActivityContext([
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

    const full = formatActivityContext(records, "full");
    const compact = formatActivityContext(records, "compact");

    expect(compact.length).toBeLessThan(full.length);
  });

  it("keeps compact output within its total budget", () => {
    const records = Array.from(
      { length: 30 },
      (_, i) => record({ title: `Round ${i}`, content: filler(9000) }),
    );

    const out = formatActivityContext(records, "compact");

    // 15k total + the guidance/omission preamble.
    expect(out.length).toBeLessThan(17000);
  });

  it("keeps full output within its total budget", () => {
    const records = Array.from(
      { length: 30 },
      (_, i) => record({ title: `Round ${i}`, content: filler(9000) }),
    );

    const out = formatActivityContext(records, "full");

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

    const out = formatActivityContext(records, "compact");

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

    const out = formatActivityContext(records, "compact");

    // Asserted as an ordering invariant rather than "no transcript survives".
    // The old form happened to hold because the compact total (12k) landed just
    // below 8 recaps; the merged budget (15k) leaves room for one transcript
    // too, which does not weaken the rule being tested. Pinning the invariant
    // instead of the arithmetic means a future budget tweak fails only if it
    // actually inverts the priority.
    const kept = (re: RegExp) => (out.match(re) || []).length;
    expect(kept(/Recap \d/g)).toBe(8);
    expect(kept(/Transcript \d/g)).toBeLessThan(kept(/Recap \d/g));
  });

  it("drops the oldest first among equally-valuable records", () => {
    const records = Array.from(
      { length: 20 },
      (_, i) => record({ title: `Round ${i}`, content: filler(2000) }),
    );

    const out = formatActivityContext(records, "compact");

    // The newest survive; the oldest are the ones sacrificed.
    expect(out).toContain("Round 19");
    expect(out).not.toContain("Round 0");
  });

  it("tells the model when the picture it has is partial", () => {
    const records = Array.from(
      { length: 30 },
      (_, i) => record({ title: `Round ${i}`, content: filler(9000) }),
    );

    const out = formatActivityContext(records, "compact");

    // Without this the model reads a trimmed set as the complete history.
    expect(out).toMatch(/entry\(s\) exist but were omitted/);
    expect(out).toContain("partial rather than complete");
  });

  it("says nothing about omissions when everything fits", () => {
    const out = formatActivityContext(
      [record({ content: "short" })],
      "compact",
    );
    expect(out).not.toContain("omitted to fit");
  });

  it("keeps one record rather than none when a single one blows the budget", () => {
    // A truncated record still beats handing the writer no context at all.
    const out = formatActivityContext(
      [record({ title: "Marathon interview", content: filler(200000) })],
      "compact",
    );

    expect(out).toContain("Marathon interview");
    expect(out.length).toBeLessThan(17000);
  });

  it("warns writing prompts not to invent a shared history", () => {
    const out = formatActivityContext([record()], "compact");
    expect(out).toContain("Never imply a conversation");
  });

  it("tells interview-prep prompts to build on covered ground instead", () => {
    const out = formatActivityContext([record()], "full");
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
    const out = formatActivityContext([record()], "compact");
    expect(out).toContain("the record wins");
    expect(out).toContain("the corrected version is the one to use");
  });

  it("still forbids referencing the interaction in writing prompts", () => {
    const out = formatActivityContext([record()], "compact");
    expect(out).toContain("Never imply a conversation");
    expect(out).toContain(
      "Use what was learned, not the fact that it was learned",
    );
  });

  it("tells interview-prep prompts to act on records, not nod at them", () => {
    const out = formatActivityContext([record()], "full");
    expect(out).toContain("do not merely acknowledge it");
    expect(out).toContain("surface them explicitly");
  });

  // The SURF records were Dutch and the sheet English; the points that went
  // missing were the ones written in the other language.
  it("tells both modes to translate rather than drop", () => {
    for (const mode of ["compact", "full"] as const) {
      const out = formatActivityContext([record()], mode);
      expect(out, mode).toContain("different language");
      expect(out, mode).toContain("Translate what you use");
    }
  });

  it("survives a record with no title", () => {
    const out = formatActivityContext([record({ title: null })]);
    expect(out).toContain("Untitled");
  });
});

// What the merge had to preserve from the two blocks it replaced. Both risks
// are now reachable from any entry — the stream mixes typed recaps with text
// extracted from attached files — so the compact guard has to carry both
// fabrication guards at once, not one each.
describe("formatActivityContext — the merged guidance", () => {
  it("still forbids implying a document was sent, signed or read", () => {
    const out = formatActivityContext([record()], "compact");
    expect(out).toContain("has signed");
  });

  it("still forbids implying a conversation that never happened", () => {
    const out = formatActivityContext([record()], "compact");
    expect(out).toContain("Never imply a conversation");
  });

  it("tells prep prompts to use the specifics documents set", () => {
    const out = formatActivityContext([record()], "full");
    expect(out).toContain("sets a task");
  });

  // Extracted text is verbatim from a third party; a typed recap is the
  // applicant's own paraphrase. Worth telling the model which it is holding,
  // because the phrasing of the first is evidence and the second is not.
  it("marks entries whose text came out of a file", () => {
    const out = formatActivityContext([
      record({ title: "offer.pdf", from_file: true }),
    ]);
    expect(out).toContain("extracted from an attached file");
  });

  it("says nothing about extraction for typed entries", () => {
    const out = formatActivityContext([record()]);
    expect(out).not.toContain("extracted from an attached file");
  });
});
