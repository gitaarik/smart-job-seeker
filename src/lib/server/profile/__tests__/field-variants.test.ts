/**
 * Alternative field wordings: the vocabulary, the rule for which wording a
 * version prints, the tree walk, the overlay order, and the tailoring run's
 * choice.
 *
 * Two things here fail silently rather than loudly, which is why they are
 * asserted rather than trusted to the comments that explain them.
 *
 * The overlay order. Two things write to `profile.summary` — a translation and
 * a version's chosen wording — and with variants BEFORE translations the
 * translation of the default overwrites the chosen wording, so a Dutch CV
 * prints a summary the version did not pick while the English one prints the
 * right thing.
 *
 * The pick rule. A version's wording for a field is decided by rows on that
 * version and on the ones it builds on, written by the applicant and by
 * tailoring runs. Read in the wrong order, a regeneration replaces the title
 * the applicant chose, or a job's version stops saying what its library version
 * picked — and either way the document is merely different, with no error.
 */

import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
	PRINTED_VARIANT_FIELDS,
	VARIANT_FIELDS,
	describeWordings,
	groupVariantsByTarget,
	isPrintedVariantField,
	isVariantEntity,
	isVariantField,
	resolveWordings,
	sameWording,
	toFieldVariant,
	variantPreview,
	variantTargetKey,
	variantsForTarget,
	wordingText,
	type FieldVariant,
	type WordingPickRow
} from '$lib/field-variants';

vi.mock('$lib/server/db', () => ({
	db: {},
	dbDirect: {}
}));

// The run's choice is tested with the word-overlap ranker: it is deterministic,
// and what is under test is which wording is compared with which, not how well
// an embedding tells two titles apart.
vi.mock('$lib/server/documents/content-embeddings', () => ({
	semanticScoreUnits: vi.fn(async () => null),
	poolKey: (type: string, id: number) => `${type}:${id}`
}));

const { mockListFieldVariants } = vi.hoisted(() => ({ mockListFieldVariants: vi.fn() }));
vi.mock('../field-variants', async (importOriginal) => ({
	...(await importOriginal<typeof import('../field-variants')>()),
	listFieldVariants: mockListFieldVariants
}));

const { applyFieldVariants, NO_FIELD_VARIANTS } = await import('../field-variants');
const { applyTranslations } = await import('../translations');
const {
	choicesForPrintedRoles,
	chooseFieldVariants,
	defaultUnitType,
	variantDecisions,
	VARIANT_MARGIN
} = await import('../tailor-field-variants');

const PROFILE_ID = 1;

/** A wording of one of the profile's own fields. */
function ofProfile(id: number, field: string, more: Partial<FieldVariant> = {}): FieldVariant {
	return {
		id,
		entity: 'profile',
		entity_id: PROFILE_ID,
		field,
		label: `wording ${id}`,
		value: `value ${id}`,
		note: null,
		sort: 0,
		...more
	};
}

/** A wording of one role's position. */
function ofRole(id: number, roleId: number, more: Partial<FieldVariant> = {}): FieldVariant {
	return {
		id,
		entity: 'work_experience',
		entity_id: roleId,
		field: 'position',
		label: `wording ${id}`,
		value: `value ${id}`,
		note: null,
		sort: 0,
		...more
	};
}

let nextRowId = 100;
/** One override row naming a variant; later calls are newer rows. */
function row(
	versionId: number,
	variantId: number,
	action: 'include' | 'exclude' = 'include',
	source: 'user' | 'ai' = 'user'
): WordingPickRow {
	return { id: nextRowId++, version_id: versionId, entity_id: variantId, action, source };
}

const titleKey = variantTargetKey('profile', PROFILE_ID, 'title');
const roleKey = (roleId: number) => variantTargetKey('work_experience', roleId, 'position');

/** A resolver over a literal map keyed by target, shaped like loadFieldVariants' result. */
function variants(values: Record<string, string>) {
	return {
		versionId: 3,
		isEmpty: false,
		value: (entity: string, entityId: number, field: string, base: string | null) =>
			values[variantTargetKey(entity, entityId, field)] ?? base,
		picked: new Map<string, FieldVariant>()
	};
}

