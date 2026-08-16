/**
 * Tests for the profile-edit manifest.
 *
 * The block exists to make a *refusal* useful, so what matters is that it names
 * every section and where each lives, and that "you have none yet" reads
 * differently from a section the page cannot reach. Those are the two answers
 * the model used to conflate into a confident no.
 */

import { describe, expect, it } from 'vitest';
import { formatProfileEditManifest } from '../profile-edit-manifest';
import { PROFILE_RESOURCES, PROFILE_RESOURCE_NAMES } from '$lib/server/profile/resources';

const ALL = PROFILE_RESOURCE_NAMES.map((name) => ({ name, rows: 2 }));

describe('formatProfileEditManifest', () => {
	it('names every editable section', () => {
		const text = formatProfileEditManifest(ALL);
		for (const name of PROFILE_RESOURCE_NAMES) {
			expect(text, name).toContain(PROFILE_RESOURCES[name].title);
		}
	});

	it('tells apart two sections that live on one page', () => {
		// Skills and skill categories are both edited at /profile/skills. Named by
		// the page they would be two identical lines, and the count on each would
		// be a number the model could not attach to anything.
		const text = formatProfileEditManifest([
			{ name: 'skill', rows: 93 },
			{ name: 'skill_category', rows: 7 }
		]);

		expect(text).toContain('- Skills — 93 entries. On their Skills page.');
		expect(text).toContain('- Skill categories — 7 entries. On their Skills page.');
	});

	it('says where each section is edited', () => {
		// The whole value of the block: "not from here — open that page" instead
		// of "you can't do that", which is what it said before.
		const text = formatProfileEditManifest([{ name: 'language', rows: 3 }]);
		expect(text).toContain('On their Languages page.');
	});

	it('distinguishes an empty section from an unreachable one', () => {
		const text = formatProfileEditManifest([{ name: 'reference', rows: 0 }]);
		expect(text).toContain('none yet');
		expect(text).toContain('not a part you cannot reach');
	});

	it('counts in words a reader would use', () => {
		expect(formatProfileEditManifest([{ name: 'language', rows: 1 }])).toContain('one entry');
		expect(formatProfileEditManifest([{ name: 'language', rows: 4 }])).toContain('4 entries');
	});

	it('says it is not the list of what can be changed here', () => {
		// Without this the model reads the manifest as permission and proposes an
		// edit the page cannot carry, which is dropped — after the reply has
		// already promised it.
		expect(formatProfileEditManifest(ALL)).toContain('Changes you');
	});

	it('stays small enough to be unconditional', () => {
		// It ships on every turn on every page, including ones with no capability
		// at all. Nine sections at ~60 chars a line plus a short frame.
		expect(formatProfileEditManifest(ALL).length).toBeLessThanOrEqual(1200);
	});
});
