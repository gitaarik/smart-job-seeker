/**
 * Tests for the ability manifest.
 *
 * Two different promises, and they fail differently.
 *
 * The verbs half is generated, so what is worth asserting is that nothing falls
 * out of the generation: a capability that exists and is missing from this block
 * is precisely the confident no the block was written to stop.
 *
 * The app-areas half is written down, so what is worth asserting is that it
 * still describes the app. `resolves every path` is the whole anti-rot
 * mechanism for it — without that, a renamed route turns this block from an
 * answer into a wrong answer, silently, on every turn.
 */

import { describe, expect, it } from 'vitest';
import { existsSync, readdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { formatAbilityManifest, APP_AREAS } from '../ability-manifest';
import { CAPABILITIES, type Capability } from '../capabilities';
import { PROFILE_CAPABILITY_NAMES } from '../profile-capabilities';
import { PROFILE_RESOURCES, PROFILE_RESOURCE_NAMES } from '$lib/server/profile/resources';

const TEXT = formatAbilityManifest();

/**
 * Every route path the app serves, mapped to the directory that serves it.
 *
 * `(group)` segments organize files without appearing in the URL, and
 * `PROFILE_RESOURCES` normalizes its paths the same way — /profile/skills is
 * really /profile/(data)/skills on disk.
 */
function routeDirs(): Map<string, string> {
	const root = fileURLToPath(new URL('../../../../routes/', import.meta.url));
	const paths = new Map<string, string>();

	const walk = (dir: string, route: string) => {
		for (const entry of readdirSync(dir, { withFileTypes: true })) {
			if (!entry.isDirectory() || entry.name === 'node_modules') continue;
			const segment = entry.name.startsWith('(') ? '' : `/${entry.name}`;
			const next = `${dir}/${entry.name}`;
			if (segment) paths.set(route + segment, next);
			walk(next, route + segment);
		}
	};

	walk(root, '');
	return paths;
}

/**
 * The one listed path with no page of its own.
 *
 * /guide redirects to its first section, which is an index doing its job.
 * Everything else in the list has to render something, because a redirect is
 * how a dead area stays in the list: /jobs/matching sat here for one draft of
 * this file, 301'd to /jobs/import, and described a page that no longer exists.
 */
const REDIRECT_INDEXES = new Set(['/guide']);

describe('formatAbilityManifest', () => {
	it('names every change that can ever be proposed', () => {
		// Grouped and generated, so this is really a test that the grouping is
		// total: a capability `ENTITY_TARGETING` has never heard of still has to
		// come out somewhere.
		const generated = new Set<string>(PROFILE_CAPABILITY_NAMES);
		for (const capability of Object.keys(CAPABILITIES) as Capability[]) {
			if (generated.has(capability)) continue;
			expect(TEXT, capability).toContain(CAPABILITIES[capability].title);
		}
	});

	it('says where each one becomes possible', () => {
		expect(TEXT).toContain("On a job's own page");
		expect(TEXT).toContain("On an application's own page");
		expect(TEXT).toContain('On each profile page listed above');
	});

	it('does not promise edits on a job that was scraped', () => {
		// The over-promise this block invites: a list of titles reads as a list of
		// permissions, and `canEditJob` says no for every posting the user did not
		// enter themselves. "Yes I can" followed by "actually I can't" is worse
		// than the silence this replaces.
		expect(TEXT).toContain('entered by hand');
		expect(TEXT).toContain('read-only');
	});

	it('offers hiding only where hiding writes something', () => {
		const hideable = PROFILE_RESOURCE_NAMES.filter((name) =>
			PROFILE_CAPABILITY_NAMES.includes(`hide_${name}` as never)
		);
		const sentence = TEXT.split('\n').find((line) => line.includes('Hiding an entry')) ?? '';

		expect(sentence).not.toBe('');
		for (const name of PROFILE_RESOURCE_NAMES) {
			const title = PROFILE_RESOURCES[name].title;
			// Titles that are a prefix of another section's would match either way;
			// none are today, and this asserts the mapping rather than the wording.
			if (hideable.includes(name)) expect(sentence, name).toContain(title);
			else expect(sentence, name).not.toContain(title);
		}
	});

	it('is not read as permission to propose anything here', () => {
		// Same failure the profile manifest guards against, one level up: without
		// this, the model proposes an edit the page cannot carry, it is dropped,
		// and the reply has already promised it.
		expect(TEXT).toContain('Changes you can propose');
		expect(TEXT).toContain('*anywhere*');
	});

	it('tells the model to name the page instead of refusing', () => {
		expect(TEXT).toContain('Name the page');
	});

	it('resolves every app-area path against the real routes', () => {
		// The anti-rot mechanism for the half that has no registry. A renamed or
		// deleted page fails here rather than sending the user to a 404 — which
		// this block would otherwise keep doing, confidently, on every turn.
		const routes = routeDirs();
		for (const area of APP_AREAS) {
			expect([...routes.keys()], `${area.name} → ${area.path}`).toContain(area.path);
		}
	});

	it('points at pages that render something', () => {
		// Existing is not enough: a legacy path that only redirects still passes
		// the check above while describing somewhere else entirely.
		const routes = routeDirs();
		for (const area of APP_AREAS) {
			if (REDIRECT_INDEXES.has(area.path)) continue;
			const dir = routes.get(area.path);
			expect(dir, area.path).toBeDefined();
			expect(existsSync(`${dir}/+page.svelte`), `${area.path} has no page of its own`).toBe(true);
		}
	});

	it('names each area the way the app names it', () => {
		for (const area of APP_AREAS) expect(TEXT, area.name).toContain(`${area.name} (${area.path})`);
	});

	it('stays small enough to be unconditional', () => {
		// It ships on every turn on every page, like the two manifests it sits
		// beside — and unlike them it is the same characters for every user, so
		// the whole of its cost is this number. Twelve areas at ~90 characters,
		// four capability lines, and two short frames.
		expect(TEXT.length).toBeLessThanOrEqual(2800);
	});
});
