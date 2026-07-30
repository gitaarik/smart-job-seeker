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
  write_or_advise_cover_letter: "application-letter.ts",
  advise_cover_letter: "application-letter.ts",
  review_cover_letter: "application-letter.ts",
  write_cheat_sheet: "application-letter.ts",
  write_or_advise_cheat_sheet: "application-letter.ts",
  advise_cheat_sheet: "application-letter.ts",
  review_cheat_sheet: "application-letter.ts",
  // ai-chat/application-question.ts — generate/advice/review + auto modes.
  answer_application_question: "application-question.ts",
  write_or_advise_application_question: "application-question.ts",
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

/**
 * `${additionalContext}` carries the applicant's own brief for a turn — what
 * they typed in the editor's composer before pressing "AI advice" or "AI
 * generate". Same two-way drift risk as `${interviewHistory}`, with one extra
 * trap: `review_application_question` and the letter review prompts are ALSO
 * reached through the followup builders, which assemble their own variables.
 * A placeholder added to a template the followup path doesn't supply would
 * ship the literal `${additionalContext}` to the model on every review.
 */
const ADDITIONAL_CONTEXT_SUPPLIED_BY: Record<string, string> = {
  // ai-chat/application-letter.ts — all letter types and modes share
  // customVariables, and the review prompts get it from the followup builder
  // too (application-letter-followup.ts, review branch).
  write_cover_letter: "application-letter.ts",
  write_or_advise_cover_letter: "application-letter.ts",
  advise_cover_letter: "application-letter.ts",
  review_cover_letter: "application-letter.ts",
  write_cheat_sheet: "application-letter.ts",
  write_or_advise_cheat_sheet: "application-letter.ts",
  advise_cheat_sheet: "application-letter.ts",
  review_cheat_sheet: "application-letter.ts",
  // ai-chat/application-question.ts — generate/advice + auto. review is
  // deliberately excluded: it also runs through the followup path, which
  // builds its own variables and would leak the placeholder.
  answer_application_question: "application-question.ts",
  write_or_advise_application_question: "application-question.ts",
  advise_application_question: "application-question.ts",
  // ai-chat/profile-story.ts — generate/advice + auto. review_star_story is
  // excluded for the same reason as the question review: it also runs through
  // the followup path, which assembles its own variables.
  write_star_story: "profile-story.ts",
  write_or_advise_star_story: "profile-story.ts",
  advise_star_story: "profile-story.ts",
  // ai-chat/profile-cheatsheet.ts — generate/advice + auto. review_prep_sheet
  // is excluded (it runs through the followup path, which builds its own vars).
  write_prep_sheet: "profile-cheatsheet.ts",
  write_or_advise_prep_sheet: "profile-cheatsheet.ts",
  advise_prep_sheet: "profile-cheatsheet.ts",
};

describe("${additionalContext} template ↔ caller wiring", () => {
  const referencing = Object.entries(promptTemplates)
    .filter(([, t]) =>
      `${t.system_prompt}\n${t.user_prompt}`.includes("${additionalContext}")
    )
    .map(([key]) => key);

  it("is referenced by every template a caller supplies it to", () => {
    expect(referencing.sort()).toEqual(
      Object.keys(ADDITIONAL_CONTEXT_SUPPLIED_BY).sort(),
    );
  });

  it("is supplied by a caller for every template that references it", () => {
    const unsupplied = referencing.filter(
      (key) => !(key in ADDITIONAL_CONTEXT_SUPPLIED_BY),
    );
    expect(unsupplied).toEqual([]);
  });

  it("stays out of review_application_question (followup builds its own vars)", () => {
    const t = promptTemplates["review_application_question"];
    expect(`${t.system_prompt}\n${t.user_prompt}`)
      .not.toContain("${additionalContext}");
  });
});

/**
 * `${relevantProjects}` is Top-K retrieval over the applicant's uploaded
 * documents. Both drift directions cost something real here:
 *
 *   - template references it, caller doesn't supply it → literal
 *     "${relevantProjects}" ships to the model;
 *   - caller supplies it, template doesn't reference it → an embedding search
 *     runs on every generation and the result is thrown away.
 *
 * The second half is not hypothetical: both callers used to compute it for
 * every mode while only the two writing prompts interpolated it, so advice and
 * review each paid for a discarded retrieval. Callers now compute it for the
 * draft-writing modes only (`generate`, plus the cover-letter `auto` mode which
 * may write one), which is exactly the set below.
 */
