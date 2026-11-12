import { beforeEach, describe, expect, test, vi } from 'vitest';
import { fireEvent, render, screen, waitFor, within } from '@testing-library/svelte';
import HighlightsPage from './+page.svelte';

/**
 * The page keeps two lists in one table: highlights, and the Services lines
 * a showcase portfolio prints beside its About me. Until it had a list for
 * each, every row it added was a highlight, so a Services line could only
 * be written into the database by hand.
 */

/** Every action the page posts, in order. */
const { posted } = vi.hoisted(() => ({
	posted: [] as { action: string; body: Record<string, string> }[]
}));

// What a form posts is asserted here; the round trip is the framework's, and
// its real `enhance` needs a running app to apply the result to. This one
// takes the submit, records the fields and answers success, so the page's own
// handler (closing the add form) still runs.
vi.mock('$app/forms', () => ({
	enhance: (form: HTMLFormElement, submit?: () => unknown) => {
		const onSubmit = async (event: Event) => {
			event.preventDefault();
			const body: Record<string, string> = {};
			for (const [k, v] of new FormData(form)) body[k] = String(v);
			posted.push({ action: (form.getAttribute('action') ?? '').replace('?/', ''), body });
			const after = submit?.();
			if (typeof after === 'function') {
				await after({ result: { type: 'success' }, update: async () => {} });
			}
		};
		form.addEventListener('submit', onSubmit);
		return { destroy: () => form.removeEventListener('submit', onSubmit) };
	}
}));

beforeEach(() => {
	posted.length = 0;
});

const ROWS = [
	{ id: 1, type: 'highlight', text: 'Shipped v1', icon_name: null, fa_icon: 'rocket', sort: 1 },
	{ id: 2, type: 'contact_for', text: 'Application development', icon_name: 'faCode', sort: 5 },
	{ id: 3, type: 'key_skill', text: 'Python, Django', icon_name: 'faPython', sort: 1 },
	{ id: 4, type: 'contact_for', text: 'Consulting', icon_name: 'faNoSuchIcon', sort: 6 }
];

function renderPage() {
	// The page's own `PageData` carries the whole layout tree; it reads this.
	render(HighlightsPage, {
		props: { data: { highlights: ROWS, profileId: 1 } as never, form: null }
	});
}

const contactFor = () => screen.getByRole('region', { name: 'Services' });

describe('highlights page', () => {
	test('lists the Services lines under their own heading, and every other row as a highlight', () => {
		renderPage();
		const section = within(contactFor());
		expect(section.getByText('Application development')).toBeTruthy();
		expect(section.getByText('Consulting')).toBeTruthy();
		expect(section.queryByText('Shipped v1')).toBeNull();
		// A retired kind stays where it can be seen and deleted.
		expect(screen.getByText('Python, Django')).toBeTruthy();
		expect(section.queryByText('Python, Django')).toBeNull();
	});

	test('adds a line to the Services list as a Services line', async () => {
		renderPage();
		await fireEvent.click(within(contactFor()).getByRole('button', { name: 'Add Line' }));
		await fireEvent.input(screen.getByLabelText(/Line Text/), {
			target: { value: 'AI & LLM integrations' }
		});
		await fireEvent.input(screen.getByLabelText('Icon Name'), { target: { value: 'robot' } });
		await fireEvent.click(within(contactFor()).getByRole('button', { name: 'Add Line' }));
		await waitFor(() => expect(posted).toHaveLength(1));
		expect(posted[0]).toEqual({
			action: 'create',
			body: { type: 'contact_for', text: 'AI & LLM integrations', icon_name: 'robot' }
		});
		// And the form closes once it is saved.
		await waitFor(() => expect(screen.queryByLabelText(/Line Text/)).toBeNull());
	});

	test('adds a highlight as a highlight', async () => {
		renderPage();
		await fireEvent.click(screen.getByRole('button', { name: 'Add Highlight' }));
		await fireEvent.input(screen.getByLabelText(/Highlight Text/), {
			target: { value: 'Led a team of five' }
		});
		await fireEvent.click(screen.getByRole('button', { name: 'Add Highlight' }));
		await waitFor(() => expect(posted).toHaveLength(1));
		expect(posted[0].body).toMatchObject({ type: 'highlight', text: 'Led a team of five' });
	});

	test('says when an icon name is not one the portfolio site has', () => {
		renderPage();
		const row = (text: string) => within(contactFor()).getByText(text).parentElement!;
		expect(row('Consulting').textContent).toContain('not one the portfolio site has');
		expect(row('Application development').textContent).not.toContain('not one');
	});
});
