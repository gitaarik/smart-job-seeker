/**
 * Choosing which wording a tailored version uses for the fields that hold one
 * value — the profile's title, subtitle, headline and summary, and each role's
 * position.
 *
 * This is the one part of tailoring that CHOOSES rather than filters. Every
 * other layer decides whether an item prints; there is only one summary and a
 * role has one title, so the question here is which of the applicant's own
 * alternatives fits this job (see $lib/field-variants.ts for why those fields
 * need it at all).
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
 * - It would cost a second round trip on every regeneration for a handful of
 *   decisions, and add a prompt whose failure mode is silent (see the
 *   llm:smoke preflight gap).
 *
 * If it ever earns one, the shape is the same as everywhere else: the model
 * adjusts the scores below and this function still picks the winner.
 *
 * ## Why the standing answer has to be beaten, not merely matched
 *
 * What the document would say without this run is a candidate like any other,
 * and it starts ahead. A variant replaces what the applicant chose as their
 * standing answer, so a score that ties it is not evidence of anything — and
 * swapping on noise makes every regeneration produce a different document from
 * the same inputs, which is the behaviour that makes a diff unreadable.
 *
 * The standing answer is usually the profile's own value. For a version built
 * on one that picked a wording, it is that wording: the applicant chose it for
 * the whole class of jobs the base version is for, and a run that compared
 * against the profile's value instead would be arguing with a document nobody
 * is looking at.
 *
 * ## What the run leaves alone
 *
 * A target the applicant has decided on this job's version — picked a wording
 * by hand, typed one, or taken one of the run's picks back off — is not scored
 * at all. A pick for a different wording of the same field is a different row,
 * so "never overwrite the applicant's row" would not stop a regeneration from
 * replacing the title they chose with another one.
 */

import {
	PRINTED_VARIANT_FIELDS,
	groupVariantsByTarget,
	variantFieldLabel,
	variantTargetKey,
	type FieldVariant,
	type VariantEntity
} from '$lib/field-variants';
import { OVERRIDE_ENTITIES } from '$lib/version-overrides';
import type { Decision } from '$lib/tailoring';
import {
	semanticScoreUnits,
	poolKey,
	type ContentUnit
} from '$lib/server/documents/content-embeddings';
import { scoreUnitAgainstQuery } from '$lib/server/documents/content-retrieval';
import { listFieldVariants } from '$lib/server/profile/field-variants';

/**
 * How much better a variant must score than the standing answer before it
 * replaces it, as a fraction of that answer's score.
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
 * A standing answer with no score at all cannot be beaten by a fraction of
 * nothing, so the margin is applied to at least this much. Below it the
 * comparison is between two numbers that both mean "no signal", and the
 * standing answer wins.
 */
const MIN_MEANINGFUL_SCORE = 0.01;

