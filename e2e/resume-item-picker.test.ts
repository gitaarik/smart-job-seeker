/**
 * Browser E2E for the "What's on it" panel.
 *
 * The panel is the only place an item nothing decided about can be reached: no
 * pass surfaced it and no pass dropped it, so it has no row in the diff, and
 * the alternative was editing tags on the profile — which changes every job
 * that uses the version.
 *
 * Its other job is the one worth testing hardest: a toggle on a plain library
 * version creates this application's own version and records it. That is the
 * whole "start from a pre-made version and adjust it" flow, and it is three
 * writes deep on the server where nothing else would notice it breaking.
 *
 * Prerequisites: dev stack up, test user seeded (see browser.test.ts).
 *
 * Run: npm run test:e2e
 */

import { describe, expect, it } from 'vitest';
import { loginViaUI, useBrowser } from './browser';

const APP_ID = 16;

describe('what is on it', () => {
	const b = useBrowser();
	/** The item the round-trip test moves, named by its aria-label. */
	let moved: string | null = null;

	it('says nothing while no document is chosen', async () => {
		await loginViaUI(b.page);
		await b.page.goto(`/applications/${APP_ID}/resume`);
		await b.page.waitForLoadState('networkidle');

		// Back to nothing: no version for this job, no record.
		if (await b.page.getByRole('button', { name: /^Delete$/ }).count()) {
			await b.page.getByRole('button', { name: /^Delete$/ }).click();
			await b.page.getByRole('button', { name: /Delete it/ }).click();
			await b.page.waitForLoadState('networkidle');
		}
		if (await b.page.getByRole('button', { name: /Clear this record/ }).count()) {
			await b.page.getByRole('button', { name: /Clear this record/ }).click();
			await b.page.getByRole('button', { name: /^Clear$/ }).click();
			await b.page.waitForLoadState('networkidle');
		}

		// There is no document to describe, so the panel stays away.
		expect(await b.page.getByRole('button', { name: /What's on it/ }).count()).toBe(0);
	});

	it('describes the library version you record', async () => {
		await b.page.getByRole('button', { name: /Or send one of my versions as it is/ }).click();
		await b.page.getByLabel('Version to send').selectOption({ index: 1 });
		await b.page.getByRole('button', { name: /^Set$/ }).click();
		await b.page.waitForLoadState('networkidle');

		const opener = b.page.getByRole('button', { name: /What's on it/ });
		await opener.waitFor({ state: 'visible' });
		expect(await opener.innerText()).toMatch(/\d+ of \d+ items/);
		await opener.click();
		// A row per item, plus one per role for the role itself.
		expect(await b.page.locator('form[action="?/setItemState"]').count()).toBeGreaterThan(1);
	});

	it("makes the version this job's own on the first toggle", async () => {
		const first = b.page.locator('button[aria-label^="Hide "]').first();
		moved = await first.getAttribute('aria-label');
		await first.click();
		await b.page.waitForLoadState('networkidle');

		// Editing what a document shows for one job IS tailoring it, so the record
		// follows — the same way generating one does.
		await b.page.getByText('· tailored for this job').waitFor({ state: 'visible', timeout: 20000 });
		expect(
			await b.page.locator(`button[aria-label="${moved?.replace('Hide ', 'Show ')}"]`).count()
		).toBe(1);
		expect(await b.page.getByText('· yours').count()).toBe(1);
	});

	it('drops the override when an item goes back to what the base says', async () => {
		const back = b.page.locator(`button[aria-label="${moved?.replace('Hide ', 'Show ')}"]`);
		await back.click();
		await b.page.waitForLoadState('networkidle');
		await b.page.locator(`button[aria-label="${moved}"]`).waitFor({ state: 'visible' });
		// The sidecar is a diff: agreeing with the base means no row at all, which
		// is what leaves a later regeneration free to decide about it again.
		expect(await b.page.getByText('· yours').count()).toBe(0);
	});

	it('turns a whole role off and on, which tailoring itself may not', async () => {
		const off = b.page.getByRole('button', { name: /Leave this role off/ }).first();
		await off.click();
		await b.page.waitForLoadState('networkidle');
		const back = b.page.getByRole('button', { name: /Put this role on/ }).first();
		await back.waitFor({ state: 'visible' });
		expect(await b.page.getByText(/nothing under it prints until the role does/).count()).toBe(1);

		await back.click();
		// Waiting for "Leave this role off" would prove nothing — the other roles
		// have one. Wait for the offer to put THIS one back to go away.
		await back.waitFor({ state: 'detached' });
		expect(await b.page.getByText(/nothing under it prints until the role does/).count()).toBe(0);
	});
});
