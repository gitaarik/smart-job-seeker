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
		target: { id: 13, label: 'Elmar Krack, Co-founder of Tender-it' },
		fields,
		previous,
		revertedAt: null,
		createdAt: new Date('2026-09-23T12:00:00Z'),
		title: 'Correct this reference',
		revertible: true,
		supersededBy: null
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
				{ 'reference.author_position.nl': 'Oprichter van Chipta' },
				{ 'reference.author_position.nl': 'Oprichter' }
			)
		);

		expect(changes).toEqual([
			{
				field: 'author_position.nl',
				label: 'Their role (Dutch)',
				from: 'Oprichter',
				to: 'Oprichter van Chipta'
			}
		]);
	});

	it('still describes a change the page made, which records bare columns', () => {
		expect(describeLoggedChange(entry({ text: 'Rik led.' }, { text: 'Rik was there.' }))).toEqual([
			{ field: 'text', label: 'Text', from: 'Rik was there.', to: 'Rik led.' }
		]);
	});
});
