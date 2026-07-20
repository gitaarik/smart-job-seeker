/**
 * Threshold validation against REAL embedding similarities.
 *
 * Why this exists separately from skill-embeddings.test.ts:
 *
 * That suite mocks the provider with 3-dimensional hand-picked vectors where
 * unrelated skills sit at ~0.11 cosine. It correctly tests the *plumbing*
 * (expandProfileSkills -> cosine -> threshold -> expansion) and has always
 * passed. But real embeddings are nothing like orthogonal: measured against
 * gemini-embedding-001 over the live job vocabulary, the MEDIAN similarity of
 * two unrelated skills is ~0.54. The mock understates real-world noise by ~5x.
 *
 * That gap is why 12 green tests sat on top of a shipped default of 0.55 —
 * a value inside the noise floor, at which "React" expands to ~48% of the
 * vocabulary and every profile matches every job.
 *
 * A mocked test can never catch that: the fixture encodes the assumption being
 * tested. So these tests assert *properties of real data*, using a committed
 * matrix of real pairwise cosine similarities (see fixtures/, regenerate with
 * `scripts/tune-skill-embeddings.ts --export-fixture`).
 */

import { describe, expect, it } from "vitest";
import { config } from "$lib/server/config";
import fixture from "./fixtures/skill-similarities.json";

const { labels, sims, model, dimensions, anchors } = fixture as {
  labels: string[];
  sims: number[][];
  model: string;
  dimensions: number;
  anchors: string[];
};

const idx = new Map(labels.map((l, i) => [l.toLowerCase(), i]));

function sim(a: string, b: string): number {
  const i = idx.get(a.toLowerCase());
  const j = idx.get(b.toLowerCase());
  if (i === undefined) throw new Error(`fixture missing skill: ${a}`);
  if (j === undefined) throw new Error(`fixture missing skill: ${b}`);
  return sims[i][j];
}

/** How many fixture skills a given skill pulls in at a threshold. */
function expansionCount(skill: string, threshold: number): number {
  const i = idx.get(skill.toLowerCase());
  if (i === undefined) throw new Error(`fixture missing skill: ${skill}`);
  return sims[i].filter((s) => s >= threshold).length;
}

/** Every distinct pair in the fixture, as a sorted similarity list. */
function allPairSims(): number[] {
  const out: number[] = [];
  for (let i = 0; i < labels.length; i++) {
    for (let j = i + 1; j < labels.length; j++) out.push(sims[i][j]);
  }
  return out.sort((a, b) => a - b);
}

function percentile(sorted: number[], p: number): number {
  return sorted[Math.floor(sorted.length * p)];
}

describe("embedding model pin", () => {
  // The threshold is only meaningful for the model it was tuned against.
  // Swapping models silently invalidates every number below — and a
  // decommissioned model returns empty vectors that get persisted as a
  // poisoned cache (this is how text-embedding-004 broke). Fail loudly.
  it("fixture matches the configured embedding model", () => {
    expect(config.embeddingModel).toBe(model);
  });

  // The threshold is tuned for a specific working dimension (vectors are
  // truncated to it on load). Changing the working dim shifts the cosine
  // geometry, so the fixture must be regenerated and the threshold re-tuned.
  it("fixture matches the configured working dimension", () => {
    expect(config.embeddingWorkingDimensions).toBe(dimensions);
  });
});

describe("threshold vs. the real noise floor", () => {
  it("unrelated skills are NOT near-orthogonal (documents why mocks mislead)", () => {
    const all = allPairSims();
    // Real embeddings crowd together. If this ever drops near the mocked
    // suite's ~0.11, the model changed character and the threshold needs
    // re-tuning from scratch.
    expect(percentile(all, 0.5)).toBeGreaterThan(0.4);
  });

  it("configured threshold sits above the p99 of unrelated-pair noise", () => {
    const all = allPairSims();
    const p99 = percentile(all, 0.99);
    // The fixture is mostly random skills, so its upper percentiles approximate
    // the unrelated-pair noise ceiling. A threshold at or below it fires on
    // pairs with no relationship.
    expect(config.embeddingSkillThreshold).toBeGreaterThan(p99);
  });
});

describe("expansion is bounded", () => {
  // THE regression test. At the old default of 0.55, "React" pulled in ~48% of
  // the live vocabulary; every profile then overlapped every job's
  // requirements, so semantic matching silently degraded to "match all".
  const MAX_EXPANSION_RATIO = 0.05;

  for (const skill of ["React", "k8s", "Python", "communication"]) {
    it(`"${skill}" expands to <=${MAX_EXPANSION_RATIO * 100}% of the vocabulary`, () => {
      const count = expansionCount(skill, config.embeddingSkillThreshold);
      expect(count / labels.length).toBeLessThanOrEqual(MAX_EXPANSION_RATIO);
    });
  }
});

describe("known skill pairs", () => {
  // Abbreviation/spelling variants: the recall gap this feature exists to close.
  const SHOULD_MATCH: [string, string][] = [
    ["k8s", "Kubernetes (K8s)"],
    ["JS", "javascript"],
    ["React", "Reactjs"],
  ];

  // Unrelated: must stay below the threshold or expansion is meaningless.
  const SHOULD_NOT_MATCH: [string, string][] = [
    ["React", "Kubernetes (K8s)"],
    ["Python", "communication"],
    ["k8s", "CRM knowledge"],
  ];

  for (const [a, b] of SHOULD_MATCH) {
    it(`"${a}" matches "${b}"`, () => {
      expect(sim(a, b)).toBeGreaterThanOrEqual(config.embeddingSkillThreshold);
    });
  }

  for (const [a, b] of SHOULD_NOT_MATCH) {
    it(`"${a}" does NOT match "${b}"`, () => {
      expect(sim(a, b)).toBeLessThan(config.embeddingSkillThreshold);
    });
  }
});

describe("fixture integrity", () => {
  it("contains the anchor skills the thresholds turn on", () => {
    expect(anchors.length).toBeGreaterThan(10);
    for (const a of anchors) expect(idx.has(a.toLowerCase())).toBe(true);
  });

  it("similarity matrix is square and self-similarity is ~1", () => {
    expect(sims.length).toBe(labels.length);
    for (let i = 0; i < labels.length; i++) {
      expect(sims[i].length).toBe(labels.length);
      expect(sims[i][i]).toBeGreaterThan(0.99);
    }
  });
});
