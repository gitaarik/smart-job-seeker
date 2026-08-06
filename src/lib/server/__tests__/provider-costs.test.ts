/**
 * Cost estimation for LLM calls.
 *
 * Deliberately NOT in `billing/__tests__/`. Cloud bind-mounts its own
 * `src/lib/server/billing/` over the OSS one (docker-compose.yml), so a test
 * living in that directory is replaced along with it and would only run if both
 * copies carried it. From here it imports through `$lib`, which means it tests
 * whichever copy is actually mounted — the one that prices real generations.
 */
import { describe, expect, it, vi } from "vitest";
import {
  estimateProviderCostUsd,
  hasProviderPricing,
} from "$lib/server/billing/provider-costs";

const PRO = ["gemini", "gemini-2.5-pro"] as const;

describe("estimateProviderCostUsd", () => {
  it("prices the writing model — the regression this all started from", () => {
    // gemini-2.5-pro was absent from the table, so every user-facing
    // generation recorded providerCostUsd: null. 178 charges, none priced.
    expect(hasProviderPricing(...PRO)).toBe(true);

    // 25k in / 400 out is about the measured average assistant turn.
    // 25000 × $1.25/M + 400 × $10/M = $0.03125 + $0.004
    expect(estimateProviderCostUsd(...PRO, 25_000, 400)).toBeCloseTo(0.03525, 6);
  });

  it("discounts input the provider served from cache", () => {
    // 14k cached of 25k: 11000 × $1.25/M + 14000 × $0.125/M + 400 × $10/M
    expect(estimateProviderCostUsd(...PRO, 25_000, 400, 14_000))
      .toBeCloseTo(0.0195, 6);
  });

  it("treats cached tokens as a subset of input, not an addition", () => {
    // The whole prompt cached must cost less than none of it cached, never
    // more — getting this backwards would inflate every cached call.
    const none = estimateProviderCostUsd(...PRO, 25_000, 400, 0)!;
    const all = estimateProviderCostUsd(...PRO, 25_000, 400, 25_000)!;
    expect(all).toBeLessThan(none);
    expect(all).toBeCloseTo(25_000 * 0.125e-6 + 400 * 10e-6, 6);
  });

  it("clamps a cached count larger than the input count", () => {
    // A provider over-reporting would otherwise give a negative fresh-token
    // count and an under-estimate — the one direction this must not fail in.
    const clamped = estimateProviderCostUsd(...PRO, 1_000, 100, 5_000)!;
    expect(clamped).toBeCloseTo(
      estimateProviderCostUsd(...PRO, 1_000, 100, 1_000)!,
      9,
    );
    expect(clamped).toBeGreaterThan(0);
  });

  it("ignores a negative cached count", () => {
    expect(estimateProviderCostUsd(...PRO, 1_000, 100, -50))
      .toBeCloseTo(estimateProviderCostUsd(...PRO, 1_000, 100, 0)!, 9);
  });

  it("switches to long-context rates past the threshold", () => {
    // Gemini 2.5 Pro doubles every rate above 200k input tokens.
    const under = estimateProviderCostUsd(...PRO, 200_000, 1_000)!;
    const over = estimateProviderCostUsd(...PRO, 200_001, 1_000)!;
    expect(under).toBeCloseTo(200_000 * 1.25e-6 + 1_000 * 10e-6, 6);
    expect(over).toBeCloseTo(200_001 * 2.50e-6 + 1_000 * 15e-6, 6);
  });

  it("keeps the standard rates at exactly the threshold", () => {
    // "prompts <= 200k" — the boundary belongs to the cheaper tier.
    expect(estimateProviderCostUsd(...PRO, 200_000, 0))
      .toBeCloseTo(200_000 * 1.25e-6, 6);
  });

  it("prices a model with no long-context tier at one rate throughout", () => {
    const key = ["groq", "openai/gpt-oss-120b"] as const;
    expect(estimateProviderCostUsd(...key, 400_000, 100))
      .toBeCloseTo(400_000 * 0.15e-6 + 100 * 0.60e-6, 6);
  });
});

describe("an unpriced model", () => {
  it("returns null and says so, instead of silently recording null", () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    try {
      expect(estimateProviderCostUsd("acme", "wonder-model-1", 100, 10))
        .toBeNull();
      expect(warn).toHaveBeenCalledOnce();
      expect(warn.mock.calls[0][0]).toContain("acme/wonder-model-1");
    } finally {
      warn.mockRestore();
    }
  });

  it("warns once per model, not once per generation", () => {
    // Otherwise the fix for a silent failure is a log nobody can read.
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    try {
      for (let i = 0; i < 5; i++) {
        estimateProviderCostUsd("acme", "chatty-model-2", 100, 10);
      }
      expect(warn).toHaveBeenCalledOnce();
    } finally {
      warn.mockRestore();
    }
  });

  it("reports through hasProviderPricing too", () => {
    expect(hasProviderPricing("acme", "wonder-model-1")).toBe(false);
  });
});
