import { describe, expect, it } from 'vitest';
import {
	heldBackByTemplate,
	isHiddenFromDocuments,
	setShownOn,
	shownTemplates,
	renameTagSlug,
	setProfileOnly,
	setVersions,
	versionsOf
} from './profile-visibility';

describe('isHiddenFromDocuments', () => {
	it('needs both base templates excluded', () => {
		expect(isHiddenFromDocuments(['!resume', '!cv'])).toBe(true);
		expect(isHiddenFromDocuments(['!resume'])).toBe(false);
		expect(isHiddenFromDocuments(['!cv'])).toBe(false);
		expect(isHiddenFromDocuments([])).toBe(false);
		expect(isHiddenFromDocuments(null)).toBe(false);
	});

	it('ignores the site: an item can be published and still off the documents', () => {
		// The state the three switches exist to make pickable. `!portfolio` says
		// nothing about whether a resume may print the item.
		expect(isHiddenFromDocuments(['!resume', '!cv', '!portfolio'])).toBe(true);
		expect(isHiddenFromDocuments(['!resume', '!cv', 'portfolio'])).toBe(true);
		expect(isHiddenFromDocuments(['!portfolio'])).toBe(false);
	});

	it('ignores casing, whitespace and per-version tags', () => {
		expect(isHiddenFromDocuments(['!Resume', ' !CV ', 'backend'])).toBe(true);
	});
});

describe('setProfileOnly', () => {
	it('adds both exclusions and drops contradictory positives', () => {
		// A `cv` whitelist was already keeping the item off the site, so writing
		// the state out says so rather than leaving it implied. What the item
		// shows on does not change.
		expect(setProfileOnly(['cv'], true)).toEqual(['!resume', '!cv', '!portfolio']);
		expect(setProfileOnly(null, true)).toEqual(['!resume', '!cv']);
	});

	it('leaves the site as it found it', () => {
		// The documents are its business; a published item stays published.
		expect(setProfileOnly(['!portfolio'], true)).toEqual(['!resume', '!cv', '!portfolio']);
		expect(setProfileOnly(['!resume', '!cv', '!portfolio'], false)).toEqual(['!portfolio']);
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
		expect(isHiddenFromDocuments(on)).toBe(true);
		expect(isHiddenFromDocuments(setProfileOnly(on, false))).toBe(false);
	});
});

describe('setShownOn / shownTemplates', () => {
	it('reads which templates an item appears on', () => {
		expect(shownTemplates(null)).toEqual(['resume', 'cv', 'portfolio']);
		expect(shownTemplates(['!portfolio'])).toEqual(['resume', 'cv']);
		expect(shownTemplates(['cv'])).toEqual(['cv']);
		expect(shownTemplates(['!resume', '!cv', '!portfolio'])).toEqual([]);
	});

	it('flips one template without disturbing the others', () => {
		expect(shownTemplates(setShownOn(null, 'portfolio', false))).toEqual(['resume', 'cv']);
		expect(shownTemplates(setShownOn(['!resume'], 'cv', false))).toEqual(['portfolio']);
		expect(shownTemplates(setShownOn(['!resume', '!cv'], 'resume', true))).toEqual([
			'resume',
			'portfolio'
		]);
	});

	// The switch has to move even when the item says where it belongs with a
	// positive whitelist rather than with exclusions.
	it('moves a whitelisted item onto another template', () => {
		expect(shownTemplates(setShownOn(['cv'], 'portfolio', true))).toEqual(['cv', 'portfolio']);
		expect(setShownOn(['cv'], 'portfolio', true)).toEqual(['!resume']);
	});

	it('keeps version tags through a flip', () => {
		expect(setShownOn(['backend', '!senior'], 'portfolio', false)).toEqual([
			'!portfolio',
			'backend',
			'!senior'
		]);
	});

	it('says nothing at all when the item is on every template', () => {
		expect(setShownOn(['!portfolio'], 'portfolio', true)).toEqual([]);
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
		expect(isHiddenFromDocuments(tags)).toBe(true);
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

describe('heldBackByTemplate', () => {
	it('separates a template rule from a version tag', () => {
		// "CV only" is about the document type and no single job revisits it.
		expect(heldBackByTemplate(['cv'], 'resume')).toBe(true);
		expect(heldBackByTemplate(['!resume'], 'resume')).toBe(true);
		// "only on my Django versions" is about emphasis, which is exactly what
		// tailoring is allowed to revisit.
		expect(heldBackByTemplate(['fullstack-django'], 'resume')).toBe(false);
		expect(heldBackByTemplate(null, 'resume')).toBe(false);
	});

	it('does not read profile-only as a template rule', () => {
		// !resume + !cv means "kept for matching, off all documents" — the state a
		// version tag exists to re-admit from, and the one surfacing is for.
		expect(heldBackByTemplate(['!resume', '!cv'], 'resume')).toBe(false);
		expect(heldBackByTemplate(['!resume', '!cv', 'senior'], 'cv')).toBe(false);
	});

	it('answers per template', () => {
		expect(heldBackByTemplate(['cv'], 'cv')).toBe(false);
		expect(heldBackByTemplate(['resume'], 'cv')).toBe(true);
		expect(heldBackByTemplate(['resume', 'cv'], 'cv')).toBe(false);
	});
});
