/**
 * Tests for AI Chat Utilities (pure functions)
 */

import { describe, expect, it } from "vitest";
import { instructionsBlock, interpolatePrompt, makeFullPrompt } from "../utils";

describe("interpolatePrompt", () => {
  it("replaces ${variable} syntax", () => {
    const result = interpolatePrompt("Hello ${name}!", { name: "Alice" });
    expect(result).toBe("Hello Alice!");
  });

  it("replaces {{variable}} syntax", () => {
    const result = interpolatePrompt("Hello {{name}}!", { name: "Alice" });
    expect(result).toBe("Hello Alice!");
  });

  it("replaces multiple occurrences", () => {
    const result = interpolatePrompt("${x} + ${x} = 2${x}", { x: "1" });
    expect(result).toBe("1 + 1 = 21");
  });

  it("replaces multiple different variables", () => {
    const result = interpolatePrompt("${first} ${last}", {
      first: "John",
      last: "Doe",
    });
    expect(result).toBe("John Doe");
  });

  it("handles mixed syntax", () => {
    const result = interpolatePrompt("${name} or {{name}}", { name: "Bob" });
    expect(result).toBe("Bob or Bob");
  });

  it("leaves unmatched placeholders unchanged", () => {
    const result = interpolatePrompt("${known} ${unknown}", { known: "yes" });
    expect(result).toBe("yes ${unknown}");
  });

  it("handles empty variables", () => {
    const result = interpolatePrompt("Hello ${name}!", { name: "" });
    expect(result).toBe("Hello !");
  });

  it("handles empty template", () => {
    expect(interpolatePrompt("", { x: "y" })).toBe("");
  });

  it("handles no variables", () => {
    expect(interpolatePrompt("plain text", {})).toBe("plain text");
  });

  it("handles multiline templates", () => {
    const template = "Line 1: ${a}\nLine 2: {{b}}";
    const result = interpolatePrompt(template, { a: "foo", b: "bar" });
    expect(result).toBe("Line 1: foo\nLine 2: bar");
  });
});

describe("makeFullPrompt", () => {
  it("combines system and user prompts", () => {
    const result = makeFullPrompt("Be helpful", "What is 2+2?");
    expect(result).toContain("SYSTEM PROMPT");
    expect(result).toContain("Be helpful");
    expect(result).toContain("USER PROMPT");
    expect(result).toContain("What is 2+2?");
  });

  it("places system prompt before user prompt", () => {
    const result = makeFullPrompt("system", "user");
    const sysIdx = result.indexOf("system");
    const userIdx = result.indexOf("user");
    expect(sysIdx).toBeLessThan(userIdx);
  });

  it("uses separator lines", () => {
    const result = makeFullPrompt("sys", "usr");
    expect(result).toContain("----------------");
  });

  // full_prompt is the debugging record of a request. The turns go to the
  // provider as separate messages, so this has to show where they sat.
  it("records replayed turns between the system and user prompts", () => {
    const result = makeFullPrompt("sys", "latest message", [
      { role: "user", content: "earlier ask" },
      { role: "assistant", content: "earlier reply" },
    ]);

    expect(result).toContain("CONVERSATION SO FAR");
    expect(result.indexOf("sys")).toBeLessThan(result.indexOf("earlier ask"));
    expect(result.indexOf("earlier ask")).toBeLessThan(
      result.indexOf("earlier reply"),
    );
    expect(result.indexOf("earlier reply")).toBeLessThan(
      result.indexOf("latest message"),
    );
  });

  it("omits the conversation section when there are no earlier turns", () => {
    expect(makeFullPrompt("sys", "usr")).not.toContain("CONVERSATION SO FAR");
  });
});

describe("instructionsBlock", () => {
  // The composer's brief is optional, and blank is the common case: the block
  // has to vanish entirely rather than leave an empty header the model would
  // read as a missing instruction.
  it("is empty for no brief", () => {
    expect(instructionsBlock(undefined)).toBe("");
    expect(instructionsBlock(null)).toBe("");
    expect(instructionsBlock("")).toBe("");
    expect(instructionsBlock("   \n  ")).toBe("");
  });

  it("carries the brief under a header when present", () => {
    const result = instructionsBlock("  keep it under 100 words  ");
    expect(result).toContain("What the applicant asked for");
    expect(result).toContain("keep it under 100 words");
    // Trimmed, so leading whitespace can't push it out of the header's scope.
    expect(result).not.toContain("  keep it");
  });

  it("tells the model the brief cannot override the output format", () => {
    // Several of these prompts have a structured-JSON contract. A brief like
    // "just give me bullet points" must not be read as licence to break it.
    expect(instructionsBlock("just give me bullets"))
      .toMatch(/does NOT override the output format/);
  });
});
