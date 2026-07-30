import { describe, expect, it } from "vitest";
import {
  buildStoryUnit,
  dedupeUnits,
  formatUnitCitations,
  type RankableUnit,
  rankUnits,
  scoreUnitAgainstQuery,
  type StoryRow,
} from "./content-retrieval";

const unit = (over: Partial<RankableUnit> = {}): RankableUnit => ({
  type: "story",
  id: 1,
  title: "",
  context: "",
  keywords: [],
  text: "",
  citation: "",
  embedText: "",
  ...over,
});

describe("scoreUnitAgainstQuery", () => {
  it("scores zero for an empty query", () => {
    expect(
      scoreUnitAgainstQuery({ title: "Django migration", keywords: [], text: "x" }, {
        text: "",
      }),
    ).toBe(0);
  });

  it("weights a title-token match double a body-token match", () => {
    const q = { text: "kubernetes" };
    expect(
      scoreUnitAgainstQuery({ title: "Kubernetes rollout", keywords: [], text: "" }, q),
    ).toBe(2);
    expect(
      scoreUnitAgainstQuery({ title: "Migration notes", keywords: [], text: "we used kubernetes here" }, q),
    ).toBe(1);
  });

  it("credits an explicit skill ↔ keyword match on top of overlap", () => {
    const s = scoreUnitAgainstQuery(
      { title: "", keywords: ["React"], text: "" },
      { text: "", skills: ["react"] },
    );
    expect(s).toBeGreaterThanOrEqual(2);
  });

  it("is bounded by the query size — a huge unit cannot dominate", () => {
    const q = { text: "kubernetes scaling" }; // 2 significant tokens
    const huge = unit({
      title: "",
      text: "kubernetes scaling " + "lorem ipsum dolor ".repeat(500),
    });
    // The body matches at most the 2 query tokens (×1), regardless of its length.
    expect(scoreUnitAgainstQuery(huge, q)).toBe(2);
  });

  it("ignores stopwords and short tokens", () => {
    expect(
      scoreUnitAgainstQuery({ title: "the and for", keywords: [], text: "" }, {
        text: "the and for",
      }),
    ).toBe(0);
  });
});

describe("rankUnits", () => {
  it("orders by score, drops zero-score, caps at k", () => {
    const q = { text: "django postgres" };
    const a = unit({ id: 1, title: "Django Postgres migration" }); // 2 title ×2 = 4
    const b = unit({ id: 2, title: "Django tips", text: "postgres" }); // 1 title ×2 + 1 body = 3
    const c = unit({ id: 3, title: "Unrelated", text: "knitting" }); // 0
    expect(rankUnits([c, b, a], q, 2).map((u) => u.id)).toEqual([1, 2]);
  });

  it("returns empty when nothing is relevant", () => {
    expect(rankUnits([unit({ title: "knitting" })], { text: "kubernetes" })).toEqual([]);
  });
});

describe("formatUnitCitations", () => {
  it("returns empty string when there are no units", () => {
    expect(formatUnitCitations([], { header: "H", intro: "I" })).toBe("");
  });

  it("emits header, intro, and numbered items with the context parenthetical", () => {
    const out = formatUnitCitations(
      [unit({ title: "Scaling", context: "teamwork story", citation: "We scaled it." })],
      { header: "Relevant stories", intro: "Draw on these." },
    );
    expect(out).toContain("## Relevant stories");
    expect(out).toContain("Draw on these.");
    expect(out).toContain("1. Scaling (teamwork story)");
    expect(out).toContain("We scaled it.");
  });

  it("omits the parenthetical when a unit has no context", () => {
    const out = formatUnitCitations([unit({ title: "Solo", context: "", citation: "x" })], {
      header: "H",
      intro: "I",
    });
    expect(out).toContain("1. Solo\n");
    expect(out).not.toContain("Solo (");
  });
});

describe("buildStoryUnit", () => {
  const row = (over: Partial<StoryRow> = {}): StoryRow => ({
    id: 1,
    title: "Scaling Ticketshop",
    category: "teamwork",
    situation: "Traffic spiked for a big event.",
    task: null,
    action: "Sharded the DB.",
    result: null,
    reflection: null,
    ...over,
  });

  it("builds a unit with STAR body, category context, and a citation", () => {
    const u = buildStoryUnit(row())!;
    expect(u.type).toBe("story");
    expect(u.context).toBe("teamwork story");
    expect(u.text).toContain("Situation:");
    expect(u.text).toContain("Action: Sharded the DB.");
    expect(u.citation.length).toBeGreaterThan(0);
  });

  it("skips a story with no title", () => {
    expect(buildStoryUnit(row({ title: null }))).toBeNull();
  });

  it("skips a placeholder-titled draft even when it has body text", () => {
    expect(buildStoryUnit(row({ title: "New story" }))).toBeNull();
  });

  it("skips a story with an empty STAR body", () => {
    expect(
      buildStoryUnit(row({ situation: null, task: null, action: null, result: null, reflection: null })),
    ).toBeNull();
  });

  it("falls back to a generic context when the story has no category", () => {
    expect(buildStoryUnit(row({ category: null })!)?.context).toBe("STAR story");
  });
});

describe("dedupeUnits", () => {
  const u = (id: number, title: string, text: string): RankableUnit => ({
    type: "story",
    id,
    title,
    context: "",
    keywords: [],
    text,
    citation: "",
    embedText: "",
  });

  it("collapses same-title units (a story entered twice), keeping the first", () => {
    const kept = dedupeUnits([
      u(1, "AI Engine", "I built it."),
      u(2, "AI Engine", "I built it, slightly reworded."),
      u(3, "Other", "Different."),
    ]);
    expect(kept.map((x) => x.id)).toEqual([1, 3]);
  });

  it("keeps units with distinct titles", () => {
    expect(dedupeUnits([u(1, "T", "a"), u(2, "U", "b")])).toHaveLength(2);
  });
});
