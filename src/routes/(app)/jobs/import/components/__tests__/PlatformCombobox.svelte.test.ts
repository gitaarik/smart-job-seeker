import { describe, expect, test, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/svelte';
import PlatformCombobox, { type ComboboxPlatform } from '../PlatformCombobox.svelte';
import { CUSTOM_PLATFORM_ID } from '$lib/import-tasks/custom-site';

const platforms: ComboboxPlatform[] = [
	{
		id: 16,
		key: 'linkedin',
		name: 'LinkedIn',
		url: 'https://www.linkedin.com/',
		search_page_url: 'https://www.linkedin.com/jobs/search/'
	},
	{
		id: 21,
		key: 'indeed',
		name: 'Indeed',
		url: 'https://nl.indeed.com/',
		search_page_url: 'https://nl.indeed.com/jobs'
	},
	{
		id: 30,
		key: 'sveltejobs',
		name: 'SvelteJobs',
		url: 'https://sveltejobs.dev/',
		search_page_url: null
	}
];

function setup(value: number | null = 16) {
	const onCustom = vi.fn();
	render(PlatformCombobox, { platforms, value, onCustom, id: 'site' });
	const input = screen.getByRole('combobox') as HTMLInputElement;
	return { input, onCustom };
}

/** Option labels in render order, excluding the group headings. */
function optionNames(): string[] {
	return screen
		.getAllByRole('option')
		.map((o) => (o.textContent ?? '').replace(/\s+/g, ' ').trim());
}

describe('PlatformCombobox', () => {
	test('shows the current selection when closed', () => {
		const { input } = setup(16);
		expect(input.value).toBe('LinkedIn');
		expect(input.getAttribute('aria-expanded')).toBe('false');
	});

	test('opens on focus and lists every platform', async () => {
		const { input } = setup();
		await fireEvent.focus(input);

		expect(input.getAttribute('aria-expanded')).toBe('true');
		const names = optionNames();
		expect(names.some((n) => n.startsWith('LinkedIn'))).toBe(true);
		expect(names.some((n) => n.startsWith('Indeed'))).toBe(true);
		expect(names.some((n) => n.startsWith('SvelteJobs'))).toBe(true);
	});

	test('filters as you type', async () => {
		const { input } = setup();
		await fireEvent.focus(input);
		await fireEvent.input(input, { target: { value: 'indee' } });

		const names = optionNames();
		expect(names.some((n) => n.startsWith('Indeed'))).toBe(true);
		expect(names.some((n) => n.startsWith('LinkedIn'))).toBe(false);
	});

	test('matches on hostname, so typing a URL finds the site we already have', async () => {
		// The point of the whole feature: someone about to add LinkedIn by hand
		// types linkedin.com, and we tell them it exists before they do the work.
		const { input } = setup();
		await fireEvent.focus(input);
		await fireEvent.input(input, { target: { value: 'https://www.linkedin.com' } });

		expect(optionNames().some((n) => n.startsWith('LinkedIn'))).toBe(true);
	});

	test('keeps the create row available even when the search matches something', async () => {
		// "No matches" is not the only time you want it: a search can match
		// several sites and still not contain yours.
		const { input } = setup();
		await fireEvent.focus(input);
		await fireEvent.input(input, { target: { value: 'in' } });

		const names = optionNames();
		expect(names.some((n) => n.startsWith('LinkedIn'))).toBe(true);
		expect(names.some((n) => /Add .* as a new site/.test(n))).toBe(true);
	});

	test('separates listing pages from sites we can search', async () => {
		const { input } = setup();
		await fireEvent.focus(input);

		expect(screen.getByText('Sites we can search')).toBeDefined();
		expect(screen.getByText('Listing pages (imported as-is)')).toBeDefined();
	});

	test('selecting a platform closes the list and shows the name', async () => {
		const { input } = setup(16);
		await fireEvent.focus(input);
		await fireEvent.input(input, { target: { value: 'indeed' } });
		await fireEvent.click(screen.getAllByRole('option')[0]);

		expect(input.value).toBe('Indeed');
		expect(input.getAttribute('aria-expanded')).toBe('false');
	});

	test('the create row reports what was typed', async () => {
		const { input, onCustom } = setup();
		await fireEvent.focus(input);
		await fireEvent.input(input, { target: { value: 'acme.example.com' } });
		const create = screen
			.getAllByRole('option')
			.find((o) => /as a new site/.test(o.textContent ?? ''));
		await fireEvent.click(create!);

		expect(onCustom).toHaveBeenCalledWith('acme.example.com');
		expect(input.value).toBe('A site we don’t have yet');
	});

	test('arrow keys and Enter pick without the mouse', async () => {
		const { input } = setup(16);
		await fireEvent.focus(input);
		await fireEvent.input(input, { target: { value: 'e' } });
		await fireEvent.keyDown(input, { key: 'ArrowDown' });
		await fireEvent.keyDown(input, { key: 'Enter' });

		expect(input.getAttribute('aria-expanded')).toBe('false');
		// Whatever it landed on, it committed a real platform rather than the
		// create row, which is what a keyboard user expects from the second item.
		expect(input.value).not.toBe('A site we don’t have yet');
		expect(input.value.length).toBeGreaterThan(0);
	});

	test('ArrowUp from the top reaches the create row in one press', async () => {
		const { input, onCustom } = setup();
		await fireEvent.focus(input);
		await fireEvent.keyDown(input, { key: 'ArrowUp' });
		await fireEvent.keyDown(input, { key: 'Enter' });

		expect(onCustom).toHaveBeenCalled();
	});

	test('Enter on a search that matches nothing adds the site rather than doing nothing', async () => {
		const { input, onCustom } = setup();
		await fireEvent.focus(input);
		await fireEvent.input(input, { target: { value: 'no-such-board-anywhere' } });
		await fireEvent.keyDown(input, { key: 'Enter' });

		expect(onCustom).toHaveBeenCalledWith('no-such-board-anywhere');
	});

	test('Escape abandons the search without changing the selection', async () => {
		const { input } = setup(16);
		await fireEvent.focus(input);
		await fireEvent.input(input, { target: { value: 'indeed' } });
		await fireEvent.keyDown(input, { key: 'Escape' });

		expect(input.getAttribute('aria-expanded')).toBe('false');
		expect(input.value).toBe('LinkedIn');
	});

	test('Enter does not swallow form submission when the list is closed', async () => {
		// The picker sits inside the add form. Preventing Enter unconditionally
		// would stop the form submitting from any other field.
		const { input } = setup(16);
		const event = new KeyboardEvent('keydown', {
			key: 'Enter',
			bubbles: true,
			cancelable: true
		});
		input.dispatchEvent(event);

		expect(event.defaultPrevented).toBe(false);
	});

	test('exports the sentinel the form uses for a brand-new site', () => {
		expect(CUSTOM_PLATFORM_ID).toBe(-1);
	});
});
