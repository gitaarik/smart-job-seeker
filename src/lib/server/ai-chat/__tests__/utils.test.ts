/**
 * Tests for AI Chat Utilities (pure functions)
 */

import { describe, expect, it } from "vitest";
import { interpolatePrompt, makeFullPrompt } from "../utils";

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
});
