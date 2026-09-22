/**
 * Tests for `edit_match_config` — the first capability whose target is the
 * profile's own single row rather than one named by id.
 *
 * The behaviours worth pinning are the ones that are silent when wrong:
 *
 *  - a value outside the form's own option list matches NO job and errors
 *    nowhere downstream, so it has to be refused here;
 *  - the four lists are replaced whole, which is only safe while the contract
 *    says so and `writesOneState` keeps a re-stated list from being narrowed
 *    away as "unchanged";
 *  - the field names are prefixed, because `job_types` and `work_location`
 *    already belong to `edit_job_details` and the wire schema is flat.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';

const written: unknown[] = [];
const stored = {
	id: 7,
	job_types: ['Full-time'],
	experience_levels: ['Senior'],
	work_location: ['Remote', 'Hybrid'],
	locations: [] as string[],
	remote_only: false,
	match_community_jobs: true,
	community_max_age_days: null as number | null
};

vi.mock('$lib/server/job/match-preferences', async (importOriginal) => {
	const actual = await importOriginal<typeof import('$lib/server/job/match-preferences')>();
	return {
		...actual,
		readMatchPreferences: vi.fn(async () => stored),
		writeMatchPreferences: vi.fn(async (profileId: number, values: unknown) => {
			written.push({ profileId, values });
			return stored;
		})
	};
});

let ownedRow: unknown = { id: 7 };
vi.mock('$lib/server/db', () => ({
	db: { query: { match_config: { findFirst: () => Promise.resolve(ownedRow) } } },
	dbDirect: { query: { match_config: { findFirst: () => Promise.resolve(ownedRow) } } }
}));

const { MATCH_CONFIG_CAPABILITIES } = await import('../match-config-capability');
const def = MATCH_CONFIG_CAPABILITIES.edit_match_config;

const ACTOR = { profileId: 3, isStaff: false };
const TARGET = { id: 7, label: 'your Match Config' };

beforeEach(() => {
	written.length = 0;
	ownedRow = { id: 7 };
});

describe('targeting', () => {
	it('is a singleton, so nothing names its row', () => {
		expect(def.singleton).toBe(true);
	});

	it('resolves from the profile and ignores the page entity', async () => {
		const fromJobPage = await def.resolve({ type: 'job', id: 42 }, ACTOR);
		const fromNowhere = await def.resolve(null, ACTOR);
		expect(fromJobPage).toEqual(fromNowhere);
		expect(fromJobPage?.id).toBe(7);
	});

	it('refuses a row belonging to another profile', async () => {
		ownedRow = undefined;
		expect(await def.authorize(TARGET, ACTOR)).toBe(false);
	});
});

describe('field names', () => {
	it('prefixes every field, so none collides with edit_job_details', () => {
		for (const name of Object.keys(def.fields)) expect(name.startsWith('match.')).toBe(true);
		// The two that would collide, named explicitly: the wire schema is one
		// flat object and a job's own type is not a standing preference.
		expect(def.fields).toHaveProperty('match.job_types');
		expect(def.fields).toHaveProperty('match.work_location');
	});
});

describe('validate', () => {
	it('accepts the exact option strings', () => {
		expect(
			def.validate(
				{ 'match.job_types': ['Contract', 'Freelance'], 'match.experience_levels': ['Senior'] },
				{}
			)
		).toEqual({ ok: true });
	});

	it('refuses a value the form does not offer, and names the ones it does', () => {
		const result = def.validate({ 'match.job_types': ['contract'] }, {});
		expect(result.ok).toBe(false);
		if (!result.ok) {
			expect(result.error).toContain('"contract"');
			expect(result.error).toContain('"Contract"');
		}
	});

	it('refuses an out-of-range community age', () => {
		expect(def.validate({ 'match.community_max_age_days': 0 }, {}).ok).toBe(false);
		expect(def.validate({ 'match.community_max_age_days': 400 }, {}).ok).toBe(false);
		expect(def.validate({ 'match.community_max_age_days': 30 }, {}).ok).toBe(true);
	});

	it('says nothing about a field that was not sent', () => {
		expect(def.validate({}, {}).ok).toBe(true);
	});
});

describe('apply', () => {
	it('writes only the fields the proposal carried', async () => {
		await def.apply(TARGET, { 'match.job_types': ['Contract'] }, {}, ACTOR);
		expect(written).toEqual([{ profileId: 3, values: { job_types: ['Contract'] } }]);
	});

	it('writes to the actor profile, never the target id', async () => {
		await def.apply(TARGET, { 'match.remote_only': true }, {}, ACTOR);
		expect((written[0] as { profileId: number }).profileId).toBe(3);
	});

	it('keeps false as a value rather than dropping it as empty', async () => {
		await def.apply(TARGET, { 'match.match_community_jobs': false }, {}, ACTOR);
		expect(written[0]).toEqual({ profileId: 3, values: { match_community_jobs: false } });
	});

	it('ignores a boolean the model sent as something unreadable', async () => {
		// coerceValue turns what it cannot read into null, which for a notNull
		// column means "no opinion" and must not be written as "off".
		await def.apply(TARGET, { 'match.remote_only': null }, {}, ACTOR);
		expect(written[0]).toEqual({ profileId: 3, values: {} });
	});

	it('clears a list sent empty', async () => {
		await def.apply(TARGET, { 'match.locations': [] }, {}, ACTOR);
		expect(written[0]).toEqual({ profileId: 3, values: { locations: [] } });
	});
});

describe('revert', () => {
	it('puts the recorded values back', async () => {
		await def.revert?.(TARGET, { 'match.job_types': ['Full-time'] }, ACTOR);
		expect(written).toEqual([{ profileId: 3, values: { job_types: ['Full-time'] } }]);
	});

	it('refuses when nothing was recorded', async () => {
		await expect(def.revert?.(TARGET, {}, ACTOR)).rejects.toThrow();
	});
});

describe('contract', () => {
	it('lists the exact strings for each closed list', () => {
		for (const option of ['Full-time', 'Internship', 'Entry-level', 'Executive', 'On-site']) {
			expect(def.contract).toContain(`"${option}"`);
		}
	});

	it('says the lists are replaced whole, and marks itself as one state', () => {
		expect(def.contract).toMatch(/REPLACED WHOLE/);
		expect(def.writesOneState).toBe(true);
	});

	it('denies the filters this config does not have', () => {
		// Phase 0 C1: with no capability in reach the assistant invented
		// "excluded keywords or industries" on this very page.
		expect(def.contract).toMatch(/industry/i);
		expect(def.contract).toMatch(/keyword/i);
		expect(def.contract).toMatch(/salary floor/i);
	});
});