const RELEVANT_PROJECTS_SUPPLIED_BY: Record<string, string> = {
  // ai-chat/application-letter.ts — generate and auto modes (both letter types);
  // auto may write a draft, which needs the retrieval.
  write_cover_letter: "application-letter.ts",
  write_or_advise_cover_letter: "application-letter.ts",
  write_cheat_sheet: "application-letter.ts",
  write_or_advise_cheat_sheet: "application-letter.ts",
  // ai-chat/application-question.ts — generate and auto modes.
  answer_application_question: "application-question.ts",
  write_or_advise_application_question: "application-question.ts",
  // ai-chat/profile-cheatsheet.ts — generate and auto modes, via the unified
  // generation-context provider (sources: ["projects"]). advice/review don't
  // reference it and don't pay for retrieval.
  write_prep_sheet: "profile-cheatsheet.ts",
  write_or_advise_prep_sheet: "profile-cheatsheet.ts",
  // ai-chat/profile-story.ts — generate + auto, via the provider.
  write_star_story: "profile-story.ts",
  write_or_advise_star_story: "profile-story.ts",
};

describe("${relevantProjects} template ↔ caller wiring", () => {
  const referencing = Object.entries(promptTemplates)
    .filter(([, t]) =>
      `${t.system_prompt}\n${t.user_prompt}`.includes("${relevantProjects}")
    )
    .map(([key]) => key);

  it("is referenced by every template a caller supplies it to", () => {
    expect(referencing.sort()).toEqual(
      Object.keys(RELEVANT_PROJECTS_SUPPLIED_BY).sort(),
    );
  });

  it("is supplied by a caller for every template that references it", () => {
    const unsupplied = referencing.filter(
      (key) => !(key in RELEVANT_PROJECTS_SUPPLIED_BY),
    );
    expect(unsupplied).toEqual([]);
  });

  it("reaches cheat sheets, not just cover letters", () => {
    // Cheat sheets went without uploaded-document context for a long time
    // purely because the slot was missing from the template.
    expect(referencing).toContain("write_cheat_sheet");
  });
});

/**
 * `${relevantStories}` is Top-K retrieval over the applicant's OWN prepared STAR
 * stories via the generic content-retrieval layer (Feature 5). Same drift risk
 * as ${relevantProjects}: a referencing template must be supplied it (else a
 * literal placeholder ships), and a supplying caller must have a template that
 * interpolates it (else an embedding search runs and is thrown away).
 */
const RELEVANT_STORIES_SUPPLIED_BY: Record<string, string> = {
  // ai-chat/profile-cheatsheet.ts — generate + auto, via the generation-context
  // provider (sources include "stories").
  write_prep_sheet: "profile-cheatsheet.ts",
  write_or_advise_prep_sheet: "profile-cheatsheet.ts",
  // ai-chat/application-letter.ts — both letter types, generate + auto.
  write_cover_letter: "application-letter.ts",
  write_or_advise_cover_letter: "application-letter.ts",
  write_cheat_sheet: "application-letter.ts",
  write_or_advise_cheat_sheet: "application-letter.ts",
  // ai-chat/application-question.ts — generate + auto.
  answer_application_question: "application-question.ts",
  write_or_advise_application_question: "application-question.ts",
};

describe("${relevantStories} template ↔ caller wiring", () => {
  const referencing = Object.entries(promptTemplates)
    .filter(([, t]) =>
      `${t.system_prompt}\n${t.user_prompt}`.includes("${relevantStories}")
    )
    .map(([key]) => key);

  it("is referenced by every template a caller supplies it to", () => {
    expect(referencing.sort()).toEqual(
      Object.keys(RELEVANT_STORIES_SUPPLIED_BY).sort(),
    );
  });

  it("is supplied by a caller for every template that references it", () => {
    const unsupplied = referencing.filter(
      (key) => !(key in RELEVANT_STORIES_SUPPLIED_BY),
    );
    expect(unsupplied).toEqual([]);
  });
});

