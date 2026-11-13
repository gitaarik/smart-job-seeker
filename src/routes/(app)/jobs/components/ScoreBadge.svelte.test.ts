import { describe, expect, test } from 'vitest';
import { render, screen } from '@testing-library/svelte';
import ScoreBadge from './ScoreBadge.svelte';

/**
 * The early badge: a thin profile's score (`isThinProfile`) keeps its number
 * but loses the red to green, so 32 does not read as "not for you" when the
 * profile simply has nothing to match on yet.
 */
describe('ScoreBadge', () => {
	test('a score is a match, coloured by the gradient', () => {
		render(ScoreBadge, { score: 32, matched: true });
		expect(screen.getByText('32%')).toBeTruthy();
		const badge = screen.getByText('Match').parentElement!;
		expect(badge.getAttribute('style')).not.toContain('var(--dash-bg)');
		expect(badge.getAttribute('title')).toBeNull();
	});

	test('an early score keeps the number, in neutral, and says why', () => {
		render(ScoreBadge, { score: 32, matched: true, early: true });
		expect(screen.getByText('32%')).toBeTruthy();
		expect(screen.queryByText('Match')).toBeNull();
		const badge = screen.getByText('Early').parentElement!;
		expect(badge.getAttribute('style')).toContain('var(--dash-bg)');
		expect(badge.getAttribute('title')).toContain('no work history');
	});

	test('early changes nothing for a job without a score', () => {
		render(ScoreBadge, { score: null, matched: false, early: true });
		expect(screen.getByText('New')).toBeTruthy();
		expect(screen.queryByText('Early')).toBeNull();
	});
});
