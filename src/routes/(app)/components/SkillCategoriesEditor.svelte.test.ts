import { beforeEach, describe, expect, test, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/svelte';
import SkillCategoriesEditor from './SkillCategoriesEditor.svelte';
import type { CategoryItem } from './SkillCategoriesEditor.svelte';
import { translations } from '$lib/stores/translations.svelte';

/**
 * The editor's per-row state, across a removal.
 *
 * Five collections here remembered something about a category: whether it is
 * unsaved, its name and note as editing started, which row is expanded, which
 * has its tags open, and which is being edited. All five were keyed by array
 * position and a removal shifted three, so removing a category above one being
 * edited moved the inline editor onto a different row, and cancelling from
 * there wrote the first category's note onto the second.
 *
 * Tested through the DOM because that last one is a wrong value landing on a
 * real row, and reasoning about the collections is what missed it.
 *
 * Note the assertions read the category objects rather than the array: the
 * component reassigns `categories`, which only reaches a caller that binds, and
 * testing-library passes props one way. The objects themselves are shared, and
 * are what the component edits in place.
 */

beforeEach(() => {
	// TranslatableField loads overlays on mount; neither it nor the debounced
	// save is under test.
	vi.stubGlobal(
		'fetch',
		vi.fn(async () => new Response(JSON.stringify({ translations: [] }), { status: 200 }))
	);
	translations.values = {};
	translations.setActive('en');
	vi.stubGlobal('confirm', () => true);
});

function threeCategories(): CategoryItem[] {
	const categories = $state<CategoryItem[]>([
		{ name: 'Alpha', note: 'note-alpha', skills: [] },
		{ name: 'Beta', note: 'note-beta', skills: [] },
		{ name: 'Gamma', note: 'note-gamma', skills: [] }
	]);
	return categories;
}

/** The pencil beside a category's name, which opens the inline editor. */
const editButtons = () => screen.getAllByLabelText('Edit category name and note');
const removeButtons = () => screen.getAllByLabelText('Remove category');

/** The name and note fields of whichever row is being edited. */
const nameInput = () => screen.getByPlaceholderText('Category name') as HTMLInputElement;
const noteInput = () => screen.getByPlaceholderText(/^Note \(private hint/) as HTMLInputElement;

/** The category names the editor is currently showing, in order. */
function renderedNames(): string[] {
	return screen.getAllByRole('heading', { level: 3 }).map((h) => h.textContent?.trim() ?? '');
}

describe('SkillCategoriesEditor', () => {
	test('the inline editor stays on the row it was opened on when a row above is removed', async () => {
		render(SkillCategoriesEditor, { categories: threeCategories(), onremove: vi.fn() });

		await fireEvent.click(editButtons()[1]); // Beta
		expect(noteInput().value).toBe('note-beta');

		await fireEvent.click(removeButtons()[0]); // Alpha

		// Beta is now the first row. Under position keying the editing index
		// stayed at 1, which is Gamma.
		expect(noteInput().value).toBe('note-beta');
	});

	test("cancelling after a removal reverts the edited row, not another row's note onto it", async () => {
		const categories = threeCategories();
		const [, beta, gamma] = categories;
		render(SkillCategoriesEditor, { categories, onremove: vi.fn() });

		await fireEvent.click(editButtons()[1]); // Beta, snapshot taken
		await fireEvent.input(noteInput(), { target: { value: 'edited' } });
		await fireEvent.click(removeButtons()[0]); // Alpha
		await fireEvent.click(screen.getByLabelText('Cancel'));

		// The two snapshot maps were shifted by different amounts on the
		// removal — names by one, notes not at all — so Cancel found no name
		// snapshot to restore and found the note snapshot under the index now
		// holding Gamma. Beta kept the edit it was meant to lose, and Gamma's
		// note was overwritten with Beta's.
		expect([beta.name, beta.note]).toEqual(['Beta', 'note-beta']);
		expect([gamma.name, gamma.note]).toEqual(['Gamma', 'note-gamma']);
		expect(renderedNames()).toEqual(['Beta', 'Gamma']);
	});

	test('an unsaved category is still unsaved after a row above it is removed', async () => {
		const oncreate = vi.fn();
		const onrename = vi.fn();
		render(SkillCategoriesEditor, {
			categories: threeCategories(),
			oncreate,
			onrename,
			onremove: vi.fn()
		});

		await fireEvent.click(screen.getByText('Add category'));
		await fireEvent.input(nameInput(), { target: { value: 'Delta' } });
		await fireEvent.input(noteInput(), { target: { value: 'note-delta' } });
		await fireEvent.click(removeButtons()[0]); // Alpha
		await fireEvent.click(screen.getByLabelText('Save'));

		// Whether a row has ever been persisted is what picks the callback, so a
		// marker naming the wrong row renames a category that has no id.
		expect(onrename).not.toHaveBeenCalled();
		expect(oncreate).toHaveBeenCalledTimes(1);
		expect(oncreate.mock.calls[0][0].name).toBe('Delta');
		expect(renderedNames()).toEqual(['Beta', 'Gamma', 'Delta']);
	});

	test('removing a category reports that category', async () => {
		const onremove = vi.fn();
		render(SkillCategoriesEditor, { categories: threeCategories(), onremove });

		await fireEvent.click(removeButtons()[1]); // Beta

		expect(onremove).toHaveBeenCalledTimes(1);
		expect(onremove.mock.calls[0][0].name).toBe('Beta');
		expect(renderedNames()).toEqual(['Alpha', 'Gamma']);
	});
});
