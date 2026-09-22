import type { ExportedProfileKey } from '$lib/server/profile/export';

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
 * A name that is not a `collected_data` key used to be no error at all, just
 * silently no data. `education` sat here from the start against an export that
 * writes `educations`, so every generator built from this CORE — cover letters,
 * STAR stories, cheat sheets, application answers — wrote without ever seeing a
 * degree. Every list here is `ExportedProfileKey[]` now (profile/export.ts), so
 * that typo is a compile error at the line that writes it.
 */
export const CORE_PROFILE_FIELDS: ExportedProfileKey[] = [
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
 * `about_me_text` is here and not in CORE, which is the same budget argument at
 * a smaller scale. It is the long bio the applicant keeps for their profile
 * pages, so asking the assistant to shorten it for LinkedIn or draft one from
 * the career is work only this caller is ever asked to do — and it is a
 * near-duplicate of `summary` plus the work history, so a cover letter that
 * spent a thousand characters of its budget on it would be paying twice for
 * what it already has.
 *
 * NOT here, and deliberately: `project_stories` and `cheat_sheets`. The chat
 * already requests the ranked `stories` source, which cites the relevant ones
 * rather than pasting all of them. On dev those two fields are 50k of a 116k
 * blob against a 60k DEFAULT_PROFILE_BUDGET_CHARS, so listing them would not add
 * stories — it would push the blob past the cap and have fitProfileToBudget drop
 * work experience to pay for them.
 */
export const ASSISTANT_PROFILE_FIELDS: ExportedProfileKey[] = [
	...CORE_PROFILE_FIELDS,
	'location',
	'languages',
	'references',
	'about_me_text',
	// What they charge. Measured 2026-09-22: asked "what do you think I charge?"
	// the assistant named a monthly and an hourly figure, both reconstructed from
	// numbers in past application negotiations, because no salary store reached
	// it -- the live columns were in no snapshot and the retired table was named
	// by no field list. This is the only caller that gets them: a cover letter
	// does not quote a rate unprompted, and the matcher is kept away from them
	// deliberately (see NON_FIT_FIELDS).
	'salary_base_rate',
	'salary_currency',
	'salary_adjustments',
	'salary_region_overrides'
];

/**
 * Cover letters + job-tied cheat-sheet letters. Kept here (rather than in
 * application-letter.ts) so the generator and its follow-up path share one
 * definition instead of each declaring their own copy. Not exported from a
 * generator, so nothing external depends on its location.
 */
export const LETTER_PROFILE_FIELDS: ExportedProfileKey[] = [
	...CORE_PROFILE_FIELDS,
	'location',
	'languages'
];

/**
 * The import suggester, which proposes search tasks rather than writing
 * anything.
 *
 * Not composed from CORE, and narrower than it on purpose: picking platforms
 * and filters needs what the applicant does and where they can do it, not who
 * they are or what they achieved, so `name`, `highlights`, `side_projects` and
 * `educations` are all left out and `location` and `languages` added.
 *
 * Lived as a literal in the route, where no test reached it — which is how
 * `city`, `region`, `country_code` and `remote_start_year` sat in it, asking
 * the export for four keys it did not write. Resolved 2026-09-11 in both
 * directions: the first three went with the `profiles.city`/`region` columns,
 * and `remote_start_year` was added to the snapshot instead, because that one
 * was worth having rather than a leftover. The type on this line is what stops
 * the next one going unnoticed either way.
 */
export const SUGGEST_PROFILE_FIELDS: ExportedProfileKey[] = [
	'title',
	'headline',
	'subtitle',
	'summary',
	'core_stack',
	'location',
	'remote_start_year',
	'tech_skill_categories',
	'languages',
	'work_experiences'
];