function profile() {
	return {
		id: PROFILE_ID,
		title: 'Senior Software Engineer',
		subtitle: 'Full-Stack Developer',
		headline: 'Builds things that stay built',
		summary: 'Engineer of long standing.',
		work_experiences: [
			{ id: 9, name: 'Chipta', position: 'Lead Engineer' },
			{ id: 10, name: 'TravelBird', position: 'Senior Full-Stack Engineer' }
		]
	};
}

beforeEach(() => {
	mockListFieldVariants.mockReset();
});

describe('the vocabulary', () => {
	it('names the fields that hold one value, on the profile and on a role', () => {
		expect(VARIANT_FIELDS.map((f) => `${f.entity}.${f.field}`)).toEqual([
			'profile.title',
			'profile.subtitle',
			'profile.headline',
			'profile.summary',
			'profile.about_me_text',
			'work_experience.position'
		]);
	});

	it('offers a version only the fields a document prints', () => {
		// The library is wider than the picker. `about_me_text` is prose the
		// applicant keeps alternatives of — a LinkedIn About and a portfolio
		// version of the same bio — but no resume renders it, so a version has
		// nothing to decide and the tailoring run has nothing to score. Both
		// wrong answers here are silent: a picker whose choice never reaches a
		// document, or a printed field the run stops considering.
		expect(PRINTED_VARIANT_FIELDS.map((f) => `${f.entity}.${f.field}`)).toEqual([
			'profile.title',
			'profile.subtitle',
			'profile.headline',
			'profile.summary',
			'work_experience.position'
		]);
		expect(VARIANT_FIELDS.every((f) => typeof f.printed === 'boolean')).toBe(true);
	});

	it('knows a field by the part of the profile it is on', () => {
		expect(isVariantField('profile', 'summary')).toBe(true);
		// Unprinted is still a variant field — the editor stores alternatives for
		// it, so the write API must accept the name that the picker declines.
		expect(isVariantField('profile', 'about_me_text')).toBe(true);
		expect(isVariantField('work_experience', 'position')).toBe(true);
		// The same name on the wrong part is not a field: a wording stored as the
		// profile's "position" would be a row nothing prints.
		expect(isVariantField('profile', 'position')).toBe(false);
		expect(isVariantField('work_experience', 'summary')).toBe(false);
		expect(isVariantField('profile', '')).toBe(false);
		expect(isVariantField(null, 'summary')).toBe(false);
		expect(isVariantEntity('work_experience')).toBe(true);
		expect(isVariantEntity('side_project')).toBe(false);
	});

	it('separates storing a variant from picking one', () => {
		// The two guards the API uses, and the whole reason there are two. Writing
		// an alternative is a library edit; picking one is a document edit, and a
		// pick for a field no document prints writes a row that nothing will ever
		// read back.
		expect(isPrintedVariantField('profile', 'summary')).toBe(true);
		expect(isPrintedVariantField('work_experience', 'position')).toBe(true);
		expect(isPrintedVariantField('profile', 'about_me_text')).toBe(false);
		expect(isPrintedVariantField('profile', 'position')).toBe(false);
		expect(isPrintedVariantField(null, null)).toBe(false);
		// Every pickable field is storable. The reverse does not hold.
		for (const f of PRINTED_VARIANT_FIELDS) expect(isVariantField(f.entity, f.field)).toBe(true);
	});

	it('keeps every default unit type inside content_embeddings.unit_type', () => {
		// varchar(32). A longer name added to VARIANT_FIELDS would otherwise fail
		// at an insert during a tailoring run, on the profiles that have variants
		// — which is nowhere near where the change was made.
		for (const f of VARIANT_FIELDS) {
			expect(defaultUnitType(f.entity, f.field).length).toBeLessThanOrEqual(32);
		}
	});

	it('gives each field its own unit type, so scores cannot collide', () => {
		// semanticScoreUnits keys its results by (type, id) and takes the max over
		// sub-units, so four defaults sharing the profile id under one type would
		// come back as a single number and every field would be compared to the
		// best-scoring one. A role's default is keyed by the role's id, which can
		// equal the profile's, so its type must differ from every profile field's.
		const types = VARIANT_FIELDS.map((f) => defaultUnitType(f.entity, f.field));
		expect(new Set(types).size).toBe(types.length);
	});

	it('leaves the profile fields the unit types they were cached under', () => {
		// Embeddings are cached by unit type. Renaming these would re-embed every
		// profile's defaults on its next run for nothing.
		expect(defaultUnitType('profile', 'summary')).toBe('field_default_summary');
	});

	it('gives every field an editor spec, printed or not', () => {
		// FieldVariants reads multiline/rows off the spec to render the control,
		// and falls back to a single-line input when it finds none. A multi-
		// paragraph bio in a one-line box is usable enough that nobody would file
		// it, and unpleasant enough that nobody would use the field.
		const about = VARIANT_FIELDS.find((f) => f.field === 'about_me_text');
		expect(about?.multiline).toBe(true);
		expect(about?.rows).toBeGreaterThan(4);
	});
});

