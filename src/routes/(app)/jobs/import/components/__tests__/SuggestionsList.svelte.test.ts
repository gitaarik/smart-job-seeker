import { describe, expect, test, vi } from "vitest";
import { render, screen } from "@testing-library/svelte";
import SuggestionsList, {
  type Suggestion,
} from "../SuggestionsList.svelte";

function makeSuggestion(overrides: Partial<Suggestion> = {}): Suggestion {
  return {
    _key: 0,
    platform_id: 16,
    platform: "linkedin",
    platform_name: "LinkedIn",
    platform_url: "https://www.linkedin.com/jobs/",
    keywords: "developer",
    note: "Default note",
    relevance: "high",
    filters: {},
    ...overrides,
  };
}

describe("SuggestionsList", () => {
  test("renders multiple suggestions that share the same platform_id", () => {
    // Regression: the {#each} was previously keyed by platform_id, which threw
    // each_key_duplicate when the LLM returned >1 suggestion for one platform.
    const suggestions: Suggestion[] = [
      makeSuggestion({
        _key: 0,
        note: "Senior full-stack",
        keywords: "react python",
      }),
      makeSuggestion({
        _key: 1,
        note: "Django expert",
        keywords: "django",
        relevance: "medium",
      }),
      makeSuggestion({
        _key: 2,
        note: "Node specialist",
        keywords: "node.js",
        relevance: "medium",
      }),
    ];

    render(SuggestionsList, {
      suggestions,
      onAccept: vi.fn(),
      onDismiss: vi.fn(),
      onClearAll: vi.fn(),
    });

    expect(screen.getByText("Senior full-stack")).toBeDefined();
    expect(screen.getByText("Django expert")).toBeDefined();
    expect(screen.getByText("Node specialist")).toBeDefined();
    expect(screen.getAllByRole("button", { name: /add this task/i }))
      .toHaveLength(3);
  });

  test("renders nothing when the list is empty", () => {
    const { container } = render(SuggestionsList, {
      suggestions: [],
      onAccept: vi.fn(),
      onDismiss: vi.fn(),
      onClearAll: vi.fn(),
    });
    expect(container.textContent?.trim()).toBe("");
  });
});
