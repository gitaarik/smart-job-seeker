/**
 * Alternative field wordings: the resolver, the tree walk, and the three-way
 * overlay order.
 *
 * The order is the part worth pinning. Three things now write to
 * `profile.summary` — a translation, a version's chosen wording, and a
 * template's override — and each of the two wrong orders fails silently rather
 * than loudly:
 *
 *  - variants BEFORE translations: the translation of the default overwrites
 *    the chosen wording, so a Dutch CV prints a summary the version did not
 *    pick, and the English one prints the right thing.
 *  - variants AFTER template overrides: a template's house style stops being a
 *    force, and whichever version is picked quietly wins over it.
 *
 * Neither errors. Both produce a document that is merely wrong, on one language
 * or one template, which is why they are asserted here rather than trusted to
 * the comments that explain them.
 */

import { describe, expect, it, vi } from 'vitest';
import {
	VARIANT_FIELDS,
	groupVariantsByField,
	isVariantField,
	variantPreview
} from '$lib/field-variants';

vi.mock('$lib/server/db', () => ({
	db: {},
	dbDirect: {}
}));

// OVERRIDABLE_FIELDS reaches one role field today and no profile field, so the
// two vocabularies do not yet contest anything and the real applyTemplateOverrides
// cannot demonstrate the order. Both lists are open and append-only, so the day
// one of them grows a profile field is the day the order decides the document —
// which is exactly when nobody will be looking at it. Extended here to that
// case, and asserted.
vi.mock('$lib/template-overrides', async (importOriginal) => {
	const actual = await importOriginal<typeof import('$lib/template-overrides')>();
	const fields = [
		...actual.OVERRIDABLE_FIELDS,
		{ entity: 'profile', field: 'title', label: 'Title' }
	];
	return {
		...actual,
		OVERRIDABLE_FIELDS: fields,
		overridableFieldsFor: (entity: string) => fields.filter((f) => f.entity === entity)
	};
});

const { applyFieldVariants, NO_FIELD_VARIANTS } = await import('../field-variants');
const { applyTranslations } = await import('../translations');
const { applyTemplateOverrides } = await import('../template-overrides');
const { defaultUnitType, variantDecisions, VARIANT_MARGIN } =
	await import('../tailor-field-variants');

/** A resolver over a literal map, shaped like loadFieldVariants' result. */
function variants(values: Record<string, string>) {
	return {
		versionId: 3,
		isEmpty: false,
		value: (field: string, base: string | null) => values[field] ?? base,
		picked: new Map()
	};
}

function profile() {
	return {
		id: 1,
		title: 'Senior Software Engineer',
		subtitle: 'Full-Stack Developer',
		headline: 'Builds things that stay built',
		summary: 'Engineer of long standing.',
		work_experiences: [{ id: 9, name: 'Citrus', position: 'Lead Engineer' }]
	};
}

describe('the vocabulary', () => {
	it('names the four scalar profile fields and nothing else', () => {
		expect(VARIANT_FIELDS.map((f) => f.field)).toEqual([
			'title',
			'subtitle',
			'headline',
			'summary'
		]);
	});

	it('rejects a field that is not in it', () => {
		expect(isVariantField('summary')).toBe(true);
		expect(isVariantField('position')).toBe(false);
		expect(isVariantField('')).toBe(false);
		expect(isVariantField(null)).toBe(false);
	});

	it('keeps every default unit type inside content_embeddings.unit_type', () => {
		// varchar(32). A longer field name added to VARIANT_FIELDS would otherwise
		// fail at an insert during a tailoring run, on the profiles that have
		// variants — which is nowhere near where the change was made.
		for (const f of VARIANT_FIELDS) {
			expect(defaultUnitType(f.field).length).toBeLessThanOrEqual(32);
		}
	});

	it('gives each field its own unit type, so scores cannot collide', () => {
		// semanticScoreUnits keys its results by (type, id) and takes the max over
		// sub-units, so four defaults sharing the profile id under one type would
		// come back as a single number and every field would be compared to the
		// best-scoring one.
		const types = VARIANT_FIELDS.map((f) => defaultUnitType(f.field));
		expect(new Set(types).size).toBe(types.length);
	});
});

