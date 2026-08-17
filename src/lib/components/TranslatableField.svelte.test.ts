import { describe, expect, test, beforeEach, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/svelte';
import TranslatableField from './TranslatableField.svelte';
import { translations } from '$lib/stores/translations.svelte';

// The store debounce-saves and lazily loads overlays; neither is under test.
beforeEach(() => {
	vi.stubGlobal(
		'fetch',
		vi.fn(async () => new Response(JSON.stringify({ translations: [] }), { status: 200 }))
	);
	translations.values = {};
	translations.setActive('en');
});

const FIELD = { entity: 'profile', id: 7, field: 'summary', multiline: true } as const;

describe('TranslatableField multiline', () => {
	test('the base field keeps its two-way binding through AutoGrowTextarea', async () => {
		// AutoGrowTextarea owns the element and binds `value` itself, so the
		// parent form's binding now travels one component deeper than it did
		// when this was a plain <textarea>.
		const props = $state({ ...FIELD, value: 'Base text' });
		render(TranslatableField, props);

		const el = screen.getByRole('textbox') as HTMLTextAreaElement;
		expect(el.value).toBe('Base text');

		await fireEvent.input(el, { target: { value: 'Edited base' } });
		expect(props.value).toBe('Edited base');
	});

	test('a translation typed into the field reaches the store and stays on screen', async () => {
		// The translation branch is controlled — `value` in, `oninput` out —
		// while AutoGrowTextarea binds the same prop internally. If those two
		// fought, the character you typed would be reverted on the next render.
		translations.setActive('nl');
		render(TranslatableField, { ...FIELD, value: 'Base text' });

		const el = screen.getByPlaceholderText('Translation…') as HTMLTextAreaElement;
		await fireEvent.input(el, { target: { value: 'Nederlandse tekst' } });

		expect(translations.get('profile', 7, 'summary')).toBe('Nederlandse tekst');
		expect(el.value).toBe('Nederlandse tekst');
	});

	test('an auto-translated value pushed into the store shows up in the field', async () => {
		// Auto-translate writes through setLocal rather than the input event,
		// so the field only updates if the prop still drives the element.
		translations.setActive('nl');
		render(TranslatableField, { ...FIELD, value: 'Base text' });

		const el = screen.getByPlaceholderText('Translation…') as HTMLTextAreaElement;
		translations.setLocal('profile', 7, 'summary', 'Automatisch vertaald');
		await vi.waitFor(() => expect(el.value).toBe('Automatisch vertaald'));
	});

	test('growth is capped so a long value cannot run off the form', () => {
		render(TranslatableField, { ...FIELD, value: 'Base text', rows: 5, maxRows: 9 });
		const el = screen.getByRole('textbox') as HTMLTextAreaElement;
		expect(el.rows).toBe(5);
		expect(el.style.resize).toBe('none');
	});
});
