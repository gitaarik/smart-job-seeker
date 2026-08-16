/**
 * Browser E2E — a refused create keeps the add form and what was typed in it.
 *
 * The three section list pages that open a detail page after a create
 * (side projects, education, work experience) posted their add form without
 * `use:enhance`. That is fine right up until the server refuses: the failure
 * comes back as a full page load, which re-renders the list with the error at
 * the top and the add form closed — taking every field the applicant had
 * filled in with it. The error is about one of those fields, and it is the one
 * thing they can no longer see.
 *
 * Nothing below the browser can catch that. The action returns the same
 * `fail(400)` either way; whether the typed values survive is entirely a
 * question of what the client does with the response, so it takes a real page.
 *
 * The refusal used here is an over-long summary rather than a bad number,
 * because a `type="number"` input will not accept an unreadable value in the
 * first place — the refusals that actually reach the server from this form are
 * the length limits, and those are reached by pasting, which is exactly when
 * losing the field costs the most.
 *
 * Non-mutating by construction: the create under test is the one the server
 * refuses, so the profile is untouched and the suite is repeatable.
 *
 * Prerequisites: dev stack running, test user seeded (see browser.test.ts).
 */

import { beforeAll, describe, expect, it } from 'vitest';
import { loginViaUI, useBrowser } from './browser';

/** `sideProjectBasicSchema` caps the summary at 10,000 characters. */
const TOO_LONG_SUMMARY = 'x'.repeat(10_001);
const TYPED_NAME = 'A project the form must not forget';

describe('profile section add form', () => {
	const b = useBrowser();

	beforeAll(async () => {
		await loginViaUI(b.page);
	});

	async function openAddForm() {
		await b.page.goto('/profile/side-projects');
		await b.page.waitForLoadState('networkidle');
		await b.page.getByRole('button', { name: /Add (Project|First Project)/ }).click();
		await b.page.locator('#new-name').waitFor({ state: 'visible', timeout: 10000 });
	}

	it('keeps the form, and the values, when the create is refused', async () => {
		await openAddForm();

		await b.page.locator('#new-name').fill(TYPED_NAME);
		await b.page.locator('#new-stars').fill('150');
		await b.page.locator('#new-summary').fill(TOO_LONG_SUMMARY);
		await b.page.getByRole('button', { name: 'Create & Edit Details' }).click();

		// The refusal is reported…
		await b.page.getByText(/summary: Too big/i).waitFor({ state: 'visible', timeout: 10000 });

		// …and the form is still there, still holding what was typed.
		expect(await b.page.locator('#new-name').inputValue()).toBe(TYPED_NAME);
		expect(await b.page.locator('#new-stars').inputValue()).toBe('150');
		expect((await b.page.locator('#new-summary').inputValue()).length).toBe(
			TOO_LONG_SUMMARY.length
		);

		// Still on the list page: a refused create must not navigate anywhere.
		expect(new URL(b.page.url()).pathname).toBe('/profile/side-projects');
	});

	it('lets an optional number be left blank', async () => {
		// Leaving `stars` empty used to fail validation on the server, which is
		// the report this file exists for. Asserting that the create *goes
		// through* would mutate the profile, so that half lives in
		// `write.test.ts`; what is checked here is that nothing on the client
		// blocks the submit before the server ever sees it.
		await openAddForm();

		await b.page.locator('#new-name').fill(TYPED_NAME);
		expect(await b.page.locator('#new-stars').inputValue()).toBe('');

		const blocked = await b.page
			.locator('#new-stars')
			.evaluate((el: HTMLInputElement) => !el.checkValidity());
		expect(blocked).toBe(false);
	});
});
