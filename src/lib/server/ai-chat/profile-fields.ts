/**
 * Shared profile-blob field selection for AI generation.
 *
 * Every generator hands `createAndGenerateAiChat` a `profileDataFields` list —
 * the top-level `collected_data` keys it wants in the `${data}` blob. They share
 * the same identity CORE and differ only by a small per-caller delta. The core
 * lived copied out four times; defining it once here means a new profile field
 * reaches every generator from one place, and the deltas stay next to the
 * generator that owns them.
 *
 * Order is irrelevant — `profileDataFields` is applied as a set membership
 * filter over `collected_data` (see utils.ts), not as an ordering.
 *
 * A name that is not a `collected_data` key is not an error, it is silently no
 * data. `education` sat here from the start and the export key is `educations`,
 * so every generator built from this CORE — cover letters, STAR stories, cheat
 * sheets, application answers — has been writing without ever seeing a degree.
 * Check a new entry against `PROFILE_SCHEMA_MAPPING` in profile/export.ts.
 */
export const CORE_PROFILE_FIELDS = [
	'name',
	'title',
	'headline',
	'subtitle',
	'summary',
	'core_stack',
	'highlights',
	'work_experiences',
	'side_projects',
	'educations',
	'tech_skill_categories'
];

/**
 * The personal assistant. Lived in the route as a literal, where no test could
 * reach it and both of this file's failure modes had already landed: the
 * `educations` typo, and `references` never listed at all, so asked to write out
 * the applicant's two referees it replied that it could not read them — with the
 * edit manifest a few thousand chars up the same prompt announcing "References —
 * 2 entries".
 *
 * The delta is `location` and `languages` (it answers questions about where
 * someone can work and in what language) plus `references` — the same delta the
 * application-answer generator already takes, minus its `project_stories`. A
 * cover letter leaves references out because a letter is the applicant writing,
 * not somebody else's words about them; quoting a referee back to them, or
 * laying the two out for an email a recruiter asked for, is squarely this one's
 * job.
 *
 * NOT here, and deliberately: `project_stories` and `cheat_sheets`. The chat
 * already requests the ranked `stories` source, which cites the relevant ones
 * rather than pasting all of them. On dev those two fields are 50k of a 116k
 * blob against a 60k DEFAULT_PROFILE_BUDGET_CHARS, so listing them would not add
 * stories — it would push the blob past the cap and have fitProfileToBudget drop
 * work experience to pay for them.
 */
export const ASSISTANT_PROFILE_FIELDS = [
	...CORE_PROFILE_FIELDS,
	'location',
	'languages',
	'references'
];

/**
 * Cover letters + job-tied cheat-sheet letters. Kept here (rather than in
 * application-letter.ts) so the generator and its follow-up path share one
 * definition instead of each declaring their own copy. Not exported from a
 * generator, so nothing external depends on its location.
 */
export const LETTER_PROFILE_FIELDS = [...CORE_PROFILE_FIELDS, 'location', 'languages'];
