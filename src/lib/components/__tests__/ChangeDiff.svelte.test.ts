import { describe, expect, test } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/svelte';
import ChangeDiff from '../ChangeDiff.svelte';

/** Request 183, as the approvals page listed it: a translation rewritten from the English. */
const REWRITE = {
	field: 'side_project.summary.nl',
	label: 'Summary (Dutch)',
	from:
		'Verbetering voor Django Admin die de navigatie tussen gerelateerde databaseobjecten ' +
		'vereenvoudigt. Open-sourced op GitHub met 100+ sterren. Gebruikt in productie bij Chipta & Tender-it.',
	to:
		'Uitbreiding voor Django Admin die foreign keys en reverse relations omzet in klikbare links, ' +
		'zodat admins met één klik naar gerelateerde objecten springen. 100+ GitHub-sterren, op PyPI, ' +
		'in productie gebruikt bij Chipta & Tender-it.'
};

async function expand(changes: (typeof REWRITE)[]) {
	const view = render(ChangeDiff, { changes });
	await fireEvent.click(screen.getByRole('button', { name: /view full text/i }));
	return view;
}

describe('ChangeDiff', () => {
	test('shows a rewrite as the old text and the new one, each whole', async () => {
		// It used to show the new text alone and a list of fragments of the old
		// one, and the person approving could not see what was being replaced.
		const { container } = await expand([REWRITE]);

		expect(screen.getByText('Before')).toBeTruthy();
		expect(screen.getByText('After')).toBeTruthy();

		const [before, after] = [...container.querySelectorAll('pre')].map((pre) => pre.textContent);
		expect(before).toBe(REWRITE.from);
		expect(after).toBe(REWRITE.to);
	});

	test('marks what went in the old text and what arrived in the new', async () => {
		const { container } = await expand([REWRITE]);
		const [before, after] = container.querySelectorAll('pre');

		const removed = [...before.querySelectorAll('span')].map((span) => span.textContent);
		const added = [...after.querySelectorAll('span')].map((span) => span.textContent);
		expect(removed.some((text) => text?.includes('Verbetering'))).toBe(true);
		expect(added.some((text) => text?.includes('Uitbreiding'))).toBe(true);
		// Kept words are plain in both, which is what makes each side readable.
		expect(removed.some((text) => text?.includes('Django Admin'))).toBe(false);

		// Red but not struck through: the old text is still there to be read.
		expect(before.querySelector('span')?.classList.contains('line-through')).toBe(false);
	});

	test('keeps a small edit as one text marked in place', async () => {
		const small = { ...REWRITE, to: REWRITE.from.replace('100+', '150+') };
		const { container } = await expand([small]);

		expect(screen.queryByText('Before')).toBeNull();
		expect(container.querySelectorAll('pre')).toHaveLength(1);
		expect(container.querySelector('pre span.line-through')?.textContent).toContain('100+');
	});
});
