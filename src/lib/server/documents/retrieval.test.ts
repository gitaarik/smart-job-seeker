import { describe, expect, it } from "vitest";
import {
  type ProjectForRanking,
  rankProjects,
  scoreProjectAgainstJob,
} from "./retrieval";

const proj = (
  id: number,
  keywords: string[],
  summary = "s",
): ProjectForRanking => ({ id, title: `p${id}`, summary, keywords });

describe("scoreProjectAgainstJob", () => {
  it("weights explicit required-skill matches highest", () => {
    const job = {
      title: "Backend Engineer",
      skills_required: ["PostgreSQL", "Redis"],
    };
    const score = scoreProjectAgainstJob(proj(1, ["PostgreSQL", "Redis"]), job);
    expect(score).toBe(6); // 3 + 3
  });

  it("matches loosely (postgres ~ PostgreSQL) and counts text mentions", () => {
    const job = {
      title: "We use Kubernetes heavily",
      skills_required: ["postgres"],
    };
    const score = scoreProjectAgainstJob(
      proj(1, ["PostgreSQL", "Kubernetes"]),
      job,
    );
    // PostgreSQL ↔ postgres = skill match (3); Kubernetes appears in title (1)
    expect(score).toBe(4);
  });

  it("scores an unrelated project zero", () => {
    const job = { skills_required: ["COBOL", "Fortran"] };
    expect(scoreProjectAgainstJob(proj(1, ["React", "Tailwind"]), job)).toBe(0);
  });

  it("ignores empty keyword lists", () => {
    expect(scoreProjectAgainstJob(proj(1, []), { skills_required: ["Go"] }))
      .toBe(0);
  });
});

describe("rankProjects", () => {
  const job = {
    title: "Full-stack role",
    skills_required: ["TypeScript", "PostgreSQL", "Docker"],
  };

  it("orders by score and drops irrelevant projects", () => {
    const projects = [
      proj(1, ["COBOL"]), // 0 → dropped
      proj(2, ["TypeScript"]), // 3
      proj(3, ["TypeScript", "PostgreSQL", "Docker"]), // 9
    ];
    const ranked = rankProjects(projects, job);
    expect(ranked.map((p) => p.id)).toEqual([3, 2]);
    expect(ranked[0].score).toBeGreaterThan(ranked[1].score);
  });

  it("caps at k", () => {
    const projects = [
      proj(1, ["TypeScript"]),
      proj(2, ["PostgreSQL"]),
      proj(3, ["Docker"]),
      proj(4, ["TypeScript", "Docker"]),
    ];
    expect(rankProjects(projects, job, 2)).toHaveLength(2);
  });

  it("returns empty when nothing is relevant", () => {
    expect(rankProjects([proj(1, ["Assembly"])], job)).toEqual([]);
  });
});
