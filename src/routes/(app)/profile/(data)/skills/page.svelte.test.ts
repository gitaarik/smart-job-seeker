import { beforeEach, describe, expect, test, vi } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/svelte';
import SkillsPage from './+page.svelte';
import { SKILL_LEVELS } from '$lib/data/field-labels';

/**
 * The Show-on switches, driven from the page rather than the editor.
 *
 * The editor is fine in isolation and its own test proves it, because that
 * test hands it a `$state` array. Production did not: the page mapped the
 * loaded categories inside a `$derived`, which yields a plain object graph,
 * and the editor's writes land on plain objects without waking anything. The
 * switch stayed where it was, and since each click recomputes from the stale
 * tags, turning off a second template threw away the first — `["!cv"]` where
 * `["!resume","!cv"]` was asked for.
 *
 * So the test mounts the page. Passing `$state` in here would reproduce the
 * editor's own test and miss the bug again; what has to be exercised is the
 * mapping the page actually performs on `data`.
 */

const invalidateAll = vi.fn(async () => {});
vi.mock('$app/navigation', () => ({ invalidateAll: () => invalidateAll() }));

/** Every action POST the page makes, in order. */
let posted: { action: string; body: Record<string, string> }[] = [];
/** Every PATCH to the skills API — the Show-on switches saving themselves. */
let patched: Record<string, unknown>[] = [];
/** What the next PATCH answers with, for the failure case. */
let patchResponse: { status: number; body: string };

beforeEach(() => {
	posted = [];
	patched = [];
	patchResponse = { status: 200, body: '{"success":true}' };
	invalidateAll.mockClear();
	vi.stubGlobal(
		'ResizeObserver',
		class {
			observe() {}
			unobserve() {}
			disconnect() {}
		}
	);
	vi.stubGlobal(
		'fetch',
		vi.fn(async (url: string, init?: RequestInit) => {
			if (String(url).startsWith('/api/profile-versions')) {
				return new Response('[]', { status: 200 });
			}
			if (String(url).startsWith('/api/profile-skills')) {
				patched.push(JSON.parse(String(init?.body)));
				return new Response(patchResponse.body, { status: patchResponse.status });
			}
			const body: Record<string, string> = {};
			for (const [k, v] of init?.body as FormData) body[k] = String(v);
			posted.push({ action: String(url).replace('?/', ''), body });
			return new Response('{}', { status: 200 });
		})
	);
});

/** One category holding one skill, shaped as the load function returns it. */
function pageData(tags: string[] | null = null) {
	return {
		profileId: 1,
		levelOptions: SKILL_LEVELS,
		categories: [
			{
				id: 10,
				name: 'Languages',
				tags: null,
				note: null,
				tech_skills: [{ id: 100, name: 'Python', level: null, years_experience: null, tags }]
			}
		]
	};
}

function renderPage(tags: string[] | null = null) {
	// The page's own `PageData` carries the whole layout tree; the component
	// reads three fields of it.
	render(SkillsPage, {
		props: { data: pageData(tags) as never, form: null }
	});
}

/** A Show-on switch inside the open skill editor, by its label. */
const templateSwitch = (label: string) =>
	screen.getAllByRole('button').find((b) => b.textContent?.trim().startsWith(label))!;

async function openSkillEditor() {
	await fireEvent.click(screen.getByRole('button', { name: /Python/ }));
}

describe('skills page — Show on switches', () => {
	test('a switch moves when it is clicked', async () => {
		renderPage();
		await openSkillEditor();

		expect(templateSwitch('Resume').getAttribute('aria-pressed')).toBe('true');
		await fireEvent.click(templateSwitch('Resume'));
		expect(templateSwitch('Resume').getAttribute('aria-pressed')).toBe('false');

		// The other two are untouched: one switch is one statement.
		expect(templateSwitch('CV').getAttribute('aria-pressed')).toBe('true');
		expect(templateSwitch('Site').getAttribute('aria-pressed')).toBe('true');
	});

	test('two switches in one visit both survive to the save', async () => {
		renderPage();
		await openSkillEditor();

		await fireEvent.click(templateSwitch('Resume'));
		await fireEvent.click(templateSwitch('CV'));
		expect(templateSwitch('Site').getAttribute('aria-pressed')).toBe('true');

		await fireEvent.click(screen.getByLabelText('Confirm'));

		const update = posted.find((p) => p.action === 'updateSkill');
		expect(update).toBeDefined();
		expect(JSON.parse(update!.body.tags)).toEqual(['!resume', '!cv']);
	});

	test('a stored exclusion renders as an off switch and turns back on', async () => {
		renderPage(['!portfolio']);
		await openSkillEditor();

		expect(templateSwitch('Site').getAttribute('aria-pressed')).toBe('false');
		await fireEvent.click(templateSwitch('Site'));
		expect(templateSwitch('Site').getAttribute('aria-pressed')).toBe('true');

		await fireEvent.click(screen.getByLabelText('Confirm'));
		const update = posted.find((p) => p.action === 'updateSkill');
		expect(JSON.parse(update!.body.tags)).toEqual([]);
	});
});

