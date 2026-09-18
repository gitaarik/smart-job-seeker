/**
 * Slugs a version may not take, because something else already answers to them.
 *
 * Both collisions here are silent by nature: the wrong document is sent, or a
 * version's whitelist matches nothing, and neither raises. The predicate is the
 * only thing standing between a typed name and that, so it is worth pinning
 * rather than assuming.
 */

import { describe, expect, it } from 'vitest';
import { isReservedVersionSlug } from '../version-overrides';
import { BASE_TEMPLATE_TAGS } from '../profile-visibility';

describe('isReservedVersionSlug', () => {
	it('reserves the job-tailored namespace', () => {
		expect(isReservedVersionSlug('app-45')).toBe(true);
		expect(isReservedVersionSlug('app-45-2')).toBe(true);
		// A name that merely starts with the letters is not the namespace.
		expect(isReservedVersionSlug('apprenticeship')).toBe(false);
		expect(isReservedVersionSlug('app-lead')).toBe(false);
	});

	it('reserves every base template name', () => {
		for (const tag of BASE_TEMPLATE_TAGS) expect(isReservedVersionSlug(tag)).toBe(true);
		// The one that arrived with the public site, named explicitly: a version
		// slugged `portfolio` could not be addressed by tag at all, because the
		// tag would read as the template.
		expect(isReservedVersionSlug('portfolio')).toBe(true);
	});

	it('ignores casing and surrounding whitespace, as the tag readers do', () => {
		expect(isReservedVersionSlug('  Portfolio ')).toBe(true);
		expect(isReservedVersionSlug('CV')).toBe(true);
		expect(isReservedVersionSlug('APP-7')).toBe(true);
	});

	it('leaves ordinary version names alone', () => {
		for (const slug of ['frontend', 'senior', 'fullstack-django', 'base', 'portfolio-2024']) {
			expect(isReservedVersionSlug(slug)).toBe(false);
		}
	});
});
