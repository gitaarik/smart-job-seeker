/**
 * Browser E2E for the assistant panel's empty state.
 *
 * The panel's write half had no surface at all: nothing told a user that a
 * profile page will offer to add a skill, or that a job page will offer to
 * rewrite the posting. They had to guess, and an assistant asked "what can you
 * do?" answers from whichever verbs the current page grants — locally correct
 * and, on any other page, wrong.
 *
 * So the empty state now lists what THIS page can propose, resolved server-side
 * per route. Worth a browser test because nothing else exercises the path: the
 * list arrives from an effect that fires on open, keyed on the route, and a
 * failed fetch is deliberately silent — a component that renders nothing looks
 * exactly like a page with no capabilities.
 *
 * /profile/skills rather than a job or an application: it grants six
 * capabilities to every profile that has a skill, needs no seeded id, and does
 * not depend on who imported what.
 *
 * Nothing here sends a message, so no credits and no model call.
 *
 * Prerequisites: dev stack up, test user seeded (see browser.test.ts).
 *
 * Run: npm run test:e2e
 */

import { beforeAll, describe, expect, it } from 'vitest';
import { loginViaUI, useBrowser } from './browser';

describe('assistant empty state', () => {
	const b = useBrowser();

	beforeAll(async () => {
		await loginViaUI(b.page);
	});

	async function openAssistant(path: string) {
		await b.page.goto(path);
		await b.page.waitForLoadState('networkidle');
		await b.page.getByRole('button', { name: 'Open assistant' }).click();
	}

	it('lists what this page can propose before anything is typed', async () => {
		await openAssistant('/profile/skills');

		const heading = b.page.getByText('On this page I can also suggest changes for you to apply');
		await heading.waitFor({ state: 'visible', timeout: 15000 });

		// The titles come from the capability registry and are the same strings
		// the proposal card shows, so asserting one is asserting the wiring rather
		// than the wording.
		expect(await b.page.getByText('Add a skill', { exact: true }).count()).toBeGreaterThan(0);
	});

	it('points at the guide for everything the assistant cannot do', async () => {
		await openAssistant('/profile/skills');

		const link = b.page.getByRole('link', { name: 'What Smart Job Seeker can do' });
		await link.waitFor({ state: 'visible', timeout: 15000 });
		expect(await link.getAttribute('href')).toBe('/guide');
	});

	it('offers nothing on a page that can propose nothing', async () => {
		// The honest half. /home grants no capability, and inventing an offer
		// there would be the same over-promise the server-side list exists to
		// avoid — the fallback is the sentence the panel always had.
		await openAssistant('/home');

		const invitation = b.page.getByText('Ask me anything about your job search');
		await invitation.waitFor({ state: 'visible', timeout: 15000 });
		expect(await b.page.getByText('On this page I can also suggest changes').count()).toBe(0);
	});
});
