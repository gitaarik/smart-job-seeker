import { describe, expect, it } from "vitest";
import { poolKey, semanticScoreUnits } from "./content-embeddings";

describe("poolKey", () => {
  it("namespaces by unit type so ids don't collide across types", () => {
    expect(poolKey("story", 5)).toBe("story:5");
    expect(poolKey("story", 5)).not.toBe(poolKey("cheat_sheet", 5));
  });
});

describe("semanticScoreUnits", () => {
  // The test env has no embedding key/flag, so isEmbeddingConfigured() is false:
  // the semantic path must bow out (null) and let callers fall back to lexical,
  // without ever touching the DB or the provider.
  it("returns null when embeddings are unconfigured", async () => {
    const scores = await semanticScoreUnits(
      1,
      [{ unitType: "story", unitId: 1, subId: 0, embedText: "x" }],
      "query",
    );
    expect(scores).toBeNull();
  });

  it("returns null for an empty unit list", async () => {
    expect(await semanticScoreUnits(1, [], "query")).toBeNull();
  });
});
