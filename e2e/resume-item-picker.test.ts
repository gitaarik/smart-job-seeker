/**
 * Browser E2E for the "What's on it" section.
 *
 * The section is the only place an item nothing decided about can be reached:
 * no pass surfaced it and no pass dropped it, so it has no row in the diff, and
 * the alternative was editing tags on the profile — which changes every job
 * that uses the version. For skills that is nearly all of them, since a run only
 * reaches the ones a job requires.
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
import { commitPickedVersion, loginViaUI, useBrowser } from './browser';
import type { Page } from 'patchright';

const APP_ID = 16;

/**
 * One part of the list, by its heading. The last match is the innermost, so a
 * page-level section that happens to contain the heading doesn't win.
 */
const section = (page: Page, title: string) =>
	page
		.locator('section')
		.filter({ has: page.getByRole('heading', { name: title, exact: true }) })
		.last();

describe('what is on it', () => {
	const b = useBrowser();
	/** The item the round-trip test moves, named by its aria-label. */
	let moved: string | null = null;

	it('says nothing while no document is chosen', async () => {
		await loginViaUI(b.page);
		await b.page.goto(`/applications/${APP_ID}/resume`);
		await b.page.waitForLoadState('networkidle');

		// Back to nothing: no version for this job, no record. Only reached when
		// an earlier file left one, as resume-card.test.ts does.
		//
		// Each step waits for its own button to go, not for the network: the
		// network is idle a beat before the enhance-driven re-render lands, and
		// deleting the job's version takes the record with it. Waiting on
		// `networkidle` found "Clear this record" still on screen, clicked it as
		// the re-render removed it, and timed out every test after this one.
		const del = b.page.getByRole('button', { name: /^Delete$/ });
		if (await del.count()) {
			await del.click();
			await b.page.getByRole('button', { name: /Delete it/ }).click();
			await del.waitFor({ state: 'detached' });
		}
		const clear = b.page.getByRole('button', { name: /Clear this record/ });
		if (await clear.count()) {
			await clear.click();
			await b.page.getByRole('button', { name: /^Clear$/ }).click();
			await clear.waitFor({ state: 'detached' });
		}

		// There is no document to describe, so the section stays away.
		expect(await b.page.getByRole('heading', { name: "What's on it" }).count()).toBe(0);
	});

	it('describes the library version you record', async () => {
		await b.page.getByRole('button', { name: /Or send one of my versions as it is/ }).click();
		await b.page.getByLabel('Version to send').selectOption({ index: 1 });
		await commitPickedVersion(b.page);

		await b.page.getByRole('heading', { name: "What's on it" }).waitFor({ state: 'visible' });
		expect(await b.page.getByText(/\d+ of \d+ items print/).isVisible()).toBe(true);
		// A row per item, plus one per role and skill group for the group itself.
		expect(await b.page.locator('form[action="?/setItemState"]').count()).toBeGreaterThan(1);
	});

	it("makes the version this job's own on the first toggle", async () => {
		// Roles start folded; a bullet is the item with the most to say about itself.
		const experience = section(b.page, 'Experience');
		await experience.locator('button[aria-expanded="false"]').first().click();
		const first = experience.locator('button[aria-label^="Hide "]').first();
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

	// Putting an item back used to delete the row, so the next regeneration was
	// free to hide it again. It is the applicant's choice now, and the changes
	// view tells it apart from a change.
	it('keeps putting an item back as your choice, without calling it a change', async () => {
		const back = b.page.locator(`button[aria-label="${moved?.replace('Hide ', 'Show ')}"]`);
		await back.click();
		await b.page.waitForLoadState('networkidle');
		await b.page.locator(`button[aria-label="${moved}"]`).waitFor({ state: 'visible' });
		expect(await b.page.getByText('· yours').count()).toBe(1);

		await b.page.getByRole('tab', { name: /Changes/ }).click();
		await b.page.getByText('Put back the way it was').waitFor({ state: 'visible' });
		// A string, not a regex: only string matches collapse the line break after the count.
		expect(await b.page.getByText('0 changes against').count()).toBe(1);

		await b.page.getByRole('tab', { name: /Everything/ }).click();
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

	// A run never reaches a skill the job doesn't require, and hiding one used to
	// ask the run's candidate list whether the base printed it, which said no for
	// every such skill and saved nothing at all.
	it('hides and shows a skill for this job', async () => {
		const chip = section(b.page, 'Skills').locator('button[aria-pressed="true"]').first();
		const label = await chip.getAttribute('aria-label');
		expect(label).toMatch(/^Hide /);

		await chip.click();
		// First, because a skill can sit in two groups under one name.
		const shown = b.page
			.locator(`button[aria-label="${label?.replace('Hide ', 'Show ')}"]`)
			.first();
		await shown.waitFor({ state: 'visible' });

		await shown.click();
		await b.page.locator(`button[aria-label="${label}"]`).first().waitFor({ state: 'visible' });
	});
});
