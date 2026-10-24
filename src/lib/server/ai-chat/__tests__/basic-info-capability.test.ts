/**
 * Tests for `edit_profile` — the texts on the profile row itself.
 *
 * The behaviours worth pinning are the ones that are silent when wrong:
 *
 *  - the write lands on the actor's profile, whatever the target says;
 *  - only the five texts are reachable, so a name or an email address an agent
 *    sends is not a field at all rather than a write nobody asked for;
 *  - a translation rides beside its English, and an undo puts one that was not
 *    there back as not there, so the Dutch CV prints the English again.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';

type Row = Record<'title' | 'subtitle' | 'headline' | 'summary' | 'about_me_text', string | null>;

const ROW: Row = {
	title: 'Senior Engineer',
	subtitle: null,
	headline: 'Builds web platforms.',
	summary: 'The summary they wrote.',
	about_me_text: 'The bio they wrote.'
};

let stored: Row | null = ROW;
let languages: string[] = [];
let held: Record<string, string> = {};
const columnWrites: { profileId: number; values: Record<string, unknown> }[] = [];
const translationWrites: { profileId: number; name: string; id: number; values: unknown }[] = [];

vi.mock('$lib/server/db', () => ({ db: {}, dbDirect: {} }));

vi.mock('$lib/server/profile/basic-info', async (importOriginal) => ({
	...(await importOriginal<typeof import('$lib/server/profile/basic-info')>()),
	readBasicInfo: async () => stored,
	writeBasicInfo: async (profileId: number, values: Record<string, unknown>) => {
		if (Object.keys(values).length > 0) columnWrites.push({ profileId, values });
	}
}));

// Partial: the field names and the refusals are the real ones; only the reads
// and the write of the overlay are stubbed.
vi.mock('$lib/server/profile/section-translations', async (importOriginal) => ({
	...(await importOriginal<typeof import('$lib/server/profile/section-translations')>()),
	translatedLocales: async () => languages,
	readTranslations: async (_profileId: number, _name: string, ids: number[]) =>
		new Map(ids.map((id) => [id, held])),
	writeTranslations: async (
		profileId: number,
		name: string,
		id: number,
		values: Record<string, unknown>
	) => {
		if (Object.keys(values).length > 0) translationWrites.push({ profileId, name, id, values });
	}
}));

const { BASIC_INFO_CAPABILITIES } = await import('../basic-info-capability');
const def = BASIC_INFO_CAPABILITIES.edit_profile;

const ACTOR = { profileId: 3, isStaff: false };
const TARGET = { id: 3, label: 'your Basic Info' };

beforeEach(() => {
	stored = ROW;
	languages = [];
	held = {};
	columnWrites.length = 0;
	translationWrites.length = 0;
});

describe('targeting', () => {
	it('is a singleton, so nothing names its row', () => {
		expect(def.singleton).toBe(true);
	});

	it('resolves to the actor’s own profile from any page', async () => {
		const fromJobPage = await def.resolve({ type: 'job', id: 42 }, ACTOR);
		expect(fromJobPage).toEqual(await def.resolve(null, ACTOR));
		expect(fromJobPage?.id).toBe(3);
	});

	it('refuses a proposal made for another profile', async () => {
		// Applied after switching profiles, a card still names the one it was
		// proposed on.
		expect(await def.authorize({ id: 4, label: 'x' }, ACTOR)).toBe(false);
	});

	it('refuses once the profile is gone', async () => {
		stored = null;
		expect(await def.authorize(TARGET, ACTOR)).toBe(false);
	});
});

describe('fields', () => {
	const english = () => Object.keys(def.fields).filter((field) => field.split('.').length === 2);

	it('reaches the five texts and nothing else on the row', () => {
		expect(english()).toEqual([
			'profile.title',
			'profile.subtitle',
			'profile.headline',
			'profile.summary',
			'profile.about_me_text'
		]);
		for (const column of ['name', 'slug', 'email_address', 'phone_number', 'location']) {
			expect(def.fields).not.toHaveProperty(`profile.${column}`);
		}
	});

	it('puts each translation right after the text it translates', () => {
		const names = Object.keys(def.fields);
		const summary = names.indexOf('profile.summary');
		expect(names[summary + 1]).toBe('profile.summary.nl');
		expect(names.indexOf('profile.headline')).toBeLessThan(summary);
	});
});

describe('current', () => {
	it('is the five texts alone on a profile that has never translated anything', async () => {
		const current = await def.current(TARGET, ACTOR);
		expect(current).toEqual({
			'profile.title': 'Senior Engineer',
			'profile.subtitle': null,
			'profile.headline': 'Builds web platforms.',
			'profile.summary': 'The summary they wrote.',
			'profile.about_me_text': 'The bio they wrote.'
		});
	});

	it('adds each text’s translation in the languages started, null where none is written', async () => {
		languages = ['nl'];
		held = { 'profile.summary.nl': 'De samenvatting.' };
		const current = await def.current(TARGET, ACTOR);
		expect(current['profile.summary.nl']).toBe('De samenvatting.');
		// Null rather than absent: absent would read as a language nobody started.
		expect(current).toHaveProperty('profile.title.nl', null);
		expect(current).not.toHaveProperty('profile.title.de');
		expect(current.translationLocales).toEqual(['nl']);
	});
});

describe('validate', () => {
	it('accepts a rewrite', () => {
		expect(def.validate({ 'profile.summary': 'A sharper summary.' }, {})).toEqual({ ok: true });
	});

	it('holds a short text to its column’s length, and names the field', () => {
		const result = def.validate({ 'profile.title': 'x'.repeat(256) }, {});
		expect(result.ok).toBe(false);
		if (!result.ok) expect(result.error).toContain('profile.title');
	});

	it('lets the bio run long, as the page does', () => {
		expect(def.validate({ 'profile.about_me_text': 'x'.repeat(5000) }, {}).ok).toBe(true);
	});

	it('holds a translation to its English column’s rule', () => {
		const current = { 'profile.title': 'Senior Engineer', translationLocales: ['nl'] };
		expect(def.validate({ 'profile.title.nl': 'x'.repeat(256) }, current).ok).toBe(false);
	});

	it('refuses a language the profile has not started', () => {
		const current = { 'profile.summary': 'Summary.', translationLocales: ['nl'] };
		const result = def.validate({ 'profile.summary.de': 'Zusammenfassung.' }, current);
		expect(result.ok).toBe(false);
		if (!result.ok) expect(result.error).toContain('German');
	});

	it('refuses clearing English its Dutch still prints for', () => {
		const current = {
			'profile.summary': 'Summary.',
			'profile.summary.nl': 'Samenvatting.',
			translationLocales: ['nl']
		};
		expect(def.validate({ 'profile.summary': null }, current).ok).toBe(false);
		expect(def.validate({ 'profile.summary': null, 'profile.summary.nl': null }, current).ok).toBe(
			true
		);
	});
});

describe('apply', () => {
	it('writes the English to the actor’s profile, never the target’s id', async () => {
		await def.apply({ id: 99, label: 'x' }, { 'profile.headline': 'New.' }, {}, ACTOR);
		expect(columnWrites).toEqual([{ profileId: 3, values: { headline: 'New.' } }]);
		expect(translationWrites).toEqual([]);
	});

	it('writes a translation under the profile’s own id', async () => {
		await def.apply(
			TARGET,
			{ 'profile.summary': 'New.', 'profile.summary.nl': 'Nieuw.' },
			{},
			ACTOR
		);
		expect(columnWrites).toEqual([{ profileId: 3, values: { summary: 'New.' } }]);
		expect(translationWrites).toEqual([
			{ profileId: 3, name: 'profile', id: 3, values: { 'profile.summary.nl': 'Nieuw.' } }
		]);
	});
});

describe('revert', () => {
	it('puts both halves back, a translation that was not there as not there', async () => {
		await def.revert!(
			TARGET,
			{ 'profile.summary': 'The summary they wrote.', 'profile.summary.nl': null },
			ACTOR
		);
		expect(columnWrites).toEqual([
			{ profileId: 3, values: { summary: 'The summary they wrote.' } }
		]);
		expect(translationWrites).toEqual([
			{ profileId: 3, name: 'profile', id: 3, values: { 'profile.summary.nl': null } }
		]);
	});

	it('refuses a before-image it cannot read rather than reporting an undo', async () => {
		await expect(def.revert!(TARGET, {}, ACTOR)).rejects.toThrow('edit_profile');
	});
});