describe('rows, grouping and preview', () => {
	it('reads whose field a stored row is from the column that says so', () => {
		const stored = { id: 1, profile_id: PROFILE_ID, field: 'title', label: 'a', value: 'b' };
		expect(toFieldVariant({ ...stored, work_experience_id: null })).toMatchObject({
			entity: 'profile',
			entity_id: PROFILE_ID
		});
		expect(toFieldVariant({ ...stored, field: 'position', work_experience_id: 9 })).toMatchObject({
			entity: 'work_experience',
			entity_id: 9
		});
	});

	it('groups by target, each in sort order', () => {
		const grouped = groupVariantsByTarget([
			ofProfile(2, 'summary', { sort: 1 }),
			ofProfile(1, 'summary', { sort: 0 }),
			ofProfile(3, 'title'),
			ofRole(4, 9),
			ofRole(5, 10)
		]);
		expect(
			grouped.get(variantTargetKey('profile', PROFILE_ID, 'summary'))?.map((v) => v.id)
		).toEqual([1, 2]);
		expect(grouped.get(titleKey)?.map((v) => v.id)).toEqual([3]);
		// Two roles' titles are two targets, not one list of "positions".
		expect(grouped.get(roleKey(9))?.map((v) => v.id)).toEqual([4]);
		expect(grouped.get(roleKey(10))?.map((v) => v.id)).toEqual([5]);
		expect(grouped.has(variantTargetKey('profile', PROFILE_ID, 'headline'))).toBe(false);
	});

	it('keeps a role and the profile apart when their ids coincide', () => {
		// The profile's id and a role's id come from two sequences and can be the
		// same number. Keyed on the number alone, the profile's title wordings
		// would be offered for role 1's position.
		const list = [ofProfile(1, 'title'), ofRole(2, PROFILE_ID)];
		expect(variantsForTarget(list, 'profile', PROFILE_ID, 'title').map((v) => v.id)).toEqual([1]);
		expect(
			variantsForTarget(list, 'work_experience', PROFILE_ID, 'position').map((v) => v.id)
		).toEqual([2]);
	});

	it('flattens whitespace and truncates for the picker', () => {
		expect(variantPreview('a\n\n  b')).toBe('a b');
		expect(variantPreview('x'.repeat(200), 10)).toBe(`${'x'.repeat(10)}…`);
		expect(variantPreview('short', 10)).toBe('short');
	});

	it('treats a retyped title as the same wording', () => {
		expect(sameWording('Senior Python Engineer', '  senior  python engineer ')).toBe(true);
		expect(sameWording('Senior Python Engineer', 'Senior Python Developer')).toBe(false);
	});
});

