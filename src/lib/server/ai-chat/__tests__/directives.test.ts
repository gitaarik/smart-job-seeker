/**
 * Tests for the standing directives: the block every prompt that asks for them
 * gets, and the one write path.
 *
 * What is pinned is what would be silent when wrong:
 *
 *  - the block says it is the whole list, and in the empty state says there is
 *    nothing — the answer to "what have I told you?" must not be filled from
 *    the CV, which is what the Phase 0 eval caught it doing;
 *  - a failed read does NOT read as the empty state;
 *  - a writer only sees what applies to it, and nothing at all when that is
 *    nothing;
 *  - the ceiling holds for every topic at full length, and when it has to give
 *    it shortens and says so rather than dropping a directive;
 *  - a supersede retires the old row before inserting the new one, because the
 *    one-live-per-topic index refuses the other order.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';

type Row = Record<string, unknown>;

let rows: Row[] = [];
let readFails = false;
let liveRow: Row | undefined;
const ops: { op: string; detail: Record<string, unknown> }[] = [];

const tx = {
	select: () => ({
		from: () => ({ where: () => ({ for: async () => (liveRow ? [liveRow] : []) }) })
	}),
	update: () => ({
		set: (values: Row) => ({
			where: async () => {
				ops.push({ op: 'update', detail: values });
			}
		})
	}),
	insert: () => ({
		values: (values: Row) => ({
			returning: async () => {
				ops.push({ op: 'insert', detail: values });
				return [{ id: 99 }];
			}
		})
	})
};

vi.mock('$lib/server/db', () => ({
	db: {},
	dbDirect: {
		select: () => ({
			from: () => ({
				where: () => ({
					orderBy: async () => {
						if (readFails) throw new Error('connection reset');
						return rows;
					}
				})
			})
		}),
		transaction: async (fn: (t: typeof tx) => Promise<void>) => fn(tx)
	}
}));

const {
	DIRECTIVE_TOPIC_NAMES,
	DIRECTIVES_CEILING_CHARS,
	DIRECTIVES_UNREADABLE,
	MAX_STATEMENT_CHARS,
	directivesText,
	formatDirectives,
	loadDirectiveHistory,
	loadDirectives,
	writeDirectives
} = await import('../directives');

type Directive = Parameters<typeof formatDirectives>[0][number];

const STATED = new Date('2026-09-22T10:00:00Z');

function directive(topic: string, statement: string, appliesTo = ['chat']): Directive {
	return { id: 1, topic, statement, appliesTo, statedAt: STATED, source: 'chat' };
}

function row(overrides: Row): Row {
	return {
		id: 1,
		profile_id: 3,
		topic: 'domains',
		statement: 'No defence work.',
		applies_to: ['chat'],
		stated_at: STATED,
		source: { type: 'chat' },
		superseded_by: null,
		retired_at: null,
		...overrides
	};
}

beforeEach(() => {
	rows = [];
	readFails = false;
	liveRow = undefined;
	ops.length = 0;
});

describe('the chat block', () => {
	it('says there is nothing when there is nothing, and keeps the profile out of it', () => {
		const text = formatDirectives([], 'chat');
		expect(text).toContain('Nothing: they have not recorded a standing directive');
		expect(text).toContain('your inference, not something they said');
		// The agrees-and-forgets failure, stated in the empty state too.
		expect(text).toContain('Never tell them you will remember something');
	});

	it('lists every directive with its date, and says it is the whole list', () => {
		const text = formatDirectives([directive('domains', 'No healthcare or defence work.')], 'chat');
		expect(text).toContain('- Domains (stated 2026-09-22): No healthcare or defence work.');
		expect(text).toContain('this is the whole list');
	});

	it('names the topics nothing has been said about, so silence is not read as indifference', () => {
		const text = formatDirectives([directive('domains', 'No defence work.')], 'chat');
		expect(text).toContain(
			'Nothing recorded on: positioning, writing style, personal details, working with you.'
		);
	});

	it('limits output, not discussion', () => {
		const text = formatDirectives([directive('domains', 'No healthcare.')], 'chat');
		expect(text).toContain('They limit what you produce, not what you may discuss');
	});

	it('does not look like the empty state when the read failed', () => {
		expect(DIRECTIVES_UNREADABLE).not.toContain('Nothing:');
		expect(DIRECTIVES_UNREADABLE).toContain('never tell them they have none');
	});
});

describe('a writer', () => {
	it('sees only the directives that apply to it', () => {
		const text = formatDirectives(
			[
				directive('domains', 'No defence work.', ['chat']),
				directive('writing_style', 'Never open with "I am excited to".', [
					'chat',
					'letters',
					'answers'
				])
			],
			'letters'
		);
		expect(text).toContain('- Writing style: Never open with "I am excited to".');
		expect(text).not.toContain('defence');
	});

	it('gets nothing at all when nothing applies, not an empty-state note', () => {
		expect(formatDirectives([directive('domains', 'No defence work.')], 'answers')).toBe('');
		expect(formatDirectives([], 'letters')).toBe('');
	});

	it('is told the directives never change the output format', () => {
		const text = formatDirectives(
			[directive('writing_style', 'Short sentences.', ['letters'])],
			'letters'
		);
		expect(text).toContain('never the output format');
	});
});

describe('the ceiling', () => {
	const everyTopicAtFullLength = DIRECTIVE_TOPIC_NAMES.map((topic) =>
		directive(topic, 'x'.repeat(MAX_STATEMENT_CHARS), ['chat', 'letters', 'answers'])
	);

	it('holds every topic at full length without cutting anything', () => {
		// The ratchet: one live row per topic, each capped, fits whole. If a topic
		// or the framing grows past this, the ceiling has to move deliberately.
		for (const consumer of ['chat', 'letters', 'answers'] as const) {
			const text = formatDirectives(everyTopicAtFullLength, consumer);
			expect(text.length, consumer).toBeLessThanOrEqual(DIRECTIVES_CEILING_CHARS);
			expect(text, consumer).not.toContain('were shortened');
		}
	});

	it('shortens every statement and says so, rather than dropping one', () => {
		const text = formatDirectives(everyTopicAtFullLength, 'chat', 2500);
		expect(text.length).toBeLessThanOrEqual(2500 + 200);
		for (const topic of ['Domains', 'Positioning', 'Writing style']) expect(text).toContain(topic);
		expect(text).toContain('were shortened to fit');
		expect(text).toContain('/data/directives');
	});
});

describe('reading', () => {
	it('returns the live rows in topic order, whatever order they were written in', async () => {
		rows = [
			row({ id: 2, topic: 'writing_style', statement: 'Plain.' }),
			row({ id: 1, topic: 'domains', statement: 'No defence.' })
		];
		const live = await loadDirectives(3);
		expect(live.map((d) => d.topic)).toEqual(['domains', 'writing_style']);
		expect(live[0]).toMatchObject({ statement: 'No defence.', source: 'chat' });
	});

	it('keeps only what ended in the history, with when it ended', async () => {
		const later = new Date('2026-09-23T10:00:00Z');
		rows = [
			row({ id: 3, topic: 'domains', statement: 'No defence or healthcare.', stated_at: later }),
			row({ id: 2, topic: 'domains', statement: 'No defence.', superseded_by: 3 }),
			row({ id: 1, topic: 'positioning', statement: 'Lead with billing.', retired_at: later })
		];
		const history = await loadDirectiveHistory(3);
		expect(history.map((h) => h.id)).toEqual([2, 1]);
		expect(history[0]).toMatchObject({ supersededBy: 3, endedAt: later });
		expect(history[1]).toMatchObject({ supersededBy: null, endedAt: later });
	});

	it('tells the chat the read failed rather than that there are none', async () => {
		readFails = true;
		vi.spyOn(console, 'error').mockImplementation(() => {});
		expect(await directivesText(3, 'chat')).toBe(DIRECTIVES_UNREADABLE);
		expect(await directivesText(3, 'letters')).toBe('');
	});
});

describe('writing', () => {
	it('adds a first statement on a topic', async () => {
		await writeDirectives(3, { domains: 'No defence work.' }, 'chat');
		expect(ops).toEqual([
			{
				op: 'insert',
				detail: expect.objectContaining({
					profile_id: 3,
					topic: 'domains',
					statement: 'No defence work.',
					applies_to: ['chat'],
					source: { type: 'chat' }
				})
			}
		]);
	});

	it('supersedes in the order the one-live-per-topic index allows', async () => {
		liveRow = row({ id: 7, statement: 'No defence work.' });
		await writeDirectives(3, { domains: 'No defence or healthcare work.' }, 'chat');

		expect(ops.map((o) => o.op)).toEqual(['update', 'insert', 'update']);
		// Out of the live set first, so the insert does not collide...
		expect(ops[0].detail).toHaveProperty('retired_at');
		// ...then pointed at its successor, which also makes it not-retired.
		expect(ops[2].detail).toMatchObject({ superseded_by: 99, retired_at: null });
	});

	it('writes nothing when the statement is already the live one', async () => {
		liveRow = row({ id: 7, statement: 'No defence work.' });
		const { written } = await writeDirectives(3, { domains: '  No defence work. ' }, 'chat');
		expect(written).toEqual([]);
		expect(ops).toEqual([]);
	});

	it('retires on null, and does nothing when there was nothing', async () => {
		liveRow = row({ id: 7 });
		await writeDirectives(3, { domains: null }, 'ui');
		expect(ops).toEqual([
			{ op: 'update', detail: expect.objectContaining({ retired_at: expect.any(Date) }) }
		]);

		ops.length = 0;
		liveRow = undefined;
		expect((await writeDirectives(3, { domains: null }, 'ui')).written).toEqual([]);
	});

	it('writes the topic default consumers onto the row', async () => {
		await writeDirectives(3, { writing_style: 'Plain words.' }, 'chat');
		expect(ops[0].detail.applies_to).toEqual(['chat', 'letters', 'answers']);
	});

	it('keeps an imported date', async () => {
		const said = new Date('2025-01-02T00:00:00Z');
		await writeDirectives(3, { domains: 'No defence.' }, 'import', { statedAt: said });
		expect(ops[0].detail).toMatchObject({ stated_at: said, source: { type: 'import' } });
	});

	it('refuses a topic outside the list, and a blank statement', async () => {
		await expect(writeDirectives(3, { salary: '90/h' }, 'chat')).rejects.toThrow('Unknown');
		await expect(writeDirectives(3, { domains: '   ' }, 'chat')).rejects.toThrow('Empty');
		expect(ops).toEqual([]);
	});
});
