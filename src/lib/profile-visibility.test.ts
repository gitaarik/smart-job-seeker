import { describe, expect, it } from 'vitest';
import {
	isProfileOnly,
	renameTagSlug,
	setProfileOnly,
	setVersions,
	versionsOf
} from './profile-visibility';

describe('isProfileOnly', () => {
	it('needs both base templates excluded', () => {
		expect(isProfileOnly(['!resume', '!cv'])).toBe(true);
		expect(isProfileOnly(['!resume'])).toBe(false);
		expect(isProfileOnly(['!cv'])).toBe(false);
		expect(isProfileOnly([])).toBe(false);
		expect(isProfileOnly(null)).toBe(false);
	});

	it('ignores casing, whitespace and per-version tags', () => {
		expect(isProfileOnly(['!Resume', ' !CV ', 'backend'])).toBe(true);
	});
});

describe('setProfileOnly', () => {
	it('adds both exclusions and drops contradictory positives', () => {
		expect(setProfileOnly(['cv'], true)).toEqual(['!resume', '!cv']);
		expect(setProfileOnly(null, true)).toEqual(['!resume', '!cv']);
	});

	it('keeps per-version tags in both directions', () => {
		expect(setProfileOnly(['backend'], true)).toEqual(['!resume', '!cv', 'backend']);
		// Turning it off degrades to "shown, but only on backend" rather than
		// silently dropping the version restriction.
		expect(setProfileOnly(['!resume', '!cv', 'backend'], false)).toEqual(['backend']);
	});

	it('leaves a version exclusion alone when turning off', () => {
		expect(setProfileOnly(['!resume', '!cv', '!senior'], false)).toEqual(['!senior']);
	});

	it('round-trips', () => {
		const on = setProfileOnly(['backend'], true);
		expect(isProfileOnly(on)).toBe(true);
		expect(isProfileOnly(setProfileOnly(on, false))).toBe(false);
	});
});

describe('versionsOf / setVersions', () => {
	it('reads the whitelist, ignoring base templates and exclusions', () => {
		expect(versionsOf(['!resume', '!cv', 'backend', 'senior'])).toEqual(['backend', 'senior']);
		expect(versionsOf(['cv', '!senior'])).toEqual([]);
		expect(versionsOf(null)).toEqual([]);
	});

	it('replaces the whitelist wholesale', () => {
		expect(setVersions(['!resume', '!cv', 'backend'], ['senior'])).toEqual([
			'!resume',
			'!cv',
			'senior'
		]);
		expect(setVersions(['!resume', '!cv', 'backend'], [])).toEqual(['!resume', '!cv']);
	});

	it('keeps explicit version exclusions, which say something else', () => {
		// "never on senior" survives an edit that only picks where to appear.
		expect(setVersions(['!senior', 'backend'], ['staff'])).toEqual(['!senior', 'staff']);
	});

	it('drops blanks rather than writing an empty tag', () => {
		expect(setVersions(null, ['  backend  ', '', '   '])).toEqual(['backend']);
	});

	it('round-trips', () => {
		const tags = setVersions(['!resume', '!cv'], ['backend', 'senior']);
		expect(versionsOf(tags)).toEqual(['backend', 'senior']);
		expect(isProfileOnly(tags)).toBe(true);
	});
});

describe('renameTagSlug', () => {
	it('follows a version rename', () => {
		expect(renameTagSlug(['!resume', '!cv', 'app-45'], 'app-45', 'enexis')).toEqual([
			'!resume',
			'!cv',
			'enexis'
		]);
	});

	it('drops the tag when the version is gone', () => {
		expect(renameTagSlug(['!resume', '!cv', 'app-45'], 'app-45', null)).toEqual(['!resume', '!cv']);
		// Nothing else survived it, so the item goes back to untagged.
		expect(renameTagSlug(['app-45'], 'app-45', null)).toEqual([]);
	});

	it('keeps a negation negated', () => {
		// "never on this one" and "only on this one" are different statements, and
		// renaming the version is not the place to swap one for the other.
		expect(renameTagSlug(['!senior', 'backend'], 'senior', 'staff')).toEqual(['!staff', 'backend']);
		expect(renameTagSlug(['!senior'], 'senior', null)).toEqual([]);
	});

	it('matches the way every other tag reader does', () => {
		// tagSlug semantics: case-insensitive, whitespace-tolerant.
		expect(renameTagSlug([' App-45 '], 'app-45', 'enexis')).toEqual(['enexis']);
		expect(renameTagSlug(['app-45'], ' APP-45 ', 'enexis')).toEqual(['enexis']);
	});

	it('leaves everything it was not asked about alone', () => {
		expect(renameTagSlug(['!resume', 'backend'], 'app-45', 'enexis')).toEqual([
			'!resume',
			'backend'
		]);
		expect(renameTagSlug(null, 'app-45', 'enexis')).toEqual([]);
		// An empty needle would otherwise match every tag and rename the lot.
		expect(renameTagSlug(['backend'], '  ', null)).toEqual(['backend']);
	});
});