describe('which wording a version prints', () => {
	const JOB = 30;
	const LIBRARY = 20;
	const python = ofProfile(1, 'title', { label: 'Python-focused' });
	const lead = ofProfile(2, 'title', { label: 'Lead' });
	const all = [python, lead, ofRole(3, 9), ofRole(4, 10)];

	it('prints nothing but the profile when nothing is picked', () => {
		expect(resolveWordings([JOB, LIBRARY], [], all).size).toBe(0);
	});

	it('inherits the pick of the version it builds on', () => {
		const picked = resolveWordings([JOB, LIBRARY], [row(LIBRARY, python.id)], all);
		expect(picked.get(titleKey)?.variant.id).toBe(python.id);
		// And says whose decision it is, so a picker can show where it comes from.
		expect(picked.get(titleKey)?.versionId).toBe(LIBRARY);
	});

	it('lets a version of its own outrank the one it builds on', () => {
		const picked = resolveWordings(
			[JOB, LIBRARY],
			[row(LIBRARY, python.id), row(JOB, lead.id)],
			all
		);
		expect(picked.get(titleKey)?.variant.id).toBe(lead.id);
		expect(picked.get(titleKey)?.versionId).toBe(JOB);
	});

	it('takes an inherited pick back off with an exclude, leaving the profile value', () => {
		// How "use my own title for this job" is written when the library version
		// picks one: there is no row that means "the default".
		const picked = resolveWordings(
			[JOB, LIBRARY],
			[row(LIBRARY, python.id), row(JOB, python.id, 'exclude')],
			all
		);
		expect(picked.has(titleKey)).toBe(false);
	});

	it('does not let an exclude of one wording block another the base picks', () => {
		// "Not this one here" is about the wording it names. Taking back a run's
		// pick returns the field to what the base says, as it does for an item.
		const picked = resolveWordings(
			[JOB, LIBRARY],
			[row(LIBRARY, lead.id), row(JOB, python.id, 'exclude')],
			all
		);
		expect(picked.get(titleKey)?.variant.id).toBe(lead.id);
	});

	it('reads the applicant’s pick before a newer generated one', () => {
		// The row a regeneration writes is always newer. Newest-first alone would
		// replace the title the applicant chose every time a run picked another.
		const picked = resolveWordings(
			[JOB],
			[row(JOB, lead.id, 'include', 'user'), row(JOB, python.id, 'include', 'ai')],
			all
		);
		expect(picked.get(titleKey)?.variant.id).toBe(lead.id);
	});

	it('takes the newest when two rows of one source pick for a field', () => {
		const picked = resolveWordings([JOB], [row(JOB, python.id), row(JOB, lead.id)], all);
		expect(picked.get(titleKey)?.variant.id).toBe(lead.id);
	});

	it('decides each role’s title on its own', () => {
		const picked = resolveWordings([JOB], [row(JOB, 3)], all);
		expect(picked.get(roleKey(9))?.variant.id).toBe(3);
		expect(picked.has(roleKey(10))).toBe(false);
		expect(picked.has(titleKey)).toBe(false);
	});

	it('ignores rows about wordings it was not given and versions outside the chain', () => {
		// A pick for a deleted wording, or for another profile's, and a row on a
		// version this one does not build on.
		const picked = resolveWordings([JOB], [row(JOB, 999), row(LIBRARY, python.id)], all);
		expect(picked.size).toBe(0);
	});
});

