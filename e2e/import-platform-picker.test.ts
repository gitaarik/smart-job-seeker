import { describe, expect, it, beforeAll } from 'vitest';
import { loginViaUI, useBrowser } from './browser';

/**
 * The site picker on the add-import-task form, in a real browser.
 *
 * The unit tests cover the picker's logic against jsdom. These cover what
 * jsdom cannot: that the thing is reachable and usable on the actual page.
 * Two of the three bugs found while building it were of that kind — a
 * programmatic refocus reopening the list, and an option list that renders but
 * sits behind the field below it — and neither is visible from a render test.
 */
describe('import task site picker', () => {
	const ctx = useBrowser();

	beforeAll(async () => {
		await loginViaUI(ctx.page);
		await ctx.page.goto('/jobs/import/tasks');
		await ctx.page.getByRole('button', { name: /Add Import/ }).click();
	});

	it('opens the list and filters by what you type', async () => {
		const site = ctx.page.getByRole('combobox', { name: 'Site' });
		await site.click();

		const list = ctx.page.getByRole('listbox', { name: 'Sites' });
		await expect.poll(() => list.isVisible()).toBe(true);

		await site.fill('linked');
		await expect
			.poll(() => list.getByRole('option').filter({ hasText: 'LinkedIn' }).count())
			.toBeGreaterThan(0);
		await expect.poll(() => list.getByRole('option').filter({ hasText: 'Indeed' }).count()).toBe(0);
	});

	it('finds a site we already have when you type its URL', async () => {
		const site = ctx.page.getByRole('combobox', { name: 'Site' });
		await site.click();
		await site.fill('linkedin.com');

		const list = ctx.page.getByRole('listbox', { name: 'Sites' });
		await expect
			.poll(() => list.getByRole('option').filter({ hasText: 'LinkedIn' }).count())
			.toBeGreaterThan(0);
	});

	it('picks a site with the keyboard and keeps it on screen', async () => {
		const site = ctx.page.getByRole('combobox', { name: 'Site' });
		await site.click();
		await site.fill('linked');
		await site.press('Enter');

		// The list closes and the field shows the choice. It reopened here
		// before the refocus guard, which also blanked the field.
		await expect.poll(() => site.inputValue()).toBe('LinkedIn');
		await expect
			.poll(() => ctx.page.getByRole('listbox', { name: 'Sites' }).isVisible())
			.toBe(false);
	});

	it('drops the list over the fields below rather than behind them', async () => {
		// An absolutely-positioned list inside a form of stacked inputs is the
		// classic z-index bug, and it is invisible to a render test: the
		// markup is correct either way.
		const site = ctx.page.getByRole('combobox', { name: 'Site' });
		await site.click();

		const list = ctx.page.getByRole('listbox', { name: 'Sites' });
		const box = await list.boundingBox();
		expect(box).not.toBeNull();

		const midpoint = { x: box!.x + box!.width / 2, y: box!.y + box!.height / 2 };
		const onTop = await ctx.page.evaluate(
			({ x, y }) => document.elementFromPoint(x, y)?.closest('[role="listbox"]') !== null,
			midpoint
		);
		expect(onTop).toBe(true);
	});

	it('turns a search that matches nothing into the add-a-site form', async () => {
		const site = ctx.page.getByRole('combobox', { name: 'Site' });
		await site.click();
		await site.fill('acme.example.com');

		const list = ctx.page.getByRole('listbox', { name: 'Sites' });
		await list
			.getByRole('option')
			.filter({ hasText: /as a new site/ })
			.click();

		// What was typed carries into the URL field, so searching for a board
		// we do not have is the first step of adding it.
		await expect
			.poll(() => ctx.page.getByLabel(/Job search URL/).inputValue())
			.toBe('https://acme.example.com');
		await expect.poll(() => ctx.page.getByLabel(/Site name/).isVisible()).toBe(true);
		// The form deliberately asks nothing about signing in (b2250ab8): that
		// lives on the task page, where the user can actually answer it.
		expect(await ctx.page.getByLabel(/Login page URL/).count()).toBe(0);
	});
});
