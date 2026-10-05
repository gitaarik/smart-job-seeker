import { beforeEach, describe, expect, test, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/svelte';
import VersionWordings from './VersionWordings.svelte';
import type { WordingState } from '$lib/field-variants';

/**
 * The picker on a version page.
 *
 * What a version prints for a field is decided by rows on it and on the
 * versions it builds on; the rule is tested in field-variants.test.ts. This is
 * the control over it, and the two things it can get wrong on its own: asking
 * the server about the wrong field (a role's title is addressed by the role),
 * and telling the applicant an inherited pick is theirs.
 */

const VERSION = 30;

function title(over: Partial<WordingState> = {}): WordingState {
	return {
		key: 'work_experience:9:position',
		entity: 'work_experience',
		entityId: 9,
		field: 'position',
		label: 'Position',
		context: 'Chipta',
		multiline: false,
		rows: 3,
		own: 'Lead Engineer',
		options: [
			{ id: 1, label: 'Python', value: 'Senior Python Engineer', note: 'Python roles' },
			{ id: 2, label: 'Agency', value: 'Senior Engineer', note: null }
		],
		pickedId: null,
		from: 'own',
		inheritedFrom: null,
		source: 'base',
		reason: null,
		...over
	};
}

const fetchMock = vi.fn();
const radio = (name: RegExp) => screen.getByRole('radio', { name }) as HTMLInputElement;
const sent = () => JSON.parse(fetchMock.mock.calls.at(-1)?.[1].body as string);

beforeEach(() => {
	fetchMock.mockReset();
	fetchMock.mockResolvedValue(new Response('{}', { status: 200 }));
	vi.stubGlobal('fetch', fetchMock);
});

describe('VersionWordings', () => {
	test('names a role’s title by its employer, and shows the profile’s own as the choice', () => {
		render(VersionWordings, { versionId: VERSION, wordings: [title()] });
		// Two roles can both have a "Position"; the employer is what tells them apart.
		expect(screen.getByText('Position — Chipta')).toBeTruthy();
		expect(radio(/Your own position/).checked).toBe(true);
		expect(radio(/Python/).checked).toBe(false);
		expect(screen.getByText('Use for: Python roles')).toBeTruthy();
	});

	test('picks for the role it is shown under, not for a field of the profile', async () => {
		render(VersionWordings, { versionId: VERSION, wordings: [title()] });
		await fireEvent.click(radio(/Python/));

		expect(fetchMock).toHaveBeenCalledWith(
			'/api/field-variants/pick',
			expect.objectContaining({ method: 'PUT' })
		);
		expect(sent()).toEqual({
			versionId: VERSION,
			entity: 'work_experience',
			entityId: 9,
			field: 'position',
			variantId: 1
		});
		expect(radio(/Python/).checked).toBe(true);
	});

	test('shows an inherited pick as chosen, and says whose it is', () => {
		render(VersionWordings, {
			versionId: VERSION,
			wordings: [title({ pickedId: 1, from: 'inherited', inheritedFrom: 'Fullstack Python' })]
		});
		// It IS what this version prints, so it is the selected one…
		expect(radio(/Python/).checked).toBe(true);
		// …and it is not this version's decision, which the applicant has to know
		// before changing it: the change will apply here only.
		expect(screen.getByText(/Chosen on “Fullstack Python”/)).toBeTruthy();
	});

	test('choosing the profile’s own value over an inherited pick is sent as a choice', async () => {
		render(VersionWordings, {
			versionId: VERSION,
			wordings: [title({ pickedId: 1, from: 'inherited', inheritedFrom: 'Fullstack Python' })]
		});
		await fireEvent.click(radio(/Your own position/));

		// `null` is the whole instruction; the server works out that the base's
		// pick has to be taken back off for it to hold.
		expect(sent()).toMatchObject({ entityId: 9, field: 'position', variantId: null });
		expect(radio(/Your own position/).checked).toBe(true);
		// Once chosen here it is this version's own answer.
		await vi.waitFor(() => expect(screen.queryByText(/Chosen on “Fullstack Python”/)).toBeNull());
	});

	test('puts the choice back when the save fails', async () => {
		fetchMock.mockResolvedValue(new Response('Access denied', { status: 403 }));
		render(VersionWordings, {
			versionId: VERSION,
			wordings: [title({ pickedId: 2, from: 'this' })]
		});
		await fireEvent.click(radio(/Python/));

		await vi.waitFor(() => expect(screen.getByText('Access denied')).toBeTruthy());
		expect(radio(/Agency/).checked).toBe(true);
		expect(radio(/Python/).checked).toBe(false);
	});

	test('keeps two fields’ choices apart', async () => {
		const summary: WordingState = {
			...title(),
			key: 'profile:1:summary',
			entity: 'profile',
			entityId: 1,
			field: 'summary',
			label: 'Professional Summary',
			context: null,
			multiline: true,
			own: 'Engineer of long standing.',
			options: [{ id: 5, label: 'Backend', value: 'Backend engineer.', note: null }]
		};
		render(VersionWordings, { versionId: VERSION, wordings: [summary, title()] });
		await fireEvent.click(radio(/Backend/));

		expect(sent()).toMatchObject({
			entity: 'profile',
			entityId: 1,
			field: 'summary',
			variantId: 5
		});
		// The role's title is a separate group of radios and is left as it was.
		expect(radio(/Your own position/).checked).toBe(true);
		expect(radio(/Your own professional summary/).checked).toBe(false);
	});
});
