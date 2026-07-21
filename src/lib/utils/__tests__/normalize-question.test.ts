import { describe, expect, it } from "vitest";
import { normalizeQuestion } from "../normalize-question";

describe("normalizeQuestion", () => {
  it("treats case, surrounding and internal whitespace, and trailing punctuation as the same", () => {
    const canonical = normalizeQuestion("Why us?");
    expect(normalizeQuestion("why us")).toBe(canonical);
    expect(normalizeQuestion("  WHY   US  ")).toBe(canonical);
    expect(normalizeQuestion("Why us!!")).toBe(canonical);
    expect(normalizeQuestion("why us:")).toBe(canonical);
  });

  it("keeps genuinely different questions distinct", () => {
    expect(normalizeQuestion("Why do you want to work here?"))
      .not.toBe(normalizeQuestion("What draws you to this role?"));
  });

  it("does not strip internal or non-trailing punctuation", () => {
    // Only trailing sentence punctuation is removed — mid-string stays.
    expect(normalizeQuestion("Tell us about a project. What went wrong?"))
      .toBe("tell us about a project. what went wrong");
  });

  it("normalizes an empty or whitespace-only string to empty", () => {
    expect(normalizeQuestion("")).toBe("");
    expect(normalizeQuestion("   ")).toBe("");
    expect(normalizeQuestion("???")).toBe("");
  });
});
