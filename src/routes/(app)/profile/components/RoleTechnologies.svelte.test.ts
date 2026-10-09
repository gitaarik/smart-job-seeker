import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/svelte';
import RoleTechnologies from './RoleTechnologies.svelte';

/**
 * A role's technology chips, and the Resume / CV / Site switches they gained.
 *
 * Mounted for real against a stubbed fetch, because what is worth pinning is
 * the write each click produces: the switches rewrite the whole tag array, so a
 * switch that dropped the version tags beside it, or a second switch sent with
 * the first one's baseline, would each look fine on screen and be wrong on
 * every document.
 */

interface Sent {
	url: string;
	method: string;
	body: Record<string, unknown> | null;
}

let sent: Sent[] = [];
/** While set, requests wait for `land()` instead of answering at once. */
let holding = false;
let waiting: Array<() => void> = [];

beforeEach(() => {
	sent = [];
	holding = false;
	waiting = [];
	vi.stubGlobal(
		'ResizeObserver',
		class {
			observe() {}
			unobserve() {}
			disconnect() {}
		}
	);
	vi.stubGlobal('fetch', (url: string, init?: RequestInit) => {
		sent.push({
			url,
			method: init?.method ?? 'GET',
			body: init?.body ? JSON.parse(String(init.body)) : null
		});
		const answer = () => new Response(JSON.stringify({ success: true, id: 501 }), { status: 200 });
		if (!holding) return Promise.resolve(answer());
		return new Promise<Response>((resolve) => waiting.push(() => resolve(answer())));
	});
});

afterEach(() => {
	vi.useRealTimers();
	vi.unstubAllGlobals();
});

/** Answer the oldest request still waiting. */
function land() {
	waiting.shift()?.();
}

/** Let the awaits inside a save settle. */
const settle = async () => {
	for (let i = 0; i < 6; i++) await Promise.resolve();
};

function renderChips(initial: Array<{ id: number; name: string; tags: string[] | null }>) {
	render(RoleTechnologies, {
		props: { workExperienceId: 232, profileId: 1, initial, versionSlugs: ['citrus'] }
	});
}

const chip = (name: string) => screen.getByRole('button', { name: new RegExp(name) });
/** A Show-on switch in the open editor, by its label. */
const templateSwitch = (label: string) => screen.getByRole('button', { name: label });
const patches = () => sent.filter((r) => r.method === 'PATCH');

describe('RoleTechnologies', () => {
	test('a switch writes the tags at once and keeps the version tags beside them', async () => {
		renderChips([{ id: 7, name: 'Drizzle ORM', tags: ['!citrus'] }]);

		await fireEvent.click(chip('Drizzle ORM'));
		expect(templateSwitch('Resume').getAttribute('aria-pressed')).toBe('true');
		await fireEvent.click(templateSwitch('Resume'));
		await settle();

		expect(templateSwitch('Resume').getAttribute('aria-pressed')).toBe('false');
		expect(templateSwitch('CV').getAttribute('aria-pressed')).toBe('true');
		expect(templateSwitch('Site').getAttribute('aria-pressed')).toBe('true');
		expect(sent).toEqual([
			{
				url: '/api/profile-section/work_experience_technology/7',
				method: 'PATCH',
				body: { tags: ['!resume', '!citrus'], expected: { tags: ['!citrus'] } }
			}
		]);
	});

	test('a technology off both documents is marked on its chip', async () => {
		renderChips([{ id: 7, name: 'Tailwind CSS', tags: ['!resume'] }]);
		expect(screen.queryByTitle(/Profile-only/)).toBeNull();

		await fireEvent.click(chip('Tailwind CSS'));
		await fireEvent.click(templateSwitch('CV'));
		await settle();
		await fireEvent.click(screen.getByRole('button', { name: 'Done' }));

		expect(patches()[0].body).toEqual({
			tags: ['!resume', '!cv'],
			expected: { tags: ['!resume'] }
		});
		expect(screen.getByTitle(/Profile-only/)).toBeTruthy();
	});

	test('the second of two quick switches waits for the first instead of conflicting', async () => {
		vi.useFakeTimers();
		holding = true;
		renderChips([{ id: 7, name: 'Caddy', tags: null }]);

		await fireEvent.click(chip('Caddy'));
		await fireEvent.click(templateSwitch('Resume'));
		await fireEvent.click(templateSwitch('CV'));
		// Both switches show what was asked while only the first is on the wire.
		expect(templateSwitch('Resume').getAttribute('aria-pressed')).toBe('false');
		expect(templateSwitch('CV').getAttribute('aria-pressed')).toBe('false');
		expect(patches()).toHaveLength(1);

		land();
		await settle();
		// The first landing does not put the second switch back.
		expect(templateSwitch('CV').getAttribute('aria-pressed')).toBe('false');

		await vi.advanceTimersByTimeAsync(700);
		land();
		await settle();
		expect(patches().map((r) => r.body)).toEqual([
			{ tags: ['!resume'], expected: { tags: null } },
			{ tags: ['!resume', '!cv'], expected: { tags: ['!resume'] } }
		]);
	});

	test('Add opens a new chip by its name, and the create carries its switches', async () => {
		renderChips([]);

		await fireEvent.click(screen.getByRole('button', { name: 'Add' }));
		const name = screen.getByLabelText('Name') as HTMLInputElement;
		expect(document.activeElement).toBe(name);

		// Before it has a name the chip does not exist yet, so the switch has
		// nothing to patch and waits for the create.
		await fireEvent.click(templateSwitch('Site'));
		expect(sent).toHaveLength(0);

		await fireEvent.input(name, { target: { value: 'Tauri' } });
		await fireEvent.click(screen.getByRole('button', { name: 'Done' }));
		await settle();

		expect(sent).toEqual([
			{
				url: '/api/profile-section/work_experience_technology',
				method: 'POST',
				body: { name: 'Tauri', tags: ['!portfolio'], work_experience_id: 232, profile_id: 1 }
			}
		]);
		expect(chip('Tauri')).toBeTruthy();
	});

	test('a chip added and left unnamed goes away without a request', async () => {
		renderChips([]);

		await fireEvent.click(screen.getByRole('button', { name: 'Add' }));
		await fireEvent.click(screen.getByRole('button', { name: 'Done' }));
		await settle();

		expect(sent).toHaveLength(0);
		expect(screen.queryByRole('button', { name: /Technology/ })).toBeNull();
	});

	test('a cleared name is not saved, and the chip keeps the old one', async () => {
		renderChips([{ id: 7, name: 'Docker Compose', tags: null }]);

		await fireEvent.click(chip('Docker Compose'));
		await fireEvent.input(screen.getByLabelText('Name'), { target: { value: '  ' } });
		await fireEvent.click(screen.getByRole('button', { name: 'Done' }));
		await settle();

		expect(sent).toHaveLength(0);
		expect(chip('Docker Compose')).toBeTruthy();
	});

	test('Delete removes the technology on the server', async () => {
		renderChips([
			{ id: 7, name: 'Groq', tags: null },
			{ id: 8, name: 'Gemini', tags: null }
		]);

		await fireEvent.click(chip('Groq'));
		await fireEvent.click(screen.getByRole('button', { name: 'Delete technology' }));
		await settle();

		expect(sent).toEqual([
			{ url: '/api/profile-section/work_experience_technology/7', method: 'DELETE', body: null }
		]);
		expect(screen.queryByRole('button', { name: /Groq/ })).toBeNull();
		expect(chip('Gemini')).toBeTruthy();
	});
});
