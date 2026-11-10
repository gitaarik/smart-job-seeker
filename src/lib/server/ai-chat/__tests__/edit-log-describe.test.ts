/**
 * The history's field-level diff: what /data/ai-changes shows under one entry.
 *
 * Kept apart from edit-log.test.ts, which stands the whole registry in with a
 * mock. The diff is only worth testing against the real one — its question is
 * which fields a section has, and the answer lives in the declaration.
 */

import { describe, expect, it, vi } from 'vitest';
import type { EditLogEntry } from '../edit-log';

// Imported for its declarations; nothing here reads or writes.
vi.mock('$lib/server/db', () => ({ db: {}, dbDirect: {} }));

const { describeLoggedChange } = await import('../edit-log');

function entry(fields: Record<string, unknown>, previous: Record<string, unknown>): EditLogEntry {
	return {
		id: 1,
		capability: 'edit_reference',
		source: 'mcp',
		target: { id: 13, label: 'Eva Bakker, Co-founder of Tulip Labs' },
		fields,
		previous,
		revertedAt: null,
		createdAt: new Date('2026-09-23T12:00:00Z'),
		title: 'Correct this reference',
		revertible: true,
		supersededBy: null,
		direct: false
	};
}

describe('describeLoggedChange', () => {
	it('shows a translation right after the English it translates', () => {
		const changes = describeLoggedChange(
			entry(
				{ 'reference.text.nl': 'Rik leidde.', 'reference.text': 'Rik led.' },
				{ 'reference.text.nl': null, 'reference.text': 'Rik was there.' }
			)
		);

		expect(changes).toEqual([
			{ field: 'text', label: 'Text', from: 'Rik was there.', to: 'Rik led.' },
			{ field: 'text.nl', label: 'Text (Dutch)', from: '—', to: 'Rik leidde.' }
		]);
	});

	it('shows a change of the translation alone', () => {
		const changes = describeLoggedChange(
			entry(
				{ 'reference.author_position.nl': 'Oprichter van Northgate' },
				{ 'reference.author_position.nl': 'Oprichter' }
			)
		);

		expect(changes).toEqual([
			{
				field: 'author_position.nl',
				label: 'Their role (Dutch)',
				from: 'Oprichter',
				to: 'Oprichter van Northgate'
			}
		]);
	});

	it('still describes a change the page made, which records bare columns', () => {
		expect(describeLoggedChange(entry({ text: 'Rik led.' }, { text: 'Rik was there.' }))).toEqual([
			{ field: 'text', label: 'Text', from: 'Rik was there.', to: 'Rik led.' }
		]);
	});

	it('shows a reorder an agent asked for as the list its card showed', () => {
		const changes = describeLoggedChange({
			...entry(
				{ 'language.order': [8, 7] },
				{ order: [7, 8], names: { 7: 'Dutch', 8: 'English' } }
			),
			capability: 'reorder_language'
		});

		expect(changes.map((change) => change.order)).toEqual([
			[
				{
					name: null,
					entries: [
						{ id: 8, name: 'English', was: 2 },
						{ id: 7, name: 'Dutch', was: 1 }
					]
				}
			]
		]);
	});

	it('shows a tag change as where the entry prints, as its card did', () => {
		// The column diff would print the tag strings, which are the mechanism.
		const changes = describeLoggedChange({
			...entry({ 'work_experience_achievement.tags': ['!resume'] }, { tags: null }),
			capability: 'tag_work_experience_achievement'
		});

		expect(changes).toEqual([
			{
				field: 'work_experience_achievement.tags',
				label: 'Where it prints',
				from: 'Everywhere',
				to: 'Not on the resume'
			}
		]);
	});

	it('shows a delete an agent asked for as the entry going, and what went with it', () => {
		const changes = describeLoggedChange({
			...entry(
				{},
				{
					'language.name': 'Spanish',
					'language.proficiency': 'Intermediate',
					deleted_with: ['1 certificate skill']
				}
			),
			capability: 'delete_language'
		});

		expect(changes).toContainEqual({ field: 'name', label: 'Name', from: 'Spanish', to: '—' });
		expect(changes.at(-1)).toEqual({
			field: 'deleted_with',
			label: 'Deleted with it',
			from: '1 certificate skill',
			to: '—'
		});
	});

	it('shows a delete made on the page as the row going, with nothing added', () => {
		// `deleteRow` records the bare row, and knows nothing of what went with it.
		const changes = describeLoggedChange({
			...entry({}, { name: 'Spanish' }),
			capability: 'delete_language',
			source: 'ui'
		});

		expect(changes).toEqual([{ field: 'name', label: 'Name', from: 'Spanish', to: '—' }]);
	});

	it('shows nothing under a reorder made by dragging, which kept only ids', () => {
		const changes = describeLoggedChange({
			...entry({ order: [8, 7] }, { order: [7, 8] }),
			capability: 'reorder_language',
			source: 'ui'
		});

		expect(changes).toEqual([]);
	});
});
