/**
 * Browser E2E — the achievement edit popup saves as it is typed.
 *
 * The section header has said "Saves as you type" since the rows moved to
 * per-row saves, and the translation tabs inside the popup did; the English
 * text beside them waited for Done, and Escape threw it away. Now every
 * keystroke reaches the row's store and the popup carries the row's own status
 * pill. What only a real page can show: the draft is created mid-edit (the
 * language tabs appear once the row has an id), the pill inside the modal
 * reports the save with no Done pressed, Escape keeps what was typed, and an
 * Undo taken inside the popup reverts the text on screen, not just on the
 * server.
 *
 * Mutating, and cleaning up after itself: it adds one achievement to the test
 * user's first role, deletes it again through the same UI, and sweeps the
 * database for anything an earlier failed run left behind.
 *
 * Prerequisites: dev stack running, test user seeded (see browser.test.ts).
 */
import { execSync } from 'child_process';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { loginViaUI, useBrowser } from './browser';

const FIELD = 'textarea[placeholder="Describe your achievement..."]';
const PREFIX = 'E2E autosave probe';
const TEXT = `${PREFIX} ${Date.now()}`;
const ROWS = '/api/profile-section/work_experience_achievement';

describe('achievement popup auto-save', () => {
	const b = useBrowser();
	/** The open popup — portalToBody moves it to <body> under this class. */
	const modal = () => b.page.locator('.app-modal-portaled');

	beforeAll(async () => {
		await loginViaUI(b.page);
		await b.page.goto('/profile/work-experience');
		await b.page.waitForLoadState('networkidle');
		await b.page.locator('a[href^="/profile/work-experience/"]').first().click();
		await b.page.waitForURL(/\/profile\/work-experience\/\d+$/);
		await b.page.waitForLoadState('networkidle');
	});

	afterAll(() => {
		execSync(
			`docker compose exec -T database psql -U postgres -d smartjobseeker -qc ` +
				`"DELETE FROM work_experience_achievements WHERE description LIKE '${PREFIX} %'"`,
			{ cwd: process.env.SJS_CLOUD_DIR || `${process.cwd()}/..`, stdio: 'ignore' }
		);
	});

	it('creates the row while typing, says so in the popup, and keeps it on Escape', async () => {
		const writes: string[] = [];
		b.page.on('request', (r) => {
			if (r.url().includes(ROWS) && r.method() !== 'GET') writes.push(r.method());
		});

		await b.page.getByRole('button', { name: 'Add Achievement' }).click();
		const field = b.page.locator(FIELD);
		await field.waitFor({ state: 'visible', timeout: 10000 });
		// A draft has no id yet, so nothing to translate.
		expect(await modal().getByRole('tab').count()).toBe(0);
		await modal().getByText('Saves as you type').waitFor({ state: 'visible' });

		await field.fill(TEXT);
		// No Done pressed: the pill inside the modal reports the save…
		await modal().getByText('Saved').waitFor({ state: 'visible', timeout: 10000 });
		expect(writes).toContain('POST');
		// …and the row has an id now, so the language tabs appeared mid-edit.
		await expect.poll(() => modal().getByRole('tab').count()).toBeGreaterThan(0);

		await b.page.keyboard.press('Escape');
		await field.waitFor({ state: 'hidden' });
		await b.page.reload();
		await b.page.waitForLoadState('networkidle');
		await b.page.getByText(TEXT, { exact: true }).waitFor({ state: 'visible', timeout: 10000 });
	});

	it('an edit saves as typed, and Undo inside the popup reverts it on screen', async () => {
		await b.page.getByText(TEXT, { exact: true }).click();
		const field = b.page.locator(FIELD);
		await field.waitFor({ state: 'visible', timeout: 10000 });

		await field.fill(`${TEXT} edited`);
		const undo = modal().getByRole('button', { name: 'Undo' });
		await undo.waitFor({ state: 'visible', timeout: 10000 });
		await undo.click();
		// The store reverted the row; the popup must follow, not keep the edit.
		await expect.poll(() => field.inputValue(), { timeout: 10000 }).toBe(TEXT);

		await b.page.keyboard.press('Escape');
		await field.waitFor({ state: 'hidden' });
		await b.page.reload();
		await b.page.waitForLoadState('networkidle');
		await b.page.getByText(TEXT, { exact: true }).waitFor({ state: 'visible', timeout: 10000 });
		expect(await b.page.getByText(`${TEXT} edited`).count()).toBe(0);
	});

	it('is removed again through the list, after confirming', async () => {
		// The row and the clickable text inside it share their flex classes; the
		// row is the innermost one that also holds the Remove button.
		const row = b.page
			.locator('div.flex.items-center', { has: b.page.getByText(TEXT, { exact: true }) })
			.filter({ has: b.page.getByRole('button', { name: 'Remove' }) })
			.last();
		await row.getByRole('button', { name: 'Remove' }).click();
		await b.page.getByRole('button', { name: 'Delete', exact: true }).click();
		await b.page.getByText(TEXT, { exact: true }).waitFor({ state: 'hidden', timeout: 10000 });
		await b.page.reload();
		await b.page.waitForLoadState('networkidle');
		expect(await b.page.getByText(TEXT, { exact: true }).count()).toBe(0);
	});
});
