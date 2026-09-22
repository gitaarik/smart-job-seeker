import { describe, expect, it } from 'vitest';
import {
	ASSISTANT_PROFILE_FIELDS,
	CORE_PROFILE_FIELDS,
	LETTER_PROFILE_FIELDS,
	SUGGEST_PROFILE_FIELDS
} from '../profile-fields';
import { EXPORTED_PROFILE_KEYS, PROFILE_SNAPSHOT_COLUMN_NAMES } from '$lib/server/profile/export';
import { STORY_PROFILE_FIELDS } from '../profile-story';
import { CHEATSHEET_PROFILE_FIELDS } from '../profile-cheatsheet';
import { QUESTION_PROFILE_FIELDS } from '../application-question';

// These pin the EXACT field set each generator sends as profileDataFields,
// against the literal lists that existed before they were composed from a shared
// CORE. `profileDataFields` filters collected_data by set membership, so a wrong
// delta (or a changed CORE) silently degrades a generator's ${data} with no
// error — these catch that.
//
// The pins alone cannot catch a name that is not a collected_data key at all,
// which is the other half of the same failure: pinned as `education` for as long
// as they have existed, while the export writes `educations`, so all four lists
// agreed precisely on a key that was never in the blob. Corrected 2026-09-10.
//
// The membership test at the bottom covers that, but only for lists this file
// imports — a caller that declares its own list inline is out of its reach, and
// the import suggester did exactly that with four names the export has never
// written. So the real guard is the `ExportedProfileKey[]` annotation on each
// list (profile/export.ts), which the compiler applies wherever a list is
// written. This file is the second line: it would still fail if that type were
// widened or cast past.
const set = (a: readonly string[]) => new Set(a);

describe('profile field lists (composed from CORE)', () => {
	it('STORY = the documented behavioural-story fields', () => {
		expect(set(STORY_PROFILE_FIELDS)).toEqual(
			set([
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
				'tech_skill_categories',
				'project_stories'
			])
		);
	});

	it('CHEATSHEET = the documented cheat-sheet fields', () => {
		expect(set(CHEATSHEET_PROFILE_FIELDS)).toEqual(
			set([
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
				'tech_skill_categories',
				'languages'
			])
		);
	});

	it('LETTER = the documented letter fields', () => {
		expect(set(LETTER_PROFILE_FIELDS)).toEqual(
			set([
				'name',
				'title',
				'headline',
				'subtitle',
				'summary',
				'location',
				'core_stack',
				'highlights',
				'work_experiences',
				'side_projects',
				'educations',
				'tech_skill_categories',
				'languages'
			])
		);
	});

	it('QUESTION = the documented question fields', () => {
		expect(set(QUESTION_PROFILE_FIELDS)).toEqual(
			set([
				'name',
				'title',
				'headline',
				'subtitle',
				'summary',
				'location',
				'core_stack',
				'highlights',
				'work_experiences',
				'side_projects',
				'educations',
				'tech_skill_categories',
				'languages',
				'project_stories',
				'references'
			])
		);
	});

	const SALARY_FIELDS = [
		'salary_base_rate',
		'salary_currency',
		'salary_adjustments',
		'salary_region_overrides'
	];

	it('ASSISTANT = the letter fields plus references, the long bio and salary', () => {
		expect(set(ASSISTANT_PROFILE_FIELDS)).toEqual(
			set([
				...LETTER_PROFILE_FIELDS,
				'references',
				'about_me_text',
				'salary_base_rate',
				'salary_currency',
				'salary_adjustments',
				'salary_region_overrides'
			])
		);
	});

	it('keeps the long bio out of every document generator', () => {
		// `about_me_text` is the assistant's alone. It is a near-duplicate of
		// `summary` plus the work history, so a letter or a story that listed it
		// would spend budget twice on the same claims — and on dev the blob is
		// already over DEFAULT_PROFILE_BUDGET_CHARS, where the thing that pays is
		// work experience getting dropped.
		for (const list of [
			CORE_PROFILE_FIELDS,
			STORY_PROFILE_FIELDS,
			CHEATSHEET_PROFILE_FIELDS,
			LETTER_PROFILE_FIELDS,
			QUESTION_PROFILE_FIELDS
		]) {
			expect(list).not.toContain('about_me_text');
		}
		expect(ASSISTANT_PROFILE_FIELDS).toContain('about_me_text');
	});

	it('keeps what the applicant charges out of every document generator', () => {
		// Salary is the assistant's alone, for a different reason than the bio:
		// it answers "what do I charge", and it has no business being written
		// into a letter or a story unprompted. The matcher is kept away from it
		// separately and more firmly — see NON_FIT_FIELDS, where salary reaching
		// `score_job_match` was measured moving 12 replayed scorings past the
		// temperature-0 noise floor.
		for (const list of [
			CORE_PROFILE_FIELDS,
			STORY_PROFILE_FIELDS,
			CHEATSHEET_PROFILE_FIELDS,
			LETTER_PROFILE_FIELDS,
			QUESTION_PROFILE_FIELDS
		]) {
			for (const field of SALARY_FIELDS) expect(list).not.toContain(field);
		}
		for (const field of SALARY_FIELDS) expect(ASSISTANT_PROFILE_FIELDS).toContain(field);
	});

	it('every generator list is CORE plus its own delta, with no duplicates', () => {
		const core = set(CORE_PROFILE_FIELDS);
		for (const list of [
			STORY_PROFILE_FIELDS,
			CHEATSHEET_PROFILE_FIELDS,
			LETTER_PROFILE_FIELDS,
			QUESTION_PROFILE_FIELDS,
			ASSISTANT_PROFILE_FIELDS
		]) {
			// CORE is a subset of every list…
			for (const f of core) expect(list).toContain(f);
			// …and nothing is repeated.
			expect(list.length).toBe(new Set(list).size);
		}
	});

	// The pins above prove the lists agree with each other. They cannot prove a
	// name is a real `collected_data` key, and that is the failure that actually
	// shipped: all four agreed on `education`, which the export writes as
	// `educations`, so every generator asked for a key that was never in the blob
	// and got silence back. A set-membership filter has no way to complain.
	it('every field is a key exportProfile can actually produce', () => {
		const exported = set(EXPORTED_PROFILE_KEYS);
		for (const [name, list] of [
			['STORY', STORY_PROFILE_FIELDS],
			['CHEATSHEET', CHEATSHEET_PROFILE_FIELDS],
			['LETTER', LETTER_PROFILE_FIELDS],
			['QUESTION', QUESTION_PROFILE_FIELDS],
			['ASSISTANT', ASSISTANT_PROFILE_FIELDS],
			['SUGGEST', SUGGEST_PROFILE_FIELDS]
		] as const) {
			const unknown = list.filter((f) => !exported.has(f));
			expect(unknown, `${name} asks for keys exportProfile never writes`).toEqual([]);
		}
	});

	// And one layer below that: being a key the export DESCRIBES is not the same
	// as being a key it FILLS. The schema every prompt is shown and the `${data}`
	// beside it used to come from two hand-written lists in export.ts, so a field
	// added to the first alone passed every test here while the model was told
	// about a field that is always empty — which is exactly what adding
	// `about_me_text` to the mapping alone did. They are one list now; this says
	// so, and fails if they are ever split again.
	it('describes exactly the profile columns the snapshot query selects', () => {
		for (const name of PROFILE_SNAPSHOT_COLUMN_NAMES) {
			expect(EXPORTED_PROFILE_KEYS, `${name} is selected but never described`).toContain(name);
		}
	});
});