/**
 * `${relevantApplicationTexts}` is Top-K retrieval over the applicant's past
 * cover letters + application answers (generic content-retrieval layer). Same
 * drift contract as the other retrieval slots.
 */
const RELEVANT_APPLICATION_TEXTS_SUPPLIED_BY: Record<string, string> = {
  write_prep_sheet: "profile-cheatsheet.ts",
  write_or_advise_prep_sheet: "profile-cheatsheet.ts",
  write_star_story: "profile-story.ts",
  write_or_advise_star_story: "profile-story.ts",
  // ai-chat/application-letter.ts — both letter types, generate + auto. The
  // current application's own texts are excluded via excludeApplicationId.
  write_cover_letter: "application-letter.ts",
  write_or_advise_cover_letter: "application-letter.ts",
  write_cheat_sheet: "application-letter.ts",
  write_or_advise_cheat_sheet: "application-letter.ts",
  // ai-chat/application-question.ts — generate + auto (same exclusion).
  answer_application_question: "application-question.ts",
  write_or_advise_application_question: "application-question.ts",
};

describe("${relevantApplicationTexts} template ↔ caller wiring", () => {
  const referencing = Object.entries(promptTemplates)
    .filter(([, t]) =>
      `${t.system_prompt}\n${t.user_prompt}`.includes(
        "${relevantApplicationTexts}",
      )
    )
    .map(([key]) => key);

  it("is referenced by every template a caller supplies it to", () => {
    expect(referencing.sort()).toEqual(
      Object.keys(RELEVANT_APPLICATION_TEXTS_SUPPLIED_BY).sort(),
    );
  });

  it("is supplied by a caller for every template that references it", () => {
    const unsupplied = referencing.filter(
      (key) => !(key in RELEVANT_APPLICATION_TEXTS_SUPPLIED_BY),
    );
    expect(unsupplied).toEqual([]);
  });
});

/**
 * The cheat-sheet prompt has to do more with interview records than merely be
 * handed them. A real generation (SURF, 2026-07-27) had both records in full
 * in its prompt and still dropped the one thing that mattered most: the
 * records corrected the applicant's framing of the employer, and the sheet
 * coached the *uncorrected* version back at them. It also ignored the records'
 * list of still-open questions in favour of invented generic ones.
 *
 * These assertions pin the instructions that address that. They are cheap and
 * they are the only automatic check — whether the model actually obeys is what
 * `npm run llm:smoke` covers.
 */
describe("write_cheat_sheet records handling", () => {
  const t = promptTemplates["write_cheat_sheet"];
  const full = `${t.system_prompt}\n${t.user_prompt}`;

  it("requires a corrections section", () => {
    expect(full).toMatch(/Corrections & carry-overs/);
    expect(full).toMatch(/misunderstanding|wrong framing/);
  });

  it("requires unanswered questions to be carried over", () => {
    expect(full).toMatch(/Still open/);
    expect(full).toMatch(/INSTEAD OF generic invented ones/);
  });

  it("ranks the records above generic profile-to-job matching", () => {
    expect(full).toMatch(/outrank generic profile-to-job matching/);
  });

  it("tells the model to translate records written in another language", () => {
    // The SURF records were Dutch and the sheet English; points written in
    // the other language were the ones that went missing.
    expect(full).toMatch(/different language/);
    expect(full).toMatch(/Translate what you carry over/);
  });

  it("write_or_advise_cheat_sheet carries the same records handling", () => {
    // The unified entry point writes cheat sheets too, so it must not drift
    // from the guarantees above — the SURF regression would recur silently.
    const a = promptTemplates["write_or_advise_cheat_sheet"];
    const full2 = `${a.system_prompt}\n${a.user_prompt}`;
    expect(full2).toMatch(/Corrections & carry-overs/);
    expect(full2).toMatch(/Still open/);
    expect(full2).toMatch(/INSTEAD OF generic invented ones/);
    expect(full2).toMatch(/outrank generic profile-to-job matching/);
    expect(full2).toMatch(/Translate what you carry over/);
  });
});
