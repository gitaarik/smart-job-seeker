import { describe, expect, it } from 'vitest';
import { CORE_PROFILE_FIELDS, LETTER_PROFILE_FIELDS } from '../profile-fields';
import { STORY_PROFILE_FIELDS } from '../profile-story';
import { CHEATSHEET_PROFILE_FIELDS } from '../profile-cheatsheet';
import { QUESTION_PROFILE_FIELDS } from '../application-question';

// These pin the EXACT field set each generator sends as profileDataFields,
// against the literal lists that existed before they were composed from a shared
// CORE. `profileDataFields` filters collected_data by set membership, so a wrong
// delta (or a changed CORE) silently degrades a generator's ${data} with no
// error — these catch that.
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
				'education',
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
				'education',
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
				'education',
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
				'education',
				'tech_skill_categories',
				'languages',
				'project_stories',
				'references'
			])
		);
	});

	it('every generator list is CORE plus its own delta, with no duplicates', () => {
		const core = set(CORE_PROFILE_FIELDS);
		for (const list of [
			STORY_PROFILE_FIELDS,
			CHEATSHEET_PROFILE_FIELDS,
			LETTER_PROFILE_FIELDS,
			QUESTION_PROFILE_FIELDS
		]) {
			// CORE is a subset of every list…
			for (const f of core) expect(list).toContain(f);
			// …and nothing is repeated.
			expect(list.length).toBe(new Set(list).size);
		}
	});
});
