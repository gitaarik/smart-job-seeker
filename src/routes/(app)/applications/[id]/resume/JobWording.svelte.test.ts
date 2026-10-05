import { describe, expect, test, vi } from 'vitest';
import { fireEvent, render, screen, within } from '@testing-library/svelte';
import type { WordingState } from '$lib/field-variants';

// The forms post to the page's own action. What reaches the action is the
// form's fields, which is what is asserted here; the round trip itself is the
// framework's.
vi.mock('$app/forms', () => ({ enhance: () => ({ destroy: () => {} }) }));

const { default: JobWording } = await import('./JobWording.svelte');

/**
 * The selector for what one job's document calls something.
 *
 * The server side is tested in tailor-version-db.test.ts (what a choice writes)
 * and field-variants.test.ts (which wording then prints). This is the form in
 * between: whether each choice posts the field, the item and the pick the
 * action reads, since a selector that posted the wrong role would change
 * another role's title without an error anywhere.
 */

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
			{ id: 1, label: 'Politie', value: 'Senior Python Engineer', note: 'roles like Python' },
			{ id: 2, label: 'Tech Lead', value: 'Tech Lead', note: null }
		],
		pickedId: null,
		from: 'own',
		inheritedFrom: null,
		source: 'base',
		reason: null,
		...over
	};
}

const mount = (wording: WordingState) =>
	render(JobWording, { wording, docType: 'resume', baseSlug: 'fullstack-python' });

/** The fields one form would post, by name. */
function posted(form: HTMLFormElement): Record<string, string> {
	return Object.fromEntries(
		[...form.querySelectorAll<HTMLInputElement | HTMLTextAreaElement>('[name]')].map((el) => [
			el.name,
			el.value
		])
	);
}

const open = () => fireEvent.click(screen.getByRole('button', { name: 'Change' }));

describe('JobWording', () => {
	test('says what the document prints, and nothing more until asked', () => {
		mount(title());
		expect(screen.getByText('Position')).toBeTruthy();
		expect(screen.getByText('Lead Engineer')).toBeTruthy();
		expect(screen.queryByText('Something else for this job')).toBeNull();
	});

	test('shows a title changed for this job beside the one it replaces', () => {
		mount(title({ pickedId: 1, from: 'this', source: 'user', reason: 'you wrote this position' }));
		expect(screen.getByText('Senior Python Engineer')).toBeTruthy();
		expect(screen.getByText('instead of “Lead Engineer”')).toBeTruthy();
		// Whose decision it was is said, as it is for an item's switch.
		expect(screen.getByText(/you wrote this position/)).toBeTruthy();
		expect(screen.getByText(/yours/)).toBeTruthy();
	});

	test('says where an inherited title comes from', () => {
		mount(title({ pickedId: 1, from: 'inherited', inheritedFrom: 'Fullstack Python' }));
		expect(screen.getByText(/From “Fullstack Python”, which this\s+resume builds on/)).toBeTruthy();
	});

	test('offers the profile’s own title, each alternative, and something new', async () => {
		mount(title({ pickedId: 1, from: 'this' }));
		await open();

		const own = screen.getByRole('button', { name: /Lead Engineer.*your own position/s });
		const python = screen.getByRole('button', { name: /Senior Python Engineer.*Politie/s });
		const lead = screen.getByRole('button', { name: /^\s*Tech Lead\s*$/ });

		// The one already printing is marked and cannot be chosen again.
		expect(python.getAttribute('aria-pressed')).toBe('true');
		expect((python as HTMLButtonElement).disabled).toBe(true);
		expect(own.getAttribute('aria-pressed')).toBe('false');

		// Each choice names the role and the field, so a pick lands on this role's
		// title and no other's, and says what to build on if this is the first
		// change made for the job.
		const target = {
			entity: 'work_experience',
			entity_id: '9',
			field: 'position',
			doc_type: 'resume',
			base_slug: 'fullstack-python'
		};
		expect(posted(own.closest('form') as HTMLFormElement)).toEqual({ ...target, pick: 'own' });
		expect(posted(lead.closest('form') as HTMLFormElement)).toEqual({ ...target, pick: '2' });
		expect((own.closest('form') as HTMLFormElement).getAttribute('action')).toBe('?/setWording');
	});

	test('a wording named after its own text is not listed twice', async () => {
		mount(title());
		await open();
		// "Tech Lead" is both the label and the value of the second alternative.
		expect(screen.getAllByText('Tech Lead')).toHaveLength(1);
	});

	test('posts written text as a new wording for this job', async () => {
		mount(title());
		await open();

		const input = screen.getByLabelText('Something else for this job') as HTMLInputElement;
		// Seeded with what the document says now: a new title is nearly always an
		// edit of that.
		expect(input.value).toBe('Lead Engineer');
		const form = input.closest('form') as HTMLFormElement;
		const use = within(form).getByRole('button', { name: /Use this/ }) as HTMLButtonElement;
		// Nothing to save while it still says what the document already says.
		expect(use.disabled).toBe(true);

		await fireEvent.input(input, { target: { value: 'Python Tech Lead' } });
		expect(use.disabled).toBe(false);
		expect(posted(form)).toEqual({
			entity: 'work_experience',
			entity_id: '9',
			field: 'position',
			pick: 'new',
			doc_type: 'resume',
			base_slug: 'fullstack-python',
			text: 'Python Tech Lead'
		});
	});

	test('gives a summary room to be written in', async () => {
		mount(
			title({
				key: 'profile:1:summary',
				entity: 'profile',
				entityId: 1,
				field: 'summary',
				label: 'Professional Summary',
				context: null,
				multiline: true,
				rows: 4,
				own: 'Engineer of long standing.',
				options: []
			})
		);
		await open();
		const box = screen.getByLabelText('Something else for this job');
		expect(box.tagName).toBe('TEXTAREA');
		expect(posted(box.closest('form') as HTMLFormElement)).toMatchObject({
			entity: 'profile',
			entity_id: '1',
			field: 'summary',
			pick: 'new'
		});
	});
});
