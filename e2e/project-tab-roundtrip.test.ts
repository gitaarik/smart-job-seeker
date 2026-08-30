/**
 * Browser E2E — a project's Details tab still holds what it auto-saved after a
 * trip to one of its sibling tabs.
 *
 * The project's row is loaded by the `+layout.server.ts` that owns the header
 * and the tab bar, and the Details tab has no load of its own. SvelteKit keeps
 * a layout's data across a move between that layout's children, quite rightly —
 * nothing the load depends on changed — but the tab itself is destroyed and
 * rebuilt on the way back, from a row that was fetched when the page was first
 * opened. So a description typed, auto-saved and then looked at again after a
 * click on Files & code came back as the value it had before the edit, and only
 * a reload showed the truth. The save was never the problem; the page's idea of
 * the server was.
 *
 * Only a browser can see this. Every request involved succeeds, the database
 * holds the new value throughout, and the whole failure lives in which copy of
 * the row the client rebuilds the form from.
 *
 * Self-contained: it creates a project of its own through the add form and
 * deletes it again, so it leaves the profile as it found it and can be re-run.
 *
 * Prerequisites: dev stack running, test user seeded (see browser.test.ts).
 */

import { beforeAll, describe, expect, it } from 'vitest';
import { loginViaUI, useBrowser } from './browser';

const DESCRIPTION = 'What was the project and your role in it?';

describe('a project detail tab round trip', () => {
	const b = useBrowser();

	beforeAll(async () => {
		await loginViaUI(b.page);
	});

	it('keeps the description that was auto-saved before the tab was left', async () => {
		const page = b.page;

		await page.goto('/profile/work-experience');
		await page.waitForLoadState('networkidle');
		await page.getByRole('link', { name: 'Edit' }).first().click();
		await page.waitForURL(/\/profile\/work-experience\/\d+$/);
		await page.waitForLoadState('networkidle');

		// The click can land before the page has hydrated, and an unhydrated
		// button is a silent no-op — the same race `loginViaUI` retries around.
		const name = page.getByPlaceholder('Project name');
		for (let attempt = 1; attempt <= 3 && !(await name.isVisible()); attempt++) {
			await page.getByRole('button', { name: 'Add Project' }).click();
			await name.waitFor({ timeout: 5000 }).catch(() => {});
		}
		await name.fill('Tab round-trip probe');
		await page.getByRole('button', { name: 'Create and open' }).click();
		await page.waitForURL(/\/projects\/\d+$/);
		const projectUrl = new URL(page.url());
		const projectId = projectUrl.pathname.split('/').pop();

		try {
			const description = page.getByPlaceholder(DESCRIPTION);
			await description.waitFor({ timeout: 15000 });

			const typed = `saved at ${Date.now()}`;
			const patched = page.waitForResponse(
				(r) =>
					r.url().includes(`/api/profile-section/work_experience_project/${projectId}`) &&
					r.request().method() === 'PATCH' &&
					r.ok()
			);
			await description.click();
			await description.fill(typed);
			await description.blur();
			await patched;

			await page.getByRole('link', { name: 'Files & code', exact: true }).click();
			await page.waitForURL('**/sources');
			await page.getByRole('link', { name: 'Details' }).click();
			await page.waitForURL((u) => u.pathname.endsWith(`/projects/${projectId}`));

			const back = page.getByPlaceholder(DESCRIPTION);
			await back.waitFor({ timeout: 15000 });
			await expect.poll(() => back.inputValue(), { timeout: 10000 }).toBe(typed);
		} finally {
			await page.request.fetch(
				`${projectUrl.origin}/api/profile-section/work_experience_project/${projectId}`,
				{ method: 'DELETE' }
			);
		}
	}, 90000);
});
