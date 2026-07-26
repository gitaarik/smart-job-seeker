import { describe, expect, it } from "vitest";
import {
  buildDocEvidence,
  type DocRow,
  formatProjectCitations,
  formatSupportingEvidence,
  type RankableProject,
  rankProjects,
  scoreProjectAgainstJob,
} from "./retrieval";

const proj = (
  id: number,
  keywords: string[],
  text = "",
): RankableProject => ({
  kind: "side_project",
  id,
  title: `p${id}`,
  context: "",
  keywords,
  text,
  citation: "",
});

describe("scoreProjectAgainstJob", () => {
  it("weights explicit required-skill matches highest", () => {
    const job = {
      title: "Backend Engineer",
      skills_required: ["PostgreSQL", "Redis"],
    };
    expect(scoreProjectAgainstJob(proj(1, ["PostgreSQL", "Redis"]), job)).toBe(
      6,
    );
  });

  it("matches loosely (postgres ~ PostgreSQL) and counts text mentions", () => {
    const job = {
      title: "We use Kubernetes heavily",
      skills_required: ["postgres"],
    };
    // PostgreSQL ↔ postgres skill match (3); Kubernetes in title (1)
    expect(scoreProjectAgainstJob(proj(1, ["PostgreSQL", "Kubernetes"]), job))
      .toBe(4);
  });

  it("credits a required skill mentioned only in the project's prose", () => {
    const job = { skills_required: ["Kubernetes"] };
    // No keywords, but the description mentions the skill → +1
    expect(
      scoreProjectAgainstJob(proj(1, [], "we deployed it on Kubernetes"), job),
    ).toBe(1);
  });

  it("scores an unrelated project zero", () => {
    const job = { skills_required: ["COBOL", "Fortran"] };
    expect(scoreProjectAgainstJob(proj(1, ["React", "Tailwind"]), job)).toBe(0);
  });
});

describe("rankProjects", () => {
  const job = {
    title: "Full-stack role",
    skills_required: ["TypeScript", "PostgreSQL", "Docker"],
  };

  it("orders by score and drops irrelevant projects", () => {
    const ranked = rankProjects([
      proj(1, ["COBOL"]),
      proj(2, ["TypeScript"]),
      proj(3, ["TypeScript", "PostgreSQL", "Docker"]),
    ], job);
    expect(ranked.map((p) => p.id)).toEqual([3, 2]);
  });

  it("caps at k", () => {
    const ranked = rankProjects(
      [
        proj(1, ["TypeScript"]),
        proj(2, ["PostgreSQL"]),
        proj(3, ["Docker"]),
      ],
      job,
      2,
    );
    expect(ranked).toHaveLength(2);
  });

  it("returns empty when nothing is relevant", () => {
    expect(rankProjects([proj(1, ["Assembly"])], job)).toEqual([]);
  });
});

describe("formatProjectCitations", () => {
  const ranked = (over: Partial<RankableProject> = {}): RankableProject => ({
    kind: "work_experience_project",
    id: 1,
    title: "Payments Migration",
    context: "at Acme Corp",
    keywords: ["Kafka"],
    text: "",
    citation: "Migrated billing to microservices.",
    ...over,
  });

  it("returns empty string when there are no projects", () => {
    expect(formatProjectCitations([])).toBe("");
  });

  it("emits a self-contained block with title, context, and citation", () => {
    const out = formatProjectCitations([ranked()]);
    expect(out).toContain("Relevant projects from the applicant");
    expect(out).toContain("1. Payments Migration (at Acme Corp)");
    expect(out).toContain("Migrated billing to microservices.");
  });

  it("omits the parenthetical when there is no context", () => {
    const out = formatProjectCitations([
      ranked({ context: "", title: "Solo App" }),
    ]);
    expect(out).toContain("1. Solo App\n");
    expect(out).not.toContain("Solo App (");
  });
});

describe("formatSupportingEvidence", () => {
  const ranked = (over: Partial<RankableProject> = {}): RankableProject => ({
    kind: "work_experience_project",
    id: 1,
    title: "Payments Migration",
    context: "at Acme Corp",
    keywords: [],
    text: "",
    citation: "",
    docEvidence: "- OrderService repo: distributed payments backend [Kafka]",
    ...over,
  });

  it("returns empty when no project has attachment evidence", () => {
    expect(formatSupportingEvidence([ranked({ docEvidence: "" })])).toBe("");
    expect(formatSupportingEvidence([])).toBe("");
  });

  it("emits only attachment evidence, neutrally framed (not advocacy)", () => {
    const out = formatSupportingEvidence([ranked()]);
    expect(out).toContain("Supporting evidence from the applicant");
    expect(out).toContain("weigh for BOTH fit and gaps");
    expect(out).toContain("### Payments Migration (at Acme Corp)");
    expect(out).toContain("OrderService repo");
  });

  it("skips projects without evidence but keeps those with it", () => {
    const out = formatSupportingEvidence([
      ranked({ id: 1, title: "Has Docs" }),
      ranked({ id: 2, title: "No Docs", docEvidence: "" }),
    ]);
    expect(out).toContain("### Has Docs");
    expect(out).not.toContain("### No Docs");
  });
});

describe("buildDocEvidence", () => {
  const doc = (over: Partial<DocRow> = {}): DocRow => ({
    id: 1,
    title: "OrderService repo",
    original_filename: "orderservice.zip",
    summary: "Distributed payments backend.",
    keywords: ["Kafka", "PostgreSQL"],
    ...over,
  });

  it("emits one bullet per attachment with summary and bracketed keywords", () => {
    expect(buildDocEvidence([doc()])).toBe(
      "- OrderService repo: Distributed payments backend. [Kafka, PostgreSQL]",
    );
  });

  it("falls back title → filename → 'Source' for the label", () => {
    expect(buildDocEvidence([doc({ title: null })])).toContain(
      "- orderservice.zip:",
    );
    expect(
      buildDocEvidence([doc({ title: null, original_filename: null })]),
    ).toContain("- Source:");
  });

  it("skips an attachment with neither summary nor keywords", () => {
    expect(buildDocEvidence([doc({ summary: null, keywords: [] })])).toBe("");
    expect(buildDocEvidence([])).toBe("");
  });

  it("omits the bracket when there are no keywords", () => {
    const out = buildDocEvidence([doc({ keywords: null })]);
    expect(out).toBe("- OrderService repo: Distributed payments backend.");
    expect(out).not.toContain("[");
  });
});
