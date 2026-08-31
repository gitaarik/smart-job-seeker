/**
 * Browser E2E for the application's resume card.
 *
 * The card is one question — "what goes to this job?" — answered in three
 * states, and most of what can break is which state renders: it used to be two
 * cards that both asked, and collapsing them put the whole page behind a set of
 * conditionals no unit test can see through.
 *
 * Nothing here generates a tailored version. Clicking "Tailor" spends a real
 * model call and replaces the test user's version, and the selection logic it
 * exercises is covered by tailoring.test.ts instead; what a browser can check
 * cheaply is that the states, their controls and their labels line up. The one
 * consequence of generating that this file cannot see — that tailoring records
 * itself — is asserted from the other side: the picker offers the tailored
 * version, and recording it produces the settled row.
 *
 * Prerequisites: dev stack up, test user seeded (see browser.test.ts). The
 * tailored version this needs is made by toggling one item in the panel, which
 * costs nothing — depending on a previous run having left one made the whole
 * file fail whenever it ran before the panel's, which deletes it.
 *
 * Run: npm run test:e2e
 */

import { describe, expect, it } from 'vitest';
import { commitPickedVersion, loginViaUI, useBrowser } from './browser';
import type { Page } from 'patchright';

const APP_ID = 16;

/**
 * Give this application a version of its own, the cheap way.
 *
 * Through the panel rather than the Tailor button: the button spends a real
 * model call, a toggle spends nothing, and both end at the same place — a
 * version owned by this application, recorded as what goes out.
 */
async function ensureTailored(page: Page) {
	if (await page.getByText('Tailored for this job', { exact: true }).count()) return;

	if (!(await page.getByRole('button', { name: /What's on it/ }).count())) {
		await page.getByRole('button', { name: /Or send one of my versions as it is/ }).click();
		await page.getByLabel('Version to send').selectOption({ index: 1 });
		await commitPickedVersion(page);
	}
	await page.getByRole('button', { name: /What's on it/ }).click();
	await page.locator('button[aria-label^="Hide "]').first().click();
	await page.getByText('· tailored for this job').waitFor({ state: 'visible', timeout: 20000 });
}

describe('resume card', () => {
	const b = useBrowser();

	it('asks once, in one card', async () => {
		await loginViaUI(b.page);
		await b.page.goto(`/applications/${APP_ID}/resume`);
		await b.page.waitForLoadState('networkidle');
		await ensureTailored(b.page);

		expect(await b.page.getByRole('heading', { name: 'Document for this job' }).isVisible()).toBe(
			true
		);
		// The tailoring panel is a section of that card now, not a card beside it.
		expect(await b.page.getByRole('heading', { name: /Tailored version/ }).count()).toBe(0);
		expect(await b.page.getByText('Tailored for this job', { exact: true }).isVisible()).toBe(true);
	});

	it('states what is being sent instead of re-asking', async () => {
		// Re-runnable: back to "a tailored version exists, nothing recorded".
		if (await b.page.getByRole('button', { name: /Clear this record/ }).count()) {
			await b.page.getByRole('button', { name: /Clear this record/ }).click();
			await b.page.getByRole('button', { name: /^Clear$/ }).click();
			await b.page.waitForLoadState('networkidle');
		}

		// Nothing recorded: the tailored section owns the way back to sending it,
		// because there is nowhere else on the page to reach it from.
		const sendThis = b.page.getByRole('button', { name: /Send this instead/ });
		await sendThis.waitFor({ state: 'visible' });

		await sendThis.click();
		await b.page.waitForLoadState('networkidle');

		// Recorded: a statement, and no picker left open asking the same question.
		// Waited for rather than snapshotted — `isVisible()` does not retry, and
		// the network goes idle a beat before the enhance-driven re-render lands.
		const row = b.page.getByText('Sending', { exact: true });
		await row.waitFor({ state: 'visible' });
		expect(await b.page.locator('p.truncate').first().innerText()).toContain(
			'tailored for this job'
		);
		expect(await b.page.getByLabel('Version to send').count()).toBe(0);
		expect(await b.page.getByRole('button', { name: /Send this instead/ }).count()).toBe(0);
	});

	it('keeps the library one click away, and quiet', async () => {
		await b.page.getByRole('button', { name: /^Change$/ }).click();
		const picker = b.page.getByLabel('Version to send');
		await picker.waitFor({ state: 'visible' });
		// The tailored version is selectable here too, so "Change" is never a
		// one-way door out of it.
		expect(await picker.innerText()).toContain('tailored for this job');

		await b.page.getByRole('button', { name: /^Cancel$/ }).click();
		await b.page.getByText('Sending', { exact: true }).waitFor({ state: 'visible' });
		expect(await b.page.getByLabel('Version to send').count()).toBe(0);
	});
});
