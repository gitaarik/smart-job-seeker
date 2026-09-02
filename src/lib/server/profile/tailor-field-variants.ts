/**
 * Choosing which wording a tailored version uses for the profile's scalar
 * fields — the title, subtitle, headline and summary.
 *
 * This is the one part of tailoring that CHOOSES rather than filters. Every
 * other layer decides whether an item prints; there is only one summary, so the
 * question here is which of the applicant's own alternatives fits this job (see
 * $lib/field-variants.ts for why those four fields need it at all).
 *
 * ## Why there is no model call here
 *
 * The rest of the run ends at L3, where a model adjusts scores and the
 * deterministic selector still has the last word. This layer stops at L1, and
 * that is deliberate rather than unfinished:
 *
 * - The decision is already safe by construction. Every option is prose the
 *   applicant wrote and can defend; the worst outcome is the wrong one of their
 *   own summaries, which they see in the diff and change with one click. That is
 *   a different class of risk from writing a summary per job, which no layer
 *   here does.
 * - There is nothing for a model to add that the note does not already say.
 *   L3 exists because a similarity score cannot tell whether a bullet is
 *   *worth* keeping; here the applicant has written down when to use each
 *   variant, and matching that sentence to a job description is precisely what
 *   the ranker is good at.
 * - It would cost a second round trip on every regeneration for at most four
 *   decisions, and add a prompt whose failure mode is silent (see the
 *   llm:smoke preflight gap).
 *
 * If it ever earns one, the shape is the same as everywhere else: the model
 * adjusts the scores below and this function still picks the winner.
 *
 * ## Why the default has to be beaten, not merely matched
 *
 * The profile's own value is a candidate like any other, and it starts ahead.
 * A variant replaces what the applicant chose as their standing answer, so a
 * score that ties it is not evidence of anything — and swapping on noise makes
 * every regeneration produce a different document from the same inputs, which
 * is the behaviour that makes a diff unreadable.
 */

import { profile_field_variants } from '$lib/server/db/schema';
import { dbDirect as db } from '$lib/server/db';
import { asc, eq } from 'drizzle-orm';
import { VARIANT_FIELDS, variantFieldLabel, type FieldVariant } from '$lib/field-variants';
import { OVERRIDE_ENTITIES } from '$lib/version-overrides';
import type { Decision } from '$lib/tailoring';
import {
	semanticScoreUnits,
	poolKey,
	type ContentUnit
} from '$lib/server/documents/content-embeddings';
import { scoreUnitAgainstQuery } from '$lib/server/documents/content-retrieval';

/**
 * How much better a variant must score than the profile's own value before it
 * replaces it, as a fraction of the default's score.
 *
 * A fraction rather than an absolute, because the two rankers work on
 * different scales — cosine similarity sits in 0..1 and lexical overlap counts
 * whole tokens — and a margin expressed in points would be nearly everything on
 * one and nearly nothing on the other. This is the same problem PROMOTION_MARGIN
 * solves in $lib/tailoring, and the same answer.
 *
 * 15%: enough that two wordings of the same career do not trade places between
 * runs, small enough that a genuinely better-aimed summary wins.
 */
export const VARIANT_MARGIN = 0.15;

/**
 * A default with no score at all cannot be beaten by a fraction of nothing, so
 * the margin is applied to at least this much. Below it the comparison is
 * between two numbers that both mean "no signal", and the standing answer wins.
 */
const MIN_MEANINGFUL_SCORE = 0.01;

export interface VariantChoice {
	field: string;
	variant: FieldVariant;
	score: number;
	defaultScore: number;
}

/**
 * What a variant is compared as.
 *
 * The note comes FIRST and is repeated into the title slot, because it is the
 * sentence written to answer this exact question — "agency and consultancy
 * roles" is a better match for a job description than the summary's own prose,
 * which describes the applicant rather than the fit. The value is still
 * included: a variant with no note has to be matchable on something, and a
 * summary aimed at backend work says "backend" in it.
 */
function matchTextFor(variant: { value: string; note?: string | null }): {
	title: string;
	text: string;
} {
	const note = (variant.note ?? '').trim();
	return { title: note, text: [note, variant.value].filter(Boolean).join('\n') };
}

/**
 * The profile's own value for one field, as a scorable unit.
 *
 * A unit type PER FIELD, rather than one type with the field in `subId`,
 * because `semanticScoreUnits` returns its scores keyed by (type, id) alone and
 * collapses sub-units by taking the max. Four defaults sharing the profile's id
 * would come back as one number — the best-matching field's — and every field
 * would then be compared against it. The bug is silent: variants simply stop
 * winning, on the profiles whose summary happens to score well.
 *
 * `content_embeddings.unit_type` is varchar(32), which this has to fit inside;
 * the prefix is kept short for the headroom, and a test asserts the fit so a
 * longer field name added to VARIANT_FIELDS fails there rather than at an
 * insert.
 */
export const DEFAULT_UNIT_PREFIX = 'field_default_';

export function defaultUnitType(field: string): string {
	return `${DEFAULT_UNIT_PREFIX}${field}`;
}

