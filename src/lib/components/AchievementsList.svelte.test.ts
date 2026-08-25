import { describe, expect, test, beforeEach, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/svelte';
import AchievementsList, { type AchievementItem } from './AchievementsList.svelte';
import { translations } from '$lib/stores/translations.svelte';

/**
 * The edit popup's two modes.
 *
 * With a persisting parent (`onItemChange`) the popup is live: what is typed
 * reaches the parent as it is typed, Done and Escape only close, and a change
 * the parent makes to the entry — an Undo through its store — shows up in the
 * open popup. Without one it stages: nothing leaves the popup until Done, and
 * Cancel drops it. The first is what the work-experience and side-project pages
 * rely on; the second is the profile wizard, which only holds the array.
 */

// The translation tabs load overlays and debounce-save; neither is under test.
beforeEach(() => {
	vi.stubGlobal(
		'fetch',
		vi.fn(async () => new Response(JSON.stringify({ translations: [] }), { status: 200 }))
	);
	translations.values = {};
	translations.setActive('en');
});

const ITEM: AchievementItem = { id: 5, key: 1, description: 'Shipped it', tags: null };
const PLACEHOLDER = 'Describe your achievement...';

async function openPopup(text: string): Promise<HTMLTextAreaElement> {
	await fireEvent.click(screen.getByText(text));
	return screen.getByPlaceholderText(PLACEHOLDER) as HTMLTextAreaElement;
}

describe('AchievementsList edit popup, live (a persisting parent)', () => {
	test('what is typed reaches the parent as it is typed, and Done only closes', async () => {
		const onItemChange = vi.fn();
		const onItemBlur = vi.fn();
		render(AchievementsList, {
			achievements: [ITEM],
			entity: 'work_experience_achievement',
			onItemChange,
			onItemBlur
		});

		const el = await openPopup('Shipped it');
		await fireEvent.input(el, { target: { value: 'Shipped it faster' } });

		expect(onItemChange).toHaveBeenCalledWith(0, {
			id: 5,
			key: 1,
			description: 'Shipped it faster',
			tags: null
		});
		expect(onItemBlur).not.toHaveBeenCalled();
		// Nothing is staged, so there is nothing for a Cancel to drop.
		expect(screen.queryByRole('button', { name: 'Cancel' })).toBeNull();
		expect(screen.getByText('Saves as you type')).toBeTruthy();

		await fireEvent.click(screen.getByRole('button', { name: 'Done' }));
		expect(onItemBlur).toHaveBeenCalledWith(0);
		expect(screen.queryByPlaceholderText(PLACEHOLDER)).toBeNull();
		// The list behind the popup shows what was typed, Done or no Done.
		expect(screen.getByText('Shipped it faster')).toBeTruthy();
	});

	test('Escape is Done, not Cancel', async () => {
		const onItemBlur = vi.fn();
		render(AchievementsList, {
			achievements: [ITEM],
			entity: 'work_experience_achievement',
			onItemChange: vi.fn(),
			onItemBlur
		});

		const el = await openPopup('Shipped it');
		await fireEvent.input(el, { target: { value: 'Shipped it faster' } });
		await fireEvent.keyDown(window, { key: 'Escape' });

		expect(onItemBlur).toHaveBeenCalledWith(0);
		expect(screen.queryByPlaceholderText(PLACEHOLDER)).toBeNull();
		expect(screen.getByText('Shipped it faster')).toBeTruthy();
	});

	test('a tag toggled in the popup reaches the parent too', async () => {
		const onItemChange = vi.fn();
		render(AchievementsList, {
			achievements: [ITEM],
			entity: 'work_experience_achievement',
			showTags: true,
			versionSlugs: ['lean'],
			onItemChange
		});

		await openPopup('Shipped it');
		await fireEvent.click(screen.getByRole('button', { name: /Resume \/ CV Versions/ }));
		// "Show only on" and "Hide from" each offer the slug; the first whitelists.
		await fireEvent.click(screen.getAllByRole('button', { name: 'lean' })[0]);

		expect(onItemChange).toHaveBeenLastCalledWith(0, {
			id: 5,
			key: 1,
			description: 'Shipped it',
			tags: ['lean']
		});
	});

	test('a change the parent makes to the entry shows up in the open popup', async () => {
		// An Undo reverts the row through the parent's store; the parent writes
		// it back into `achievements`, and the popup must follow rather than keep
		// showing the text the undo just took away.
		const { rerender } = render(AchievementsList, {
			achievements: [ITEM],
			entity: 'work_experience_achievement',
			onItemChange: vi.fn()
		});

		const el = await openPopup('Shipped it');
		await fireEvent.input(el, { target: { value: 'Shipped it faster' } });
		await rerender({ achievements: [{ ...ITEM, description: 'Shipped it' }] });

		await vi.waitFor(() => expect(el.value).toBe('Shipped it'));
	});

	test("the popup carries the row's own save status, Undo included", async () => {
		const status = {
			status: 'saved' as const,
			error: null,
			canUndo: true,
			undo: vi.fn(),
			retry: vi.fn()
		};
		render(AchievementsList, {
			achievements: [ITEM],
			entity: 'work_experience_achievement',
			onItemChange: vi.fn(),
			statusFor: () => status
		});

		await openPopup('Shipped it');
		await fireEvent.click(screen.getByRole('button', { name: 'Undo' }));

		expect(status.undo).toHaveBeenCalled();
	});
});

describe('AchievementsList edit popup, staged (the wizard holds the array)', () => {
	test('nothing leaves the popup until Done, and Cancel drops it', async () => {
		render(AchievementsList, { achievements: ['One'] });

		await openPopup('One');
		await fireEvent.input(screen.getByPlaceholderText(PLACEHOLDER), {
			target: { value: 'One more' }
		});
		expect(screen.queryByText('One more')).toBeNull();

		await fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));
		expect(screen.queryByPlaceholderText(PLACEHOLDER)).toBeNull();
		expect(screen.getByText('One')).toBeTruthy();

		await openPopup('One');
		await fireEvent.input(screen.getByPlaceholderText(PLACEHOLDER), {
			target: { value: 'One more' }
		});
		await fireEvent.click(screen.getByRole('button', { name: 'Done' }));
		expect(screen.getByText('One more')).toBeTruthy();
	});

	test('Escape drops a staged edit', async () => {
		render(AchievementsList, { achievements: ['One'] });

		await openPopup('One');
		await fireEvent.input(screen.getByPlaceholderText(PLACEHOLDER), {
			target: { value: 'One more' }
		});
		await fireEvent.keyDown(window, { key: 'Escape' });

		expect(screen.queryByPlaceholderText(PLACEHOLDER)).toBeNull();
		expect(screen.getByText('One')).toBeTruthy();
		expect(screen.queryByText('One more')).toBeNull();
	});
});