describe('describing a version’s wordings for a picker', () => {
	const JOB = 30;
	const LIBRARY = 20;
	const python = ofProfile(1, 'title', {
		label: 'Python-focused',
		value: 'Senior Python Engineer'
	});
	const agency = ofRole(3, 9, { label: 'Politie', value: 'Senior Python Engineer' });
	const describe_ = (versionId: number | null, chain: number[], rows: WordingPickRow[]) =>
		describeWordings({
			profile: profile(),
			roles: profile().work_experiences,
			variants: [python, agency],
			versionId,
			chain,
			rows,
			versionNames: new Map([[LIBRARY, 'Fullstack Python']])
		});
	const find = (states: ReturnType<typeof describe_>, key: string) => {
		const state = states.find((s) => s.key === key);
		if (!state) throw new Error(`no state for ${key}`);
		return state;
	};

	it('lists every printed field, with or without alternatives', () => {
		// The job's panel offers "something else for this job" on a field that
		// has no alternatives yet, so those have to be in the list too.
		const states = describe_(null, [], []);
		expect(states.map((s) => s.key)).toEqual([
			variantTargetKey('profile', PROFILE_ID, 'title'),
			variantTargetKey('profile', PROFILE_ID, 'subtitle'),
			variantTargetKey('profile', PROFILE_ID, 'headline'),
			variantTargetKey('profile', PROFILE_ID, 'summary'),
			roleKey(9),
			roleKey(10)
		]);
		expect(find(states, roleKey(10)).options).toEqual([]);
		// A role is told apart by its employer; the profile's fields need nothing.
		expect(find(states, roleKey(9)).context).toBe('Chipta');
		expect(find(states, titleKey).context).toBeNull();
	});

	it('says the profile’s own value when nothing is picked', () => {
		const title = find(describe_(JOB, [JOB], []), titleKey);
		expect(title.pickedId).toBeNull();
		expect(title.from).toBe('own');
		expect(wordingText(title)).toBe('Senior Software Engineer');
	});

	it('shows a pick made on the version itself, and whose it was', () => {
		const rows = [{ ...row(JOB, agency.id, 'include', 'ai'), reason: 'fits this job better' }];
		const role = find(describe_(JOB, [JOB], rows), roleKey(9));
		expect(role.pickedId).toBe(agency.id);
		expect(role.from).toBe('this');
		expect(role.source).toBe('tailoring');
		expect(role.reason).toBe('fits this job better');
		expect(wordingText(role)).toBe('Senior Python Engineer');
	});

	it('shows an inherited pick as the other version’s, by name', () => {
		const title = find(describe_(JOB, [JOB, LIBRARY], [row(LIBRARY, python.id)]), titleKey);
		expect(title.pickedId).toBe(python.id);
		expect(title.from).toBe('inherited');
		expect(title.inheritedFrom).toBe('Fullstack Python');
		// Nobody decided anything on this version.
		expect(title.source).toBe('base');
	});

	it('shows the applicant’s own value chosen over an inherited pick as their decision', () => {
		const rows = [
			row(LIBRARY, python.id),
			{ ...row(JOB, python.id, 'exclude', 'user'), reason: 'you chose your own title' }
		];
		const title = find(describe_(JOB, [JOB, LIBRARY], rows), titleKey);
		expect(title.pickedId).toBeNull();
		expect(title.from).toBe('own');
		expect(title.source).toBe('user');
		expect(title.reason).toBe('you chose your own title');
	});
});

describe('applying to a tree', () => {
	it('replaces only the picked fields', () => {
		const p = applyFieldVariants(
			profile(),
			variants({ [variantTargetKey('profile', PROFILE_ID, 'summary')]: 'Backend specialist.' })
		);
		expect(p.summary).toBe('Backend specialist.');
		expect(p.title).toBe('Senior Software Engineer');
		expect(p.headline).toBe('Builds things that stay built');
		expect(p.work_experiences.map((w) => w.position)).toEqual([
			'Lead Engineer',
			'Senior Full-Stack Engineer'
		]);
	});

	it('replaces the position of the role that was picked for, and no other', () => {
		const p = applyFieldVariants(profile(), variants({ [roleKey(9)]: 'Senior Python Engineer' }));
		expect(p.work_experiences.map((w) => w.position)).toEqual([
			'Senior Python Engineer',
			'Senior Full-Stack Engineer'
		]);
		expect(p.title).toBe('Senior Software Engineer');
	});

	it('is a no-op when nothing is picked', () => {
		const p = applyFieldVariants(profile(), NO_FIELD_VARIANTS);
		expect(p.summary).toBe('Engineer of long standing.');
		expect(p.work_experiences[0].position).toBe('Lead Engineer');
	});

	it('survives a profile with the field unset and no roles', () => {
		const p = applyFieldVariants(
			{ id: PROFILE_ID, title: null, subtitle: null, headline: null, summary: null },
			variants({ [variantTargetKey('profile', PROFILE_ID, 'summary')]: 'Backend specialist.' })
		);
		expect(p.summary).toBe('Backend specialist.');
		expect(p.title).toBeNull();
	});
});

