/**
 * Browser E2E — the review step labels what it filled in on its own.
 *
 * Two values can land in the form without the posting having said them: a
 * title suggested from the description when the posting names no role, and
 * today's date when it doesn't say when it was posted. Both are useful
 * defaults and both are dangerous as silent ones — a suggested title that
 * looks extracted ends up in a cover letter as "the position of X". So each
 * carries a note under its field for exactly as long as the field still holds
 * the value we put there; the moment it is edited, it is the applicant's and
 * the note goes.
 *
 * That is client-side behaviour in `+page.svelte` — the server never sees a
 * suggestion inside `fields` — so it takes a real page to test. The parse API
 * is intercepted and answered with a fixed response: the extraction's own
 * quality is covered by llm:smoke, and a browser test should not spend tokens
 * or depend on a model's mood.
 *
 * Non-mutating: nothing is submitted, so no application is created.
 *
 * Prerequisites: dev stack running, test user seeded (see browser.test.ts).
 */

import { beforeAll, describe, expect, it } from 'vitest';
import { loginViaUI, useBrowser } from './browser';

const SUGGESTED = 'Ontwikkelaar AI & procesautomatisering (programma BZB)';

/** What /api/jobs/parse-description answers for the paste below. */
const PARSE_RESPONSE = {
	ok: true,
	token: 'e2e-token',
	fields: {
		title: null,
		company: 'Belastingdienst',
		job_poster: null,
		office_location: null,
		work_location: [],
		job_types: [],
		experience_levels: [],
		source_url: null,
		date_posted: null,
		salary_min: null,
		salary_max: null,
		salary_currency: null,
		salary_period: null
	},
	suggestions: { title: SUGGESTED },
	preview: {
		company_description: null,
		skills_required: ['Python'],
		skills_preferred: [],
		responsibilities: [],
		soft_skills: []
	}
};

/** Today as the date input holds it — the same UTC definition the app uses. */
const TODAY = new Date().toISOString().slice(0, 10);

describe('new application — suggested title and defaulted date', () => {
	const b = useBrowser();

	beforeAll(async () => {
		await loginViaUI(b.page);
	});

	async function pasteAndExtract() {
		await b.page.route('**/api/jobs/parse-description', (route) =>
			route.fulfill({ json: PARSE_RESPONSE })
		);
		await b.page.goto('/applications/new');
		await b.page.waitForLoadState('networkidle');
		await b.page.locator('#na-paste').fill('Opdrachtomschrijving\n\nHet programma BZB…');
		await b.page.getByRole('button', { name: 'Extract details' }).click();
		await b.page.locator('#na-title').waitFor({ state: 'visible', timeout: 10000 });
	}

	it('fills the suggestion and today, each with a note, until edited', async () => {
		await pasteAndExtract();

		const title = b.page.locator('#na-title');
		const date = b.page.locator('#na-posted');
		await expect(title.inputValue()).resolves.toBe(SUGGESTED);
		await expect(date.inputValue()).resolves.toBe(TODAY);
		await expect(b.page.locator('#na-company').inputValue()).resolves.toBe('Belastingdienst');

		const titleNote = b.page.getByText(/Suggested from the description/);
		const dateNote = b.page.getByText(/Set to today/);
		await titleNote.waitFor({ state: 'visible', timeout: 5000 });
		await dateNote.waitFor({ state: 'visible', timeout: 5000 });

		// Editing either field makes it the applicant's; the note goes with it.
		await title.fill('Developer BZB');
		await expect(titleNote.count()).resolves.toBe(0);
		await date.fill('2026-08-20');
		await expect(dateNote.count()).resolves.toBe(0);
	});

	it('defaults the date, but never the title, when entering details by hand', async () => {
		await b.page.goto('/applications/new');
		// The button does nothing until the page has hydrated; wait for that
		// rather than for luck.
		await b.page.waitForLoadState('networkidle');
		await b.page.getByRole('button', { name: 'Enter the details manually' }).click();
		await b.page.locator('#na-title').waitFor({ state: 'visible', timeout: 10000 });

		await expect(b.page.locator('#na-title').inputValue()).resolves.toBe('');
		await expect(b.page.locator('#na-posted').inputValue()).resolves.toBe(TODAY);
		await b.page.getByText(/Set to today/).waitFor({ state: 'visible', timeout: 5000 });
		await expect(b.page.getByText(/Suggested from the description/).count()).resolves.toBe(0);
	});
});