export interface VariantChoice {
	entity: VariantEntity;
	entityId: number;
	field: string;
	variant: FieldVariant;
	score: number;
	/** The score of what the document would have said instead. */
	defaultScore: number;
	/** The wording it replaces, when that is one a base version picked rather than the profile's own value. */
	replaces: FieldVariant | null;
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
 * The profile's own value for one target, as a scorable unit.
 *
 * A unit type PER FIELD, rather than one type with the field in `subId`,
 * because `semanticScoreUnits` returns its scores keyed by (type, id) alone and
 * collapses sub-units by taking the max. Four defaults sharing the profile's id
 * would come back as one number — the best-matching field's — and every field
 * would then be compared against it. The bug is silent: variants simply stop
 * winning, on the profiles whose summary happens to score well.
 *
 * The entity is in the type as well, for anything but the profile: a role's
 * default is keyed by the role's id, and ids from two tables can collide. The
 * profile's own fields keep the type they have always had, so the embeddings
 * already cached for them are still found.
 *
 * `content_embeddings.unit_type` is varchar(32), which this has to fit inside;
 * the prefixes are kept short for the headroom, and a test asserts the fit so a
 * longer name added to VARIANT_FIELDS fails there rather than at an insert.
 */
export const DEFAULT_UNIT_PREFIX = 'field_default_';

export function defaultUnitType(entity: string, field: string): string {
	return entity === 'profile' ? `${DEFAULT_UNIT_PREFIX}${field}` : `fd_${entity}_${field}`;
}

function defaultUnit(entity: string, entityId: number, field: string, text: string): ContentUnit {
	return { unitType: defaultUnitType(entity, field), unitId: entityId, subId: 0, embedText: text };
}

function variantUnit(variant: FieldVariant): ContentUnit {
	return {
		unitType: OVERRIDE_ENTITIES.fieldVariant,
		unitId: variant.id,
		subId: 0,
		embedText: matchTextFor(variant).text
	};
}

interface Target {
	entity: VariantEntity;
	entityId: number;
	field: string;
	/** The profile's own value; '' when the field is empty. */
	own: string;
}

function ownText(value: unknown): string {
	return typeof value === 'string' ? value.trim() : '';
}

/**
 * Every printed target the profile tree holds: the profile's own fields, and
 * each role's.
 *
 * Read off the loaded tree rather than queried, so the values compared are the
 * ones the rest of the run is looking at. A variant whose target is not in the
 * tree has nothing to stand in for and is never scored.
 */
function targetsOf(profile: Record<string, unknown>): Target[] {
	const targets: Target[] = [];
	const profileId = Number(profile.id);
	const roles = Array.isArray(profile.work_experiences)
		? (profile.work_experiences as Record<string, unknown>[])
		: [];
	for (const f of PRINTED_VARIANT_FIELDS) {
		if (f.entity === 'profile') {
			targets.push({
				entity: 'profile',
				entityId: profileId,
				field: f.field,
				own: ownText(profile[f.field])
			});
			continue;
		}
		for (const role of roles) {
			if (typeof role?.id !== 'number') continue;
			targets.push({
				entity: 'work_experience',
				entityId: role.id,
				field: f.field,
				own: ownText(role[f.field])
			});
		}
	}
	return targets;
}

/**
 * Score the standing answer and every variant of it, for each target that has
 * any. Returns nothing when the profile has no variants — the common case, and
 * one that must not cost more than the one query that finds that out.
 */
export async function chooseFieldVariants(opts: {
	profileId: number;
	/** The loaded profile tree, for the own value of each field and of each role's. */
	profile: Record<string, unknown>;
	query: { text: string; skills: string[] };
	/** Cache the query vector under this key — see semanticScoreUnits. */
	queryUnit?: { unitType: string; unitId: number };
	/**
	 * The wording a version this one builds on already picked, per target key.
	 * It is what the document says without this run, so it is what a variant has
	 * to beat. Absent for a target, the profile's own value is.
	 */
	standing?: Map<string, FieldVariant>;
	/** Targets the applicant has decided on this version, by key. Not scored. */
	locked?: Set<string>;
}): Promise<VariantChoice[]> {
	const { profileId, profile, query } = opts;

	const variants = await listFieldVariants(profileId);
	if (variants.length === 0) return [];
	const byTarget = groupVariantsByTarget(variants);

	// Only targets that actually have a choice to make. A variant for a field
	// the profile leaves empty is still a candidate — it beats nothing, which is
	// the right answer when the applicant wrote one summary and marked it as
	// being for a kind of job.
	//
	// Printed fields only, so an unprinted one is not merely undecided here but
	// unscored: the alternatives an applicant keeps for their LinkedIn About are
	// a real library, and embedding every one of them against every job would
	// buy a Decision the document has no way to act on.
	const open = targetsOf(profile)
		.map((target) => ({
			...target,
			key: variantTargetKey(target.entity, target.entityId, target.field)
		}))
		.filter((target) => byTarget.has(target.key) && !opts.locked?.has(target.key));
	if (open.length === 0) return [];

	const units: ContentUnit[] = [];
	for (const target of open) {
		for (const v of byTarget.get(target.key) ?? []) units.push(variantUnit(v));
		if (target.own) {
			units.push(defaultUnit(target.entity, target.entityId, target.field, target.own));
		}
	}

	const queryText = [query.text, ...query.skills].filter(Boolean).join('\n');
	const semantic = await semanticScoreUnits(profileId, units, queryText, opts.queryUnit);

	const scoreOf = (unit: ContentUnit, lexical: { title: string; text: string }): number =>
		semantic
			? (semantic.get(poolKey(unit.unitType, unit.unitId)) ?? 0)
			: scoreUnitAgainstQuery({ title: lexical.title, keywords: [], text: lexical.text }, query);
	const scoreOfVariant = (v: FieldVariant) => scoreOf(variantUnit(v), matchTextFor(v));

	const choices: VariantChoice[] = [];
	for (const target of open) {
		const options = byTarget.get(target.key) ?? [];
		// A pick inherited from the base version, if it is still one of this
		// target's wordings. One that has been deleted since stands for nothing.
		const inherited = opts.standing?.get(target.key);
		const standing = inherited ? (options.find((v) => v.id === inherited.id) ?? null) : null;

		const defaultScore = standing
			? scoreOfVariant(standing)
			: target.own
				? scoreOf(defaultUnit(target.entity, target.entityId, target.field, target.own), {
						title: '',
						text: target.own
					})
				: 0;

		let best: { variant: FieldVariant; score: number } | null = null;
		for (const v of options) {
			if (v.id === standing?.id) continue;
			const score = scoreOfVariant(v);
			// Ties go to the earlier variant, which is the applicant's own order.
			if (!best || score > best.score) best = { variant: v, score };
		}
		if (!best) continue;

		const bar = Math.max(defaultScore, MIN_MEANINGFUL_SCORE) * (1 + VARIANT_MARGIN);
		if (best.score <= bar) continue;
		choices.push({
			entity: target.entity,
			entityId: target.entityId,
			field: target.field,
			variant: best.variant,
			score: best.score,
			defaultScore,
			replaces: standing
		});
	}

	return choices;
}

/**
 * The choices for what a document actually prints.
 *
 * A wording for a role the document leaves off decides nothing a reader will
 * see, and in the review it reads as a change to the page. Which roles print
 * is settled by the selection, and a selection is made more than once per run
 * (the fit pass re-selects against tighter budgets), so the choices are made
 * once for every role and narrowed per selection.
 */
export function choicesForPrintedRoles(
	choices: VariantChoice[],
	printedRoleIds: Set<number>
): VariantChoice[] {
	return choices.filter((c) => c.entity !== 'work_experience' || printedRoleIds.has(c.entityId));
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
	return choices.map((c) => {
		const what = variantFieldLabel(c.entity, c.field).toLowerCase();
		// The reason names the alternative and what it was chosen over, because
		// "included" on a wording decision is otherwise unreadable: the applicant
		// cannot tell from it which of their four summaries is on the page.
		const over = c.replaces ? `“${c.replaces.label}”` : 'your default';
		return {
			entityType: OVERRIDE_ENTITIES.fieldVariant,
			entityId: c.variant.id,
			action: 'include' as const,
			sort: null,
			reason: c.variant.note
				? `your “${c.variant.label}” ${what} — ${c.variant.note}`
				: `your “${c.variant.label}” ${what} fits this job better than ${over}`
		};
	});
}
