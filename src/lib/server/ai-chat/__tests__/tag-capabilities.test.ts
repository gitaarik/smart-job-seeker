/**
 * Tests for `tag_<section>`, the verb that changes where an entry prints.
 *
 * What is worth pinning is the reason tags were kept from agents in the first
 * place: a tag that names nothing is silent. So the tests are mostly about
 * refusals — an unknown version, a tag contradicting itself, a version renamed
 * while a request waited — and about the card reading as a sentence rather
 * than as the tag strings that do it.
 */

import { beforeEach, describe, expect, it, vi } from 'vitest';

const state = {
	tags: null as string[] | null,
	versions: [] as string[],
	written: [] as { resource: string; id: number; tags: string[] | null }[]
};

vi.mock('$lib/server/db', () => ({
	dbDirect: {
		query: {
			profile_versions: {
				findMany: () => Promise.resolve(state.versions.map((slug) => ({ slug })))
			}
		}
	}
}));

vi.mock('$lib/server/profile/write', async (importOriginal) => ({
	...(await importOriginal<typeof import('$lib/server/profile/write')>()),
	readOwnedRow: (_resource: string, _actor: unknown, id: number) =>
		Promise.resolve({ id, sort: 0, status: null, tags: state.tags }),
	setRowTags: (resource: string, _actor: unknown, id: number, tags: string[] | null) => {
		state.written.push({ resource, id, tags });
		return Promise.resolve({ ok: true });
	}
}));

const { TAG_CAPABILITIES, TAG_CAPABILITY_NAMES, checkTags, isTagCapability, whereItPrints } =
	await import('../tag-capabilities');
const { HIDEABLE_RESOURCES } = await import('$lib/server/profile/resources');
const { verbsFor } = await import('../profile-capabilities');

const ACTOR = { profileId: 12, isStaff: false };
const ENTRY = { id: 7, label: 'Shipped a desktop app' };
const achievement = TAG_CAPABILITIES.tag_work_experience_achievement;
const FIELD = 'work_experience_achievement.tags';

beforeEach(() => {
	state.tags = null;
	state.versions = ['citrus', 'Fullstack-Django'];
	state.written = [];
});

async function validate(tags: unknown) {
	const current = await achievement.current(ENTRY, ACTOR);
	return achievement.validate({ [FIELD]: tags }, current);
}

describe('where it is offered', () => {
	it('exists for every section an entry can be hidden in, and no other', () => {
		expect(TAG_CAPABILITY_NAMES).toEqual(HIDEABLE_RESOURCES.map((name) => `tag_${name}`));
		expect(isTagCapability('tag_language')).toBe(false);
	});

	it('is never offered in the chat', () => {
		// Like a reorder: in the app a tag is a click on the entry's page.
		for (const name of HIDEABLE_RESOURCES) {
			expect(verbsFor(name)).not.toContain(`tag_${name}`);
		}
	});
});

describe('checkTags', () => {
	const versions = ['citrus', 'Fullstack-Django'];

	it('takes the page’s tags, with or without a "!", and writes them as the page does', () => {
		expect(checkTags(['!Resume', 'cv', 'fullstack-django', '!CITRUS'], versions)).toEqual({
			ok: true,
			tags: ['!resume', 'cv', 'Fullstack-Django', '!citrus']
		});
	});

	it('refuses a tag that names nothing, and lists what does', () => {
		// The failure this verb exists for: on a page it cannot be typed, and
		// written anyway it would drop the entry from every document in silence.
		const result = checkTags(['!resume', 'fullstack-djnago'], versions);
		expect(result.ok).toBe(false);
		if (result.ok) return;
		expect(result.error).toContain('"fullstack-djnago"');
		expect(result.error).toContain('"citrus"');
		expect(result.error).toContain('"resume"');
	});

	it('refuses a tag beside its own negation', () => {
		// The "!" wins on every document, so the other half would be a promise the
		// page does not keep.
		const result = checkTags(['cv', '!cv'], versions);
		expect(result.ok).toBe(false);
	});

	it('drops repeats and blanks rather than refusing them', () => {
		expect(checkTags(['!resume', ' !RESUME ', ''], versions)).toEqual({
			ok: true,
			tags: ['!resume']
		});
	});

	it('takes an empty list, which prints it everywhere', () => {
		expect(checkTags([], versions)).toEqual({ ok: true, tags: [] });
	});

	it('refuses anything but a list of strings', () => {
		expect(checkTags('!resume', versions).ok).toBe(false);
		expect(checkTags([1], versions).ok).toBe(false);
	});
});

describe('whereItPrints', () => {
	it.each([
		[[], 'Everywhere'],
		[['!resume'], 'Not on the resume'],
		[['!resume', '!cv'], 'Not on the resume or CV'],
		[['cv'], 'Only on the CV'],
		[['!resume', '!cv', 'citrus'], 'Not on the resume or CV, except in the citrus version'],
		[['citrus'], 'Only in the citrus version'],
		[['!citrus'], 'Never in the citrus version'],
		[['!portfolio'], 'Not on the site']
	])('%j reads "%s"', (tags, sentence) => {
		expect(whereItPrints(tags)).toBe(sentence);
	});
});

describe('validate', () => {
	it('checks against the versions this profile has, read with the row', async () => {
		expect(await validate(['!resume', 'citrus'])).toEqual({ ok: true });
		expect((await validate(['senior'])).ok).toBe(false);
	});

	it('refuses the list the entry already has, in any order or case', async () => {
		state.tags = ['!resume', 'citrus'];
		const result = await validate(['CITRUS', '!resume']);
		expect(result.ok).toBe(false);
	});
});

describe('the card', () => {
	it('says where it prints before and after, from what the request stored', async () => {
		state.tags = null;
		const previous = await achievement.beforeImage!(ENTRY, {}, ACTOR, {});
		expect(achievement.describeChanges!({ [FIELD]: ['!resume'] }, previous)).toEqual([
			{ field: FIELD, label: 'Where it prints', from: 'Everywhere', to: 'Not on the resume' }
		]);
	});
});

describe('writing', () => {
	it('writes the checked list, in the page’s spelling', async () => {
		await achievement.apply(ENTRY, { [FIELD]: ['!RESUME'] }, {}, ACTOR);
		expect(state.written).toEqual([
			{ resource: 'work_experience_achievement', id: 7, tags: ['!resume'] }
		]);
	});

	it('refuses at write time a version that went away while the request waited', async () => {
		state.versions = ['Fullstack-Django'];
		await expect(achievement.apply(ENTRY, { [FIELD]: ['citrus'] }, {}, ACTOR)).rejects.toThrow(
			/citrus/
		);
		expect(state.written).toEqual([]);
	});

	it('puts the recorded tags back exactly on undo, and none when there were none', async () => {
		await achievement.revert!(ENTRY, { tags: ['!cv', 'citrus'] }, ACTOR);
		await achievement.revert!(ENTRY, { tags: null }, ACTOR);
		expect(state.written.map((w) => w.tags)).toEqual([['!cv', 'citrus'], null]);
	});
});