describe('grouping and preview', () => {
	it('buckets by field in vocabulary order, each in sort order', () => {
		const grouped = groupVariantsByField([
			{ id: 2, field: 'summary', sort: 1 },
			{ id: 1, field: 'summary', sort: 0 },
			{ id: 3, field: 'title', sort: 0 },
			{ id: 4, field: 'not_a_field', sort: 0 }
		]);
		expect([...grouped.keys()]).toEqual(['title', 'subtitle', 'headline', 'summary']);
		expect(grouped.get('summary')?.map((v) => v.id)).toEqual([1, 2]);
		expect(grouped.get('title')?.map((v) => v.id)).toEqual([3]);
		// A row naming a field the vocabulary dropped is ignored rather than
		// crashing the editor — the strings are persisted and outlive a rename.
		expect([...grouped.values()].flat().map((v) => v.id)).not.toContain(4);
	});

	it('flattens whitespace and truncates for the picker', () => {
		expect(variantPreview('a\n\n  b')).toBe('a b');
		expect(variantPreview('x'.repeat(200), 10)).toBe(`${'x'.repeat(10)}…`);
		expect(variantPreview('short', 10)).toBe('short');
	});
});

describe('applying to a tree', () => {
	it('replaces only the picked fields', () => {
		const p = applyFieldVariants(profile(), variants({ summary: 'Backend specialist.' }));
		expect(p.summary).toBe('Backend specialist.');
		expect(p.title).toBe('Senior Software Engineer');
		expect(p.headline).toBe('Builds things that stay built');
	});

	it('is a no-op when nothing is picked', () => {
		const p = applyFieldVariants(profile(), NO_FIELD_VARIANTS);
		expect(p.summary).toBe('Engineer of long standing.');
	});

	it('survives a profile with the field unset', () => {
		const p = applyFieldVariants(
			{ id: 1, title: null, subtitle: null, headline: null, summary: null },
			variants({ summary: 'Backend specialist.' })
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
				: entity === 'profile_field_variant' && field === 'value'
					? `NL wording ${id}`
					: base
	};

	it('lets a picked wording win over the translation of the default', () => {
		const p = profile();
		applyTranslations(p, translator);
		expect(p.summary).toBe('De Nederlandse vertaling van de standaardsamenvatting.');

		applyFieldVariants(p, variants({ summary: 'NL wording 5' }));
		expect(p.summary).toBe('NL wording 5');
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

	it('leaves a template override the last word', () => {
		// A template override is a force ("on Citrus this says Senior Engineer");
		// a variant is the applicant's choice. The force outranks the choice, so a
		// branded document says what the brand requires whichever version built it.
		const p = profile();
		applyFieldVariants(p, variants({ title: 'Backend Engineer' }));
		applyTemplateOverrides(p, {
			templateId: 7,
			isEmpty: false,
			value: (entity, _id, field, base) =>
				entity === 'profile' && field === 'title' ? 'Senior Engineer' : base
		});
		expect(p.title).toBe('Senior Engineer');
	});
});

describe('decisions', () => {
	it('names the field and the wording, so the diff can be read', () => {
		const [d] = variantDecisions([
			{
				field: 'summary',
				variant: {
					id: 5,
					field: 'summary',
					label: 'Backend-leaning',
					value: 'x',
					note: 'API work'
				},
				score: 0.8,
				defaultScore: 0.5
			}
		]);
		expect(d.entityType).toBe('profile_field_variant');
		expect(d.entityId).toBe(5);
		expect(d.action).toBe('include');
		// Ordering is meaningless for a field that holds one value.
		expect(d.sort).toBeNull();
		expect(d.reason).toContain('Backend-leaning');
		expect(d.reason).toContain('API work');
	});

	it('still explains itself when the applicant wrote no note', () => {
		const [d] = variantDecisions([
			{
				field: 'summary',
				variant: { id: 5, field: 'summary', label: 'Backend-leaning', value: 'x', note: null },
				score: 0.8,
				defaultScore: 0.5
			}
		]);
		expect(d.reason).toContain('Backend-leaning');
		expect(d.reason).toContain('professional summary');
	});

	it('keeps the margin a fraction, so it survives both rankers', () => {
		// Cosine sits in 0..1 and lexical overlap counts whole tokens; an absolute
		// margin would be nearly everything on one scale and nothing on the other.
		expect(VARIANT_MARGIN).toBeGreaterThan(0);
		expect(VARIANT_MARGIN).toBeLessThan(1);
	});
});
