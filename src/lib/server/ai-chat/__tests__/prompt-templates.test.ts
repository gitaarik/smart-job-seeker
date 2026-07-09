/**
 * Regression guard for prompt-template ↔ caller placeholder drift.
 *
 * The `score_job_match` template is interpolated by `calculateMatch()` in the
 * cloud tree (cloud/src/server/job/matcher.ts). Because `interpolatePrompt`
 * leaves any unmatched `${placeholder}` untouched (see its own unit test), a
 * template placeholder whose key the caller never supplies silently ships the
 * literal `${...}` text to the LLM — with no error anywhere.
 *
 * This exact bug happened: the candidate work-location preference key was
 * renamed `remote_options` → `work_location` in the matcher, but the template
 * kept `${preferences.remote_options}`, so the preference never reached the
 * model. This test would have caught it.
 */

import { describe, expect, it } from "vitest";
import { promptTemplates } from "../prompt-templates";
import { interpolatePrompt } from "../utils";

/**
 * The variable keys `calculateMatch()` supplies to `createJobMatchingAiChat`
 * for the `score_job_match` template. Source of truth:
 * cloud/src/server/job/matcher.ts (the object passed alongside
 * "score_job_match"). Keep this in sync with that call — if the matcher stops
 * supplying a key or renames one, update here AND the template together.
 */
const MATCHER_SUPPLIED_KEYS = new Set([
  "data",
  "schema",
  "preferences.job_types",
  "preferences.experience_levels",
  "preferences.work_location",
  "preferences.locations",
  "job.title",
  "job.job_poster",
  "job.office_location",
  "job.job_types",
  "job.experience_levels",
  "job.work_location",
  "job.skills_required",
  "job.skills_preferred",
  "job.job_description",
  "job.company_description",
]);

/** Extract every `${...}` and `{{...}}` placeholder name from a template string. */
function extractPlaceholders(text: string): string[] {
  const names = new Set<string>();
  for (const m of text.matchAll(/\$\{([^}]+)\}/g)) names.add(m[1]);
  for (const m of text.matchAll(/\{\{([^}]+)\}\}/g)) names.add(m[1]);
  return [...names];
}

describe("score_job_match template", () => {
  const template = promptTemplates["score_job_match"];
  const fullText = `${template.system_prompt}\n${template.user_prompt}`;

  it("exists", () => {
    expect(template).toBeDefined();
  });

  it("references no placeholder the matcher fails to supply", () => {
    const unsupplied = extractPlaceholders(fullText).filter(
      (name) => !MATCHER_SUPPLIED_KEYS.has(name),
    );
    // A non-empty list means the template drifted from the matcher's keys
    // (e.g. a rename the template missed) — those placeholders would leak as
    // literal `${...}` text into the prompt.
    expect(unsupplied).toEqual([]);
  });

  it("interpolates with the matcher's keys leaving no unresolved placeholder", () => {
    const vars: Record<string, string> = {};
    for (const key of MATCHER_SUPPLIED_KEYS) vars[key] = `<${key}>`;

    const rendered = interpolatePrompt(fullText, vars);

    expect(rendered).not.toMatch(/\$\{[^}]+\}/);
    expect(rendered).not.toMatch(/\{\{[^}]+\}\}/);
  });

  it("carries the candidate work-location preference (regression: was remote_options)", () => {
    // The candidate's own work-location preference must reach the prompt.
    expect(template.user_prompt).toContain("${preferences.work_location}");
    expect(template.user_prompt).not.toContain("${preferences.remote_options}");
  });
});
