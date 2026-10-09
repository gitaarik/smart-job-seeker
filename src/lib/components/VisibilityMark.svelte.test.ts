import { describe, expect, test } from 'vitest';
import { render } from '@testing-library/svelte';
import VisibilityMark from './VisibilityMark.svelte';

/**
 * The mark on a skill or technology chip, read off its title: the only part
 * of it that says in words what the icon means.
 */
function markFor(tags: string[] | null): string | null {
	const { container } = render(VisibilityMark, { props: { tags } });
	return container.querySelector('[title]')?.getAttribute('title') ?? null;
}

describe('VisibilityMark', () => {
	test('says nothing about an item on every template', () => {
		expect(markFor(null)).toBeNull();
		expect(markFor([])).toBeNull();
		// A version tag is the Versions badge's business, not this mark's.
		expect(markFor(['!citrus', 'backend'])).toBeNull();
	});

	test('names what an item is held back from when it is off only some of them', () => {
		expect(markFor(['!portfolio'])).toBe('Not on the site');
		expect(markFor(['!cv'])).toBe('Not on the CV');
		expect(markFor(['!resume', '!portfolio', '!citrus'])).toBe('Not on the resume or the site');
		// The whitelist form the old tag popup could write: on the CV and nowhere else.
		expect(markFor(['cv'])).toBe('Not on the resume or the site');
	});

	test('keeps the profile-only mark for an item off both documents', () => {
		expect(markFor(['!resume', '!cv'])).toBe(
			'Profile-only — counts for matching, not shown on documents'
		);
		expect(markFor(['!resume', '!cv', '!portfolio'])).toBe(
			'Profile-only — counts for matching, not shown on documents or the site'
		);
	});
});