describe('overlay order', () => {
	const translator = {
		locale: 'nl',
		isBase: false,
		t: (entity: string, id: number | string, field: string, base: string | null) =>
			entity === 'profile' && field === 'summary'
				? 'De Nederlandse vertaling van de standaardsamenvatting.'
				: entity === 'work_experience' && field === 'position'
					? 'Hoofdontwikkelaar'
					: entity === 'profile_field_variant' && field === 'value'
						? `NL wording ${id}`
						: base
	};

	it('lets a picked wording win over the translation of the default', () => {
		const p = profile();
		applyTranslations(p, translator);
		expect(p.summary).toBe('De Nederlandse vertaling van de standaardsamenvatting.');

		applyFieldVariants(
			p,
			variants({ [variantTargetKey('profile', PROFILE_ID, 'summary')]: 'NL wording 5' })
		);
		expect(p.summary).toBe('NL wording 5');
	});

	it('does the same for a role’s title', () => {
		// The case the per-template value used to cover by running last: a forced
		// title must not be put back to the translation of the one it replaces.
		const p = profile();
		applyTranslations(p, translator);
		expect(p.work_experiences[0].position).toBe('Hoofdontwikkelaar');

		applyFieldVariants(p, variants({ [roleKey(9)]: 'Senior Python Engineer' }));
		expect(p.work_experiences[0].position).toBe('Senior Python Engineer');
		// A role nothing was picked for keeps its translated title.
		expect(p.work_experiences[1].position).toBe('Hoofdontwikkelaar');
	});

	it('translates the VARIANT row, not the field it stands in for', () => {
		// The tree carries the variants, so applyTranslations overlays their own
		// `value` — which is what makes a picked wording available in-language at
		// all. Keying it on `profile.summary` instead would translate the default
		// and leave the variant English.
		const p = { ...profile(), field_variants: [{ id: 5, field: 'summary', value: 'Backend.' }] };
		applyTranslations(p, translator);
		expect(p.field_variants[0].value).toBe('NL wording 5');
	});
});

describe('the tailoring run’s choice', () => {
	const query = { text: 'Senior Python Developer for a data platform', skills: ['Python'] };
	const choose = (
		list: FieldVariant[],
		more: { standing?: Map<string, FieldVariant>; locked?: Set<string> } = {}
	) => {
		mockListFieldVariants.mockResolvedValue(list);
		return chooseFieldVariants({ profileId: PROFILE_ID, profile: profile(), query, ...more });
	};
	const python = (roleId: number, id: number) =>
		ofRole(id, roleId, { label: 'Python', value: 'Senior Python Engineer' });

	it('asks for nothing more when the profile has no wordings', async () => {
		expect(await choose([])).toEqual([]);
	});

	it('picks a role’s title that fits the job better than the profile’s own', async () => {
		const choices = await choose([python(9, 1)]);
		expect(choices).toHaveLength(1);
		expect(choices[0]).toMatchObject({
			entity: 'work_experience',
			entityId: 9,
			field: 'position',
			replaces: null
		});
		expect(choices[0].variant.id).toBe(1);
		expect(choices[0].score).toBeGreaterThan(choices[0].defaultScore);
	});

	it('scores each role against its own title', async () => {
		// "Senior Python Engineer" names two of the job's words; role 10's own
		// "Senior Full-Stack Engineer" already names one, so it is beaten there
		// too, but by a smaller distance. What matters is that each role is
		// compared with its own title and decided separately.
		const choices = await choose([python(9, 1), python(10, 2)]);
		expect(choices.map((c) => c.entityId).sort((a, b) => a - b)).toEqual([9, 10]);
		const scoreFor = (roleId: number) => choices.find((c) => c.entityId === roleId)?.defaultScore;
		expect(scoreFor(9)).toBeLessThan(scoreFor(10) ?? 0);
	});

	it('keeps the profile’s own value on a tie', async () => {
		// A wording that says nothing the job asks for scores the same nothing as
		// the title it would replace, and a tie is not evidence.
		const choices = await choose([ofRole(1, 9, { value: 'Technical Lead' })]);
		expect(choices).toEqual([]);
	});

	it('leaves a target the applicant decided alone', async () => {
		const choices = await choose([python(9, 1), python(10, 2)], { locked: new Set([roleKey(9)]) });
		expect(choices.map((c) => c.entityId)).toEqual([10]);
	});

	it('compares against the wording the base version picked, not the profile’s', async () => {
		// The base already says "Senior Python Engineer" for role 9. Another
		// wording has to beat THAT, and one that merely beats "Lead Engineer"
		// does not get to replace it.
		const standing = python(9, 1);
		const other = ofRole(2, 9, { label: 'Dev', value: 'Python Developer' });
		const choices = await choose([standing, other], {
			standing: new Map([[roleKey(9), standing]])
		});
		expect(choices).toEqual([]);
	});

	it('names what it replaces when it does beat the base’s wording', async () => {
		const standing = ofRole(1, 9, { label: 'Lead', value: 'Technical Lead' });
		const choices = await choose([standing, python(9, 2)], {
			standing: new Map([[roleKey(9), standing]])
		});
		expect(choices).toHaveLength(1);
		expect(choices[0].replaces?.id).toBe(1);
	});

	it('never scores a wording whose role is not on the profile', async () => {
		expect(await choose([python(404, 1)])).toEqual([]);
	});

	it('still chooses for the profile’s own fields', async () => {
		const choices = await choose([
			ofProfile(1, 'title', { label: 'Python-focused', value: 'Senior Python Engineer' })
		]);
		expect(choices).toHaveLength(1);
		expect(choices[0]).toMatchObject({ entity: 'profile', entityId: PROFILE_ID, field: 'title' });
	});

	it('drops a title chosen for a role the document leaves off', () => {
		const choice = (entity: 'profile' | 'work_experience', entityId: number) => ({
			entity,
			entityId,
			field: entity === 'profile' ? 'title' : 'position',
			variant: entity === 'profile' ? ofProfile(entityId, 'title') : ofRole(entityId, entityId),
			score: 1,
			defaultScore: 0,
			replaces: null
		});
		const kept = choicesForPrintedRoles(
			[choice('profile', PROFILE_ID), choice('work_experience', 9), choice('work_experience', 10)],
			new Set([10])
		);
		// The profile's own fields always print; a role's title only with the role.
		expect(kept.map((c) => `${c.entity}:${c.entityId}`)).toEqual([
			`profile:${PROFILE_ID}`,
			'work_experience:10'
		]);
	});
});

