/**
 * Browser E2E for alternative field wordings.
 *
 * The unit tests cover the resolver, the overlay order and the decisions, and
 * none of them can see the thing this feature actually is: prose the applicant
 * chose in one place appearing on a document rendered somewhere else entirely.
 * Between the two sit two editors, an API, a version's pick, and three overlays
 * applied in a fixed order by a route — and every one of those can be right on
 * its own while the page still prints the default.
 *
 * So the assertion at the end is deliberately the crude one: fetch the rendered
 * resume and look for the words, then clear the pick and check they are gone.
 * That pair is the only check that fails if any link in the chain breaks, and
 * "does the document say it" is the question the feature exists to answer.
 *
 * Both halves are driven through the UI rather than the API, because the API is
 * the half that is already covered — the editor on Basic Info and the picker on
 * the version page are where a control can silently stop being wired to
 * anything.
 *
 * `?version=` rather than the public version: this profile has no
 * `public_resume_version_id`, and the route honours the parameter for the
 * owner, which the browser context is.
 *
 * Prerequisites: dev stack up, test user seeded (see browser.test.ts).
 * Run: npm run test:e2e
 */

import { describe, expect, it } from 'vitest';
import { getAppUrl, loginViaUI, useBrowser } from './browser';
import type { Page } from 'patchright';

/** Distinctive enough that finding it in the HTML means only one thing. */
const LABEL = 'E2E-variant';
const SENTINEL = 'E2E-SENTINEL';
const WORDING = `${SENTINEL} wording for the alternative-wordings test.`;
const NOTE = 'backend and platform roles';

/** Call the app's own API with the logged-in page's cookies. */
async function api(page: Page, path: string, method: string, body?: unknown) {
	return page.evaluate(
		async ([p, m, b]) => {
			const res = await fetch(p as string, {
				method: m as string,
				headers: { 'Content-Type': 'application/json' },
				body: b ? JSON.stringify(b) : undefined
			});
			return { status: res.status, body: await res.text() };
		},
		[path, method, body ?? null] as const
	);
}

describe('alternative field wordings', () => {
	const b = useBrowser();

	it('reaches the rendered resume when a version picks it, and leaves when it does not', async () => {
		await loginViaUI(b.page);
		let variantId: number | null = null;

		try {
			// ── written in the profile editor ──
			await b.page.goto('/profile/edit');
			await b.page.waitForLoadState('networkidle');

			// Four of these, one per field; the last is the summary's. That the
			// control starts collapsed is itself part of the design — an advanced
			// affordance on a page whose job is the basics.
			await b.page.getByRole('button', { name: '+ Add an alternative wording' }).last().click();

			await b.page.getByPlaceholder('Name it — e.g. “Backend-leaning”').fill(LABEL);
			// The value box is seeded from the profile's own summary, so this
			// replaces rather than appends.
			await b.page.getByPlaceholder('Write a brief professional summary...').last().fill(WORDING);
			await b.page
				.getByPlaceholder('When to use it — e.g. “agency and consultancy roles”')
				.fill(NOTE);
			await b.page.getByRole('button', { name: 'Save' }).last().click();

			// Saved means it is listed, not that a request went out.
			await b.page.getByText(`Use for: ${NOTE}`).waitFor({ state: 'visible', timeout: 15000 });

			const listed = await api(b.page, '/api/field-variants', 'GET');
			expect(listed.status).toBe(200);
			const mine = JSON.parse(listed.body).variants.find(
				(v: { label: string }) => v.label === LABEL
			);
			expect(mine, 'the wording the editor just saved should be listed').toBeTruthy();
			variantId = mine.id;
			expect(mine.field).toBe('summary');
			expect(mine.note).toBe(NOTE);

			// ── picked on a version ──
			await b.page.goto('/profile/resume');
			await b.page.waitForLoadState('networkidle');
			await b.page.locator('a[href^="/profile/resume/"]').first().click();
			await b.page.waitForURL('**/profile/resume/**');
			const slug = new URL(b.page.url()).pathname.split('/').pop();
			expect(slug, 'should have landed on a version page').toBeTruthy();

			// The card exists only once the profile has a wording to choose, so
			// its presence is the assertion that the version page saw the new row.
			await b.page.getByRole('heading', { name: 'Wording' }).waitFor({ state: 'visible' });
			await b.page.getByRole('radio', { name: new RegExp(LABEL) }).check();

			// The save is a fetch with no navigation; wait for the state rather
			// than for a spinner that may already be gone.
			await expect
				.poll(
					async () => {
						const picks = await api(b.page, '/api/field-variants', 'GET');
						return picks.status;
					},
					{ timeout: 10000 }
				)
				.toBe(200);

			const versionSlug = await b.page.locator('input[name="slug"]').inputValue();
			expect(versionSlug, 'the version needs a slug to be rendered by it').toBeTruthy();

			// ── printed on the document ──
			//
			// A fresh query string per fetch. Without one the second read of the
			// same URL came back from cache and still carried the sentinel after
			// the pick had been cleared, which reads exactly like the clear not
			// working — a false failure that costs an afternoon to tell apart
			// from a real one.
			const docUrl = () =>
				`${getAppUrl()}/p/alex-morgan/resume` +
				`?version=${encodeURIComponent(versionSlug)}&cb=${Date.now()}-${Math.random()}`;
			const rendered = async () => (await b.page.request.get(docUrl())).text();

			await expect
				.poll(async () => (await rendered()).includes(SENTINEL), { timeout: 15000 })
				.toBe(true);

			// ── and gone again when nothing is picked ──
			await b.page.getByRole('radio', { name: /Your own professional summary/ }).check();

			await expect
				.poll(async () => (await rendered()).includes(SENTINEL), { timeout: 15000 })
				.toBe(false);
		} finally {
			if (variantId !== null) {
				// Deleting the wording drops its picks through the cascade, so this
				// one call is the whole teardown — and it has to run on failure too,
				// or a leftover pick changes what every other suite reads off this
				// profile.
				await api(b.page, '/api/field-variants', 'DELETE', { id: variantId }).catch(() => {});
			}
		}
	});
});
