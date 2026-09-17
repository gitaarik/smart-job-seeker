/**
 * Browser E2E for the application's resume page.
 *
 * The page is one question — "what goes to this job?" — in three sections:
 * what is being sent, how it holds up against the job, and what is on the
 * version built for it. Most of what can break is which state renders, and
 * whether the sections agree about which document they mean: the contents
 * section edits the tailored version whatever the record names, and a record
 * naming something else used to leave that unsaid.
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
 * tailored version this needs is made by toggling one item in the contents,
 * which costs nothing — depending on a previous run having left one made the
 * whole file fail whenever it ran before the item picker's, which deletes it.
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
 * Through the contents rather than the Tailor button: the button spends a real
 * model call, a toggle spends nothing, and both end at the same place — a
 * version owned by this application, recorded as what goes out.
 */
async function ensureTailored(page: Page) {
	// Exact: the send record's own button is "Regenerate the PDF".
	if (await page.getByRole('button', { name: 'Regenerate', exact: true }).count()) return;

	if (!(await page.getByRole('heading', { name: "What's on it" }).count())) {
		await page.getByRole('button', { name: /Or send one of my versions as it is/ }).click();
		await page.getByLabel('Version to send').selectOption({ index: 1 });
		await commitPickedVersion(page);
	}
	await page.locator('button[aria-label^="Hide "]').first().click();
	await page.getByText('· tailored for this job').waitFor({ state: 'visible', timeout: 20000 });
}

describe('resume page', () => {
	const b = useBrowser();

	it('asks its three questions in three sections', async () => {
		await loginViaUI(b.page);
		await b.page.goto(`/applications/${APP_ID}/resume`);
		await b.page.waitForLoadState('networkidle');
		await ensureTailored(b.page);

		expect(await b.page.getByRole('heading', { name: 'Document for this job' }).isVisible()).toBe(
			true
		);
		for (const name of ['Sending', 'Check against the job', "What's on it"]) {
			expect(await b.page.getByRole('heading', { name }).isVisible()).toBe(true);
		}
		// The tailored version's own actions sit with its contents, above them.
		expect(await b.page.getByRole('button', { name: 'Regenerate', exact: true }).isVisible()).toBe(
			true
		);
	});

	it('states what is being sent instead of re-asking', async () => {
		// Re-runnable: back to "a tailored version exists, nothing recorded".
		if (await b.page.getByRole('button', { name: /Clear this record/ }).count()) {
			await b.page.getByRole('button', { name: /Clear this record/ }).click();
			await b.page.getByRole('button', { name: /^Clear$/ }).click();
			await b.page.waitForLoadState('networkidle');
		}

		// Nothing recorded: the sending section offers the version built for this
		// job by name, rather than leaving it to be found in a dropdown.
		const sendThis = b.page.getByRole('button', { name: /^Send this one$/ });
		await sendThis.waitFor({ state: 'visible' });

		await sendThis.click();
		await b.page.waitForLoadState('networkidle');

		// Recorded: a statement, and no picker left open asking the same question.
		// Waited for rather than snapshotted — `isVisible()` does not retry, and
		// the network goes idle a beat before the enhance-driven re-render lands.
		await b.page.getByText('· tailored for this job').waitFor({ state: 'visible' });
		expect(await b.page.locator('p.truncate').first().innerText()).toContain(
			'tailored for this job'
		);
		expect(await b.page.getByLabel('Version to send').count()).toBe(0);
		expect(await b.page.getByRole('button', { name: /^Send this one/ }).count()).toBe(0);
	});

	it('keeps the library one click away, and quiet', async () => {
		await b.page.getByRole('button', { name: /^Change$/ }).click();
		const picker = b.page.getByLabel('Version to send');
		await picker.waitFor({ state: 'visible' });
		// The tailored version is selectable here too, so "Change" is never a
		// one-way door out of it.
		expect(await picker.innerText()).toContain('tailored for this job');

		await b.page.getByRole('button', { name: /^Cancel$/ }).click();
		await b.page.getByText('· tailored for this job').waitFor({ state: 'visible' });
		expect(await b.page.getByLabel('Version to send').count()).toBe(0);
	});

	// The contents edit the tailored version whatever the record names. Sending a
	// library version while one exists used to say nothing about that, so a
	// toggle read as an edit to the document you were sending.
	it('says when the version it edits is not the one you are sending', async () => {
		await b.page.getByRole('button', { name: /^Change$/ }).click();
		await b.page.getByLabel('Version to send').selectOption({ index: 1 });
		await commitPickedVersion(b.page);

		const instead = b.page.getByRole('button', { name: /^Send this one instead$/ });
		await instead.waitFor({ state: 'visible' });
		expect(await b.page.getByText(/You also have a resume tailored for this job/).count()).toBe(1);
		expect(await b.page.getByText(/which you aren't sending right now/).count()).toBe(1);

		await instead.click();
		await instead.waitFor({ state: 'detached' });
		await b.page.getByText('· tailored for this job').waitFor({ state: 'visible' });
	});
});