describe('decisions', () => {
	const summaryChoice = (note: string | null) => ({
		entity: 'profile' as const,
		entityId: PROFILE_ID,
		field: 'summary',
		variant: ofProfile(5, 'summary', { label: 'Backend-leaning', value: 'x', note }),
		score: 0.8,
		defaultScore: 0.5,
		replaces: null
	});

	it('names the field and the wording, so the diff can be read', () => {
		const [d] = variantDecisions([summaryChoice('API work')]);
		expect(d.entityType).toBe('profile_field_variant');
		expect(d.entityId).toBe(5);
		expect(d.action).toBe('include');
		// Ordering is meaningless for a field that holds one value.
		expect(d.sort).toBeNull();
		expect(d.reason).toContain('Backend-leaning');
		expect(d.reason).toContain('API work');
	});

	it('still explains itself when the applicant wrote no note', () => {
		const [d] = variantDecisions([summaryChoice(null)]);
		expect(d.reason).toContain('Backend-leaning');
		expect(d.reason).toContain('professional summary');
		expect(d.reason).toContain('your default');
	});

	it('calls a role’s title a position, and names the wording it replaced', () => {
		const [d] = variantDecisions([
			{
				entity: 'work_experience',
				entityId: 9,
				field: 'position',
				variant: ofRole(6, 9, { label: 'Python' }),
				score: 0.8,
				defaultScore: 0.5,
				replaces: ofRole(7, 9, { label: 'Agency' })
			}
		]);
		expect(d.reason).toContain('“Python” position');
		expect(d.reason).toContain('“Agency”');
	});

	it('keeps the margin a fraction, so it survives both rankers', () => {
		// Cosine sits in 0..1 and lexical overlap counts whole tokens; an absolute
		// margin would be nearly everything on one scale and nothing on the other.
		expect(VARIANT_MARGIN).toBeGreaterThan(0);
		expect(VARIANT_MARGIN).toBeLessThan(1);
	});
});
