/**
 * Shared profile-blob field selection for AI generation.
 *
 * Every generator hands `createAndGenerateAiChat` a `profileDataFields` list —
 * the top-level `collected_data` keys it wants in the `${data}` blob. All four
 * lists share the same identity CORE and differ only by a small per-generator
 * delta. The core lived copied out four times; defining it once here means a new
 * profile field reaches every generator from one place, and the deltas stay next
 * to the generator that owns them.
 *
 * Order is irrelevant — `profileDataFields` is applied as a set membership
 * filter over `collected_data` (see utils.ts), not as an ordering.
 */
export const CORE_PROFILE_FIELDS = [
  "name",
  "title",
  "headline",
  "subtitle",
  "summary",
  "core_stack",
  "highlights",
  "work_experiences",
  "side_projects",
  "education",
  "tech_skill_categories",
];

/**
 * Cover letters + job-tied cheat-sheet letters. Kept here (rather than in
 * application-letter.ts) so the generator and its follow-up path share one
 * definition instead of each declaring their own copy. Not exported from a
 * generator, so nothing external depends on its location.
 */
export const LETTER_PROFILE_FIELDS = [
  ...CORE_PROFILE_FIELDS,
  "location",
  "languages",
];
