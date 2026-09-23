/**
 * The standing directives in the settings file: a memory that does not survive
 * moving instances is one the applicant loses by moving.
 *
 * Only the directive half of the settings export and import is exercised here;
 * the other sections are switched off so each test holds one variable.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';

const writes: {
	profileId: number;
	patch: Record<string, unknown>;
	source: string;
	opts: unknown;
}[] = [];

vi.mock('$lib/server/ai-chat/directives', async (importOriginal) => {
	const actual = await importOriginal<typeof import('$lib/server/ai-chat/directives')>();
	return {
		...actual,
		loadDirectives: vi.fn(async () => [
			{
				id: 1,
				topic: 'domains',
				statement: 'No defence work.',
				appliesTo: ['chat'],
				statedAt: new Date('2026-09-22T10:00:00Z'),
				source: 'chat'
			}
		]),
		writeDirectives: vi.fn(
			async (profileId: number, patch: Record<string, unknown>, source: string, opts: unknown) => {
				writes.push({ profileId, patch, source, opts });
				return { written: Object.keys(patch) };
			}
		)
	};
});

const TX = { marker: 'the import transaction' };
vi.mock('$lib/server/db', () => ({
	db: {},
	dbDirect: { transaction: async (fn: (tx: unknown) => Promise<void>) => fn(TX) }
}));

const { buildSettingsExport } = await import('../settings-export');
const { importSettings } = await import('../settings-import');

const NOTHING_ELSE = {
	includeTasks: false,
	includeMatchConfig: false,
	includeEmailDigest: false,
	includeSalary: false
};

const APPLY_NOTHING_ELSE = {
	replaceExistingTasks: false,
	applyMatchConfig: false,
	applyEmailDigest: false,
	applySalary: false
};

beforeEach(() => {
	writes.length = 0;
});

describe('export', () => {
	it('carries the live directives with the date they were stated', async () => {
		const data = await buildSettingsExport(3, { ...NOTHING_ELSE, includeDirectives: true });
		expect(data.directives).toEqual([
			{ topic: 'domains', statement: 'No defence work.', stated_at: '2026-09-22T10:00:00.000Z' }
		]);
	});

	it('leaves them out when asked to', async () => {
		const data = await buildSettingsExport(3, { ...NOTHING_ELSE, includeDirectives: false });
		expect(data.directives).toBeUndefined();
	});
});

describe('import', () => {
	const file = {
		version: '1.0' as const,
		exported_at: '2026-09-23T00:00:00Z',
		scope: 'settings' as const,
		directives: [
			{ topic: 'domains', statement: 'No defence work.', stated_at: '2026-09-22T10:00:00Z' },
			{ topic: 'moods', statement: 'Be cheerful.', stated_at: '2026-09-22T10:00:00Z' },
			{ topic: 'writing_style', statement: '   ', stated_at: '2026-09-22T10:00:00Z' },
			{ topic: 'positioning', statement: 'x'.repeat(900), stated_at: 'not a date' }
		]
	};

	it('supersedes each topic inside the import transaction, keeping the date', async () => {
		const summary = await importSettings(3, 'user-1', file, {
			...APPLY_NOTHING_ELSE,
			applyDirectives: true
		});

		expect(writes[0]).toEqual({
			profileId: 3,
			patch: { domains: 'No defence work.' },
			source: 'import',
			opts: { statedAt: new Date('2026-09-22T10:00:00Z'), tx: TX }
		});
		expect(summary.directivesImported).toBe(2);
	});

	it('skips a topic this app does not have and a blank statement, rather than failing', async () => {
		const summary = await importSettings(3, 'user-1', file, {
			...APPLY_NOTHING_ELSE,
			applyDirectives: true
		});
		expect(summary.directivesSkipped).toEqual(['moods', 'writing_style']);
	});

	it('cuts an over-long statement to the cap, and falls back to now for a bad date', async () => {
		await importSettings(3, 'user-1', file, { ...APPLY_NOTHING_ELSE, applyDirectives: true });
		const positioning = writes.find((w) => 'positioning' in w.patch)!;
		expect((positioning.patch.positioning as string).length).toBe(500);
		expect(positioning.opts).toEqual({ statedAt: undefined, tx: TX });
	});

	it('writes nothing when not asked to', async () => {
		await importSettings(3, 'user-1', file, { ...APPLY_NOTHING_ELSE, applyDirectives: false });
		expect(writes).toEqual([]);
	});
});
