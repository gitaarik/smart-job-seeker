import { beforeEach, describe, expect, test, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/svelte';
import EducationSection from './EducationSection.svelte';
import type { Education } from '$lib/server/resume/types';

/**
 * Open state belongs to the row, not to its position.
 *
 * These sections tracked open rows in a `Set<number>` of array indices, and
 * removing a row rebuilt the array without touching the set. Delete the middle
 * of three and every row after it shifts down one while the set does not, so
 * the row that was open collapses and its neighbour opens instead. Nothing
 * throws; it reads as the form losing your place mid-edit, on the one screen
 * where somebody is transcribing their own history into a dozen fields.
 *
 * Driven through the DOM rather than by calling the component's internals,
 * because what was wrong is which row the template renders open.
 */

beforeEach(() => {
	vi.stubGlobal('confirm', () => true);
});

/**
 * `$state`, because the caller's is: StepReview holds the whole wizard draft in
 * one. It matters here — Svelte proxies an object on its way into state, so a
 * row read out of a plain array and the same row read after a `$bindable` write
 * has passed through the parent are two different references, and nothing keyed
 * by the row would survive the round trip. Inside state, reads are proxies
 * throughout and identity holds.
 */
function threeDegrees(): Education[] {
	const education = $state([
		{ institution: 'Alpha University', area: 'History' },
		{ institution: 'Beta College', area: 'Physics' },
		{ institution: 'Gamma Institute', area: 'Chemistry' }
	]);
	return education;
}

/** The section renders collapsed; its header opens the list. */
async function renderOpen(education: Education[]) {
	const { container } = render(EducationSection, { education });
	await fireEvent.click(screen.getByText('Education'));
	return container;
}

/**
 * The institution of every row currently expanded.
 *
 * Only an expanded row renders inputs, and the institution is the first of
 * them, so this is "which rows are open" in the terms the test cares about.
 */
function openRows(container: HTMLElement): string[] {
	return [...container.querySelectorAll('label')]
		.filter((label) => label.textContent?.trim() === 'Institution')
		.map((label) => (label.parentElement?.querySelector('input') as HTMLInputElement).value);
}

/** Rows render in array order, and so do their Remove buttons. */
function removeRow(container: HTMLElement, position: number) {
	const buttons = container.querySelectorAll('[aria-label="Remove"]');
	return fireEvent.click(buttons[position]);
}

describe('EducationSection', () => {
	test('the row that was open stays open when an earlier row is removed', async () => {
		const container = await renderOpen(threeDegrees());

		await fireEvent.click(screen.getByText(/Gamma Institute/));
		expect(openRows(container)).toEqual(['Gamma Institute']);

		// Beta sat between the open row and the top of the list. Under index
		// keying this left the set pointing at Gamma's old position, which Gamma
		// no longer occupies.
		await removeRow(container, 1);

		expect(screen.queryByText(/Beta College/)).toBeNull();
		expect(openRows(container)).toEqual(['Gamma Institute']);
	});

	test('removing the open row closes it rather than opening its neighbour', async () => {
		const container = await renderOpen(threeDegrees());

		await fireEvent.click(screen.getByText(/Beta College/));
		expect(openRows(container)).toEqual(['Beta College']);

		await removeRow(container, 1);

		expect(openRows(container)).toEqual([]);
	});

	test('a newly added entry is the one that opens', async () => {
		const container = await renderOpen(threeDegrees());

		await fireEvent.click(screen.getByText('Add education'));

		// One row open, and it is the new empty one rather than any of the three.
		expect(openRows(container)).toEqual(['']);
	});

	test('typing into an open row edits that row', async () => {
		const education = threeDegrees();
		const container = await renderOpen(education);

		await fireEvent.click(screen.getByText(/Gamma Institute/));
		const input = [...container.querySelectorAll('input')].find(
			(el) => (el as HTMLInputElement).value === 'Gamma Institute'
		) as HTMLInputElement;
		await fireEvent.input(input, { target: { value: 'Gamma University' } });

		// The binding goes through the row object now, not through the index.
		expect(education[2].institution).toBe('Gamma University');
		expect(education[0].institution).toBe('Alpha University');
	});
});