/**
 * The switches save on the click, ahead of the popup's Save button.
 *
 * They are the one control in here where waiting buys nothing: a switch is a
 * decision the moment it moves, and there is no half-flipped state to protect.
 * Everything else in the popup still belongs to Save and Cancel, which is why
 * the interesting cases below are the seams between the two.
 */
describe('skills page — the switches save themselves', () => {
	test('flipping one writes immediately, without Save', async () => {
		renderPage();
		await openSkillEditor();
		await fireEvent.click(templateSwitch('Resume'));

		expect(patched).toEqual([{ id: 100, base_templates: ['cv', 'portfolio'] }]);
		// Nothing went through the form actions, so nothing reloaded the page
		// data underneath the open popup.
		expect(posted).toEqual([]);
		expect(invalidateAll).not.toHaveBeenCalled();
	});

	test('each flip states the whole set, not the switch that moved', async () => {
		renderPage();
		await openSkillEditor();
		await fireEvent.click(templateSwitch('Resume'));
		await fireEvent.click(templateSwitch('CV'));

		expect(patched.map((p) => p.base_templates)).toEqual([['cv', 'portfolio'], ['portfolio']]);
	});

	test('Cancel keeps a switch it has already written', async () => {
		// Cancel reverts the edits still in the popup's hands. Putting a saved
		// switch back would leave the UI describing a server that has moved on,
		// which is the failure this whole area has had once already.
		renderPage();
		await openSkillEditor();
		await fireEvent.click(templateSwitch('Resume'));
		await fireEvent.click(screen.getByLabelText('Cancel'));

		await openSkillEditor();
		expect(templateSwitch('Resume').getAttribute('aria-pressed')).toBe('false');
	});

	test('Cancel still reverts the name it was opened for', async () => {
		renderPage();
		await openSkillEditor();
		await fireEvent.input(screen.getByPlaceholderText('Skill name'), {
			target: { value: 'Rust' }
		});
		await fireEvent.click(templateSwitch('Resume'));
		await fireEvent.click(screen.getByLabelText('Cancel'));

		expect(screen.getByRole('button', { name: /Python/ })).toBeTruthy();
		expect(posted).toEqual([]);
	});

	test('a refused write says so instead of leaving the switch lying', async () => {
		patchResponse = { status: 400, body: '{"error":"Unknown template \\"site\\""}' };
		renderPage();
		await openSkillEditor();
		await fireEvent.click(templateSwitch('Resume'));

		expect(await screen.findByText('Unknown template "site"')).toBeTruthy();
		expect(screen.getByRole('button', { name: 'Retry' })).toBeTruthy();
	});

	test('a skill that does not exist yet waits for Save', async () => {
		// There is no id to patch, and the tags ride along with the create.
		renderPage();
		await fireEvent.click(screen.getByRole('button', { name: /^Add$/ }));
		await fireEvent.input(screen.getByPlaceholderText('Skill name'), {
			target: { value: 'Rust' }
		});
		await fireEvent.click(templateSwitch('Resume'));

		expect(patched).toEqual([]);

		await fireEvent.click(screen.getByLabelText('Confirm'));
		const create = posted.find((p) => p.action === 'createSkill');
		expect(JSON.parse(create!.body.tags)).toEqual(['!resume']);
	});

	test('Undo moves the switch back, not just the server', async () => {
		// Undo posts the previous set through the save field directly, without
		// going back through the switch that set it. The switch has to follow it,
		// or the pill reports a state the popup is not showing.
		renderPage();
		await openSkillEditor();
		await fireEvent.click(templateSwitch('Resume'));
		expect(templateSwitch('Resume').getAttribute('aria-pressed')).toBe('false');

		await fireEvent.click(await screen.findByRole('button', { name: 'Undo' }));

		await waitFor(() => expect(templateSwitch('Resume').getAttribute('aria-pressed')).toBe('true'));
		expect(patched.at(-1)).toEqual({
			id: 100,
			base_templates: ['resume', 'cv', 'portfolio']
		});
	});
});
