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
  "supportingEvidence",
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

/**
 * `${interviewHistory}` (application interview records) is supplied by four
 * separate callers, so it is easy for a template and its caller to drift apart
 * in either direction — and `interpolatePrompt` reports neither:
 *
 *   - template has the placeholder, caller doesn't supply it → the literal
 *     text "${interviewHistory}" is sent to the model;
 *   - caller supplies it, template doesn't reference it → a DB query runs on
 *     every generation and the result is silently discarded.
 *
 * This exact gap happened while wiring it up: `revise_application_question` is
 * NOT reached through `QUESTION_MODE_TO_PROMPT` (which only maps
 * generate/advice/review) but through its own endpoint at
 * /api/ai/questions/[id]/revise, which had to be wired separately.
 */
const INTERVIEW_HISTORY_SUPPLIED_BY: Record<string, string> = {
  // ai-chat/application-letter.ts — all letter types share customVariables.
  write_cover_letter: "application-letter.ts",
  advise_cover_letter: "application-letter.ts",
  review_cover_letter: "application-letter.ts",
  write_cheat_sheet: "application-letter.ts",
  advise_cheat_sheet: "application-letter.ts",
  review_cheat_sheet: "application-letter.ts",
  // ai-chat/application-question.ts — generate/advice/review modes.
  answer_application_question: "application-question.ts",
  advise_application_question: "application-question.ts",
  review_application_question: "application-question.ts",
  // Its own endpoint, not the mode map.
  revise_application_question: "routes/api/ai/questions/[id]/revise",
  // The two followup builders.
  followup_letter: "application-letter-followup.ts",
  followup_application_question: "application-question-followup.ts",
};

describe("${interviewHistory} template ↔ caller wiring", () => {
  const referencing = Object.entries(promptTemplates)
    .filter(([, t]) =>
      `${t.system_prompt}\n${t.user_prompt}`.includes("${interviewHistory}")
    )
    .map(([key]) => key);

  it("is referenced by every template a caller supplies it to", () => {
    // A caller computing the context for a template that ignores it means a
    // wasted query and wasted tokens on every generation.
    const supplied = Object.keys(INTERVIEW_HISTORY_SUPPLIED_BY).sort();
    expect(referencing.sort()).toEqual(supplied);
  });

  it("is supplied by a caller for every template that references it", () => {
    const unsupplied = referencing.filter(
      (key) => !(key in INTERVIEW_HISTORY_SUPPLIED_BY),
    );
    // Non-empty means the placeholder would ship as literal text to the model.
    expect(unsupplied).toEqual([]);
  });

  it("stays out of extraction prompts, which run on tight token budgets", () => {
    // Extraction runs on the app provider with structured-output schemas where
    // a large context risks the json_validate_failed failure mode. Interview
    // records are for writing prompts only.
    const extractionPrompts = [
      "extract_qa_pairs",
      "extract_job_data",
      "extract_resume_data",
      "extract_matched_skills",
      "score_job_match",
      "find_next_page_button",
    ];
    for (const key of extractionPrompts) {
      if (!promptTemplates[key]) continue;
      expect(referencing, `${key} must not carry interview records`)
        .not.toContain(key);
    }
  });

  it("guards writing prompts against inventing a shared history", () => {
    // Handed interview notes with no instruction, a model will happily write
    // "as we discussed" into a letter that predates any interview. Cheat
    // sheets are excluded deliberately — they are never sent to anyone, and
    // building on the earlier rounds is exactly what they are for.
    const writingPrompts = referencing.filter((key) =>
      !key.includes("cheat_sheet")
    );
    expect(writingPrompts.length).toBeGreaterThan(0);

    for (const key of writingPrompts) {
      const t = promptTemplates[key];
      const full = `${t.system_prompt}\n${t.user_prompt}`;
      expect(full, `${key} lacks the fabrication guard`)
        .toMatch(/Never imply a conversation, meeting or relationship/);
    }
  });

  it("tells interview-prep prompts to build on the earlier rounds", () => {
    for (const key of referencing.filter((k) => k.includes("cheat_sheet"))) {
      const t = promptTemplates[key];
      const full = `${t.system_prompt}\n${t.user_prompt}`;
      expect(full, `${key} lacks the build-on-earlier-rounds instruction`)
        .toMatch(/records of earlier rounds/);
    }
  });
});
