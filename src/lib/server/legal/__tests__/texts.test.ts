/**
 * The legal directory reader. The case worth pinning is the asymmetry: no
 * directory means no terms (a self-hosted instance), but a meta.json that is
 * there and broken must throw, or the instance that meant to ask for consent
 * would open signup without the box.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const env: Record<string, string> = {};
vi.mock('$lib/tools/get-env', () => ({
	getEnv: (name: string, fallback = '') => env[name] ?? fallback
}));

const { loadLegalPage, readLegalMeta, readLegalPage, termsVersion } = await import('../texts');

let dir: string;
beforeEach(() => {
	dir = mkdtempSync(join(tmpdir(), 'legal-'));
	env.SJS_LEGAL_DIR = dir;
});
afterEach(() => rmSync(dir, { recursive: true, force: true }));

const meta = (value: unknown) => writeFileSync(join(dir, 'meta.json'), JSON.stringify(value));

describe('readLegalMeta', () => {
	it('is null when the instance publishes nothing', () => {
		expect(readLegalMeta()).toBeNull();
		expect(termsVersion()).toBeNull();
		expect(readLegalPage('terms')).toBeNull();
	});

	it('reads the versions, draft unless it says otherwise', () => {
		meta({ terms: '2026-11-13', withdrawalWaiver: { version: '2026-11-14', text: 'Start now.' } });
		expect(readLegalMeta()).toEqual({
			draft: true,
			terms: '2026-11-13',
			withdrawalWaiver: { version: '2026-11-14', text: 'Start now.' }
		});
		meta({ terms: '2026-11-13', draft: false });
		expect(readLegalMeta()).toMatchObject({ draft: false, withdrawalWaiver: null });
	});

	it('throws on a meta.json without a terms version rather than asking for nothing', () => {
		meta({ draft: false });
		expect(() => readLegalMeta()).toThrow('no "terms" version');
	});

	it('throws on a malformed waiver', () => {
		meta({ terms: '2026-11-13', withdrawalWaiver: { version: '2026-11-13' } });
		expect(() => readLegalMeta()).toThrow('withdrawalWaiver');
	});
});

describe('loadLegalPage', () => {
	it('renders the markdown with the draft flag', async () => {
		meta({ terms: '2026-11-13' });
		writeFileSync(join(dir, 'privacy.md'), '# Privacy\n\nHello.');
		const page = await loadLegalPage('privacy');
		expect(page?.draft).toBe(true);
		expect(page?.html).toContain('<h1>Privacy</h1>');
		expect(await loadLegalPage('terms')).toBeNull();
	});
});