function defaultUnit(profileId: number, field: string, text: string): ContentUnit {
	return { unitType: defaultUnitType(field), unitId: profileId, subId: 0, embedText: text };
}

/**
 * Score the profile's own value and every variant of it, for each field that
 * has any. Returns nothing when the profile has no variants — the common case,
 * and one that must not cost a query on every tailoring run beyond the first.
 */
export async function chooseFieldVariants(opts: {
	profileId: number;
	/** The profile row, for the default value of each field. */
	profile: Record<string, unknown>;
	query: { text: string; skills: string[] };
	/** Cache the query vector under this key — see semanticScoreUnits. */
	queryUnit?: { unitType: string; unitId: number };
}): Promise<VariantChoice[]> {
	const { profileId, profile, query } = opts;

	const variants = await db
		.select({
			id: profile_field_variants.id,
			field: profile_field_variants.field,
			label: profile_field_variants.label,
			value: profile_field_variants.value,
			note: profile_field_variants.note,
			sort: profile_field_variants.sort
		})
		.from(profile_field_variants)
		.where(eq(profile_field_variants.profile_id, profileId))
		.orderBy(asc(profile_field_variants.sort), asc(profile_field_variants.id));
	if (variants.length === 0) return [];

	const defaults = new Map<string, string>();
	for (const f of VARIANT_FIELDS) {
		const base = typeof profile[f.field] === 'string' ? (profile[f.field] as string).trim() : '';
		if (base) defaults.set(f.field, base);
	}

	// Only fields that actually have a choice to make. A variant for a field the
	// profile leaves empty is still a candidate — it beats nothing, which is the
	// right answer when the applicant wrote one summary and marked it as being
	// for a kind of job.
	const fields = [...new Set(variants.map((v) => v.field))].filter((f) =>
		VARIANT_FIELDS.some((vf) => vf.field === f)
	);
	if (fields.length === 0) return [];

	const units: ContentUnit[] = [];
	for (const v of variants) {
		if (!fields.includes(v.field)) continue;
		units.push({
			unitType: OVERRIDE_ENTITIES.fieldVariant,
			unitId: v.id,
			subId: 0,
			embedText: matchTextFor(v).text
		});
	}
	for (const field of fields) {
		const base = defaults.get(field);
		if (!base) continue;
		units.push(defaultUnit(Number(profile.id), field, base));
	}

	const queryText = [query.text, ...query.skills].filter(Boolean).join('\n');
	const semantic = await semanticScoreUnits(profileId, units, queryText, opts.queryUnit);

	const scoreOf = (unit: ContentUnit, lexical: { title: string; text: string }): number =>
		semantic
			? (semantic.get(poolKey(unit.unitType, unit.unitId)) ?? 0)
			: scoreUnitAgainstQuery({ title: lexical.title, keywords: [], text: lexical.text }, query);

	const choices: VariantChoice[] = [];
	for (const field of fields) {
		const base = defaults.get(field) ?? '';
		const defaultScore = base
			? scoreOf(defaultUnit(Number(profile.id), field, base), { title: '', text: base })
			: 0;

		let best: { variant: FieldVariant; score: number } | null = null;
		for (const v of variants) {
			if (v.field !== field) continue;
			const score = scoreOf(
				{
					unitType: OVERRIDE_ENTITIES.fieldVariant,
					unitId: v.id,
					subId: 0,
					embedText: matchTextFor(v).text
				},
				matchTextFor(v)
			);
			// Ties go to the earlier variant, which is the applicant's own order.
			if (!best || score > best.score) best = { variant: v, score };
		}
		if (!best) continue;

		const bar = Math.max(defaultScore, MIN_MEANINGFUL_SCORE) * (1 + VARIANT_MARGIN);
		if (best.score <= bar) continue;
		choices.push({ field, variant: best.variant, score: best.score, defaultScore });
	}

	return choices;
}

/**
 * The chosen wordings as decisions, so they travel the same path every other
 * tailoring decision does: persisted by persistDecisions (which leaves a
 * hand-made pick alone), shown in the review diff, and undone by the same
 * toggle.
 *
 * `sort` is null — ordering means nothing for a field that holds one value, and
 * the review panel reads a non-null sort as "Moved up". A wording filed there
 * would be the only row in that group whose item was not already on the page.
 */
export function variantDecisions(choices: VariantChoice[]): Decision[] {
	return choices.map((c) => ({
		entityType: OVERRIDE_ENTITIES.fieldVariant,
		entityId: c.variant.id,
		action: 'include' as const,
		sort: null,
		// The reason names the alternative and what it was chosen over, because
		// "included" on a wording decision is otherwise unreadable: the applicant
		// cannot tell from it which of their four summaries is on the page.
		reason: c.variant.note
			? `your “${c.variant.label}” ${variantFieldLabel(c.field).toLowerCase()} — ${c.variant.note}`
			: `your “${c.variant.label}” ${variantFieldLabel(c.field).toLowerCase()} fits this job better than your default`
	}));
}
