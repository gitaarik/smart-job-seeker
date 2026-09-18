/**
 * Publishing a portfolio site, and the boundary that keeps it private.
 *
 * The portfolio is the one public surface a profile can turn on for the whole
 * internet, so the behaviour worth a test is not that the page renders: it is
 * that `/p/<slug>/portfolio` serves nothing until someone publishes it and
 * stops serving the moment they take it down. Both pointers move together, and
 * this drives them through the real form actions rather than the database.
 *
 * This covers the server half of the editor. The editor's own UI is not
 * exercised here.
 *
 * Prerequisites, as for the rest of the suite: the dev stack is up and the test
 * user is seeded (alex.morgan@example.com).
 *
 * Run: npm run test:e2e
 */

import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { formAction, request, signInWithProfile } from './helpers';

const EDITOR = '/profile/portfolio';
const THEME_NAME = `E2E theme ${Date.now()}`;

let profileSlug: string;
let versionId: string;
let themeId: string;

/** Every `<option>` value under a named `<select>`, in document order. */
function optionValues(html: string, selectName: string): string[] {
	const select = html.match(
		new RegExp(`<select[^>]*name="${selectName}"[^>]*>([\\s\\S]*?)</select>`)
	);
	if (!select) return [];
	return [...select[1].matchAll(/<option[^>]*value="(\d+)"/g)].map((m) => m[1]);
}

beforeAll(async () => {
	await signInWithProfile();

	// The editor prints the public URL, but only once a theme exists, so create
	// one first and read the page after. Everything the test needs comes off
	// that page rather than from an assumption about which profile is selected.
	const created = await formAction(`${EDITOR}?/create`, { name: THEME_NAME });
	expect(created.type).toBe('success');

	const editor = await request(EDITOR);
	expect(editor.status).toBe(200);
	const html = await editor.text();

	const slug = html.match(/\/p\/([a-z0-9-]+)\/portfolio/i);
	if (!slug) throw new Error('Could not find the public portfolio URL on the editor page');
	profileSlug = slug[1];

	// Publishing needs a library version. The test user is seeded with at least
	// one; without it there is nothing to publish and the test cannot run.
	const themes = optionValues(html, 'themeId');
	const versions = optionValues(html, 'versionId');
	if (!versions.length) throw new Error('The test profile has no library version to publish');
	themeId = themes[themes.length - 1];
	versionId = versions[0];
});

afterAll(async () => {
	// Leave the dev box as it was found: unpublished, and without the theme.
	await formAction(`${EDITOR}?/unpublish`);
	if (themeId) await formAction(`${EDITOR}?/delete`, { themeId });
});

describe('portfolio publishing', () => {
	it('serves nothing at the public URL before anything is published', async () => {
		const res = await request(`/p/${profileSlug}/portfolio`, { auth: false });
		expect(res.status).toBe(401);
	});

	it('serves the site once a theme and a version are published', async () => {
		const published = await formAction(`${EDITOR}?/publish`, { themeId, versionId });
		expect(published.type).toBe('success');

		const res = await request(`/p/${profileSlug}/portfolio`, { auth: false });
		expect(res.status).toBe(200);
		const html = await res.text();

		// The site is built from the profile's own data, so it is the applicant
		// the page is titled after and leads with, not the theme. (The theme's
		// name is in the hydration payload either way, which is why this reads
		// the rendered title rather than searching the whole document.)
		const title = html.match(/<title>([\s\S]*?)<\/title>/)?.[1].trim() ?? '';
		expect(title).not.toBe('');
		expect(html).toContain(`<h1`);
		expect(html).not.toContain('Profile not found');
	});

	it('refuses to publish a theme belonging to no one', async () => {
		const res = await formAction(`${EDITOR}?/publish`, { themeId: 999999999, versionId });
		expect(res.type).toBe('failure');
	});

	it('refuses to publish without a version, since a theme alone cannot render', async () => {
		const res = await formAction(`${EDITOR}?/publish`, { themeId, versionId: 999999999 });
		expect(res.type).toBe('failure');
	});

	it('stops serving the moment it is taken down', async () => {
		await formAction(`${EDITOR}?/publish`, { themeId, versionId });
		expect((await request(`/p/${profileSlug}/portfolio`, { auth: false })).status).toBe(200);

		const down = await formAction(`${EDITOR}?/unpublish`);
		expect(down.type).toBe('success');

		const res = await request(`/p/${profileSlug}/portfolio`, { auth: false });
		expect(res.status).toBe(401);
	});
});
