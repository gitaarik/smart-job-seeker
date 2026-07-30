import { describe, expect, it } from "vitest";
import {
  parseStarMarkdown,
  serializeStarMarkdown,
  type StarFields,
} from "../star";

const full: StarFields = {
  situation: "The scraper queue jammed under load.",
  task: "I had to keep one hung run from blocking every other provider.",
  action: "Added a per-provider watchdog and an admin reconcile path.",
  result: "Throughput recovered; no full-queue stalls since.",
  reflection: "I'd add the watchdog from day one next time.",
};

describe("serializeStarMarkdown", () => {
  it("emits canonical headings in STAR order", () => {
    expect(serializeStarMarkdown(full)).toBe(
      `## Situation\n${full.situation}\n\n` +
        `## Task\n${full.task}\n\n` +
        `## Action\n${full.action}\n\n` +
        `## Result\n${full.result}\n\n` +
        `## Reflection\n${full.reflection}`,
    );
  });

  it("skips empty sections", () => {
    const md = serializeStarMarkdown({
      situation: "Only this one.",
      task: "",
      action: null,
      result: "  ",
      reflection: null,
    });
    expect(md).toBe("## Situation\nOnly this one.");
  });

  it("returns an empty string when everything is blank", () => {
    expect(serializeStarMarkdown({})).toBe("");
    expect(
      serializeStarMarkdown({ situation: "", task: null, action: "   " }),
    ).toBe("");
  });
});

describe("parseStarMarkdown", () => {
  it("splits canonical markdown back into columns", () => {
    expect(parseStarMarkdown(serializeStarMarkdown(full))).toEqual(full);
  });

  it("round-trips: parse ∘ serialize is idempotent", () => {
    const once = serializeStarMarkdown(full);
    const twice = serializeStarMarkdown(parseStarMarkdown(once));
    expect(twice).toBe(once);
  });

  it("leaves omitted sections null", () => {
    const md = "## Situation\nA\n\n## Action\nB";
    expect(parseStarMarkdown(md)).toEqual({
      situation: "A",
      task: null,
      action: "B",
      result: null,
      reflection: null,
    });
  });

  it("tolerates bold and colon heading styles", () => {
    const md = "**Situation**\nA\n\nTask:\nB\n\nACTION\nC";
    const parsed = parseStarMarkdown(md);
    expect(parsed.situation).toBe("A");
    expect(parsed.task).toBe("B");
    expect(parsed.action).toBe("C");
  });

  it("degrades to verbatim situation when no heading is present", () => {
    const md = "Just a blob of prose with no STAR structure at all.";
    expect(parseStarMarkdown(md)).toEqual({
      situation: md,
      task: null,
      action: null,
      result: null,
      reflection: null,
    });
  });

  it("keeps leading preamble before the first heading", () => {
    const md = "intro line\n\n## Task\nthe task";
    const parsed = parseStarMarkdown(md);
    expect(parsed.situation).toBe("intro line");
    expect(parsed.task).toBe("the task");
  });

  it("handles empty / null input", () => {
    const empty: StarFields = {
      situation: null,
      task: null,
      action: null,
      result: null,
      reflection: null,
    };
    expect(parseStarMarkdown(null)).toEqual(empty);
    expect(parseStarMarkdown("   ")).toEqual(empty);
  });
});
