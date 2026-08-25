/**
 * The applicant's other applications, as a comparison table.
 *
 * Answers the questions retrieval structurally cannot: *which* of my
 * applications is furthest along, *how many* are stalled, *where* does this one
 * rank. Top-k similarity gives a biased sample — fine for "find me evidence
 * about X", wrong for a comparison, where an incomplete set makes the answer
 * false rather than merely thin. So this source renders the pipeline WHOLE and
 * pays for it by rendering each application as one line rather than as prose.
 *
 * ## Why a table and not retrieval
 *
 * The axes people actually compare on are already columns: stage, how long it
 * has been stuck there, salary, match score, when they applied. A dozen other
 * applications' job descriptions would be ten times this whole prompt's budget;
 * a dozen rows is about 4k. Depth — what an interviewer actually said, what the
 * offer letter actually contains — is the job of the per-application history
 * (application-activity.ts) and, later, of cross-application retrieval.
 *
 * ## Why the current application is IN the table
 *
 * Deliberately inverting the `excludeApplicationId` convention that keeps a
 * cover letter from retrieving itself. That rule is right for retrieval, where
 * being your own evidence is degenerate. Here the current application is the
 * baseline: without it the model holds this one in prose and the rest in a
 * table, and has to bridge two formats to compare.
 *
 * See planning/SEMANTIC-MATCHING-AND-RAG.md and APPLICATION-ACTIVITY.md.
 */

import { db } from '$lib/server/db';
import { and, eq, inArray } from 'drizzle-orm';
import { application_records, applications, job_matches } from '$lib/server/db/schema';
import { getFxRates } from '$lib/server/salary/fx';
import {
	convertCurrency,
	hourlyToRate,
	normalizeSalaryPeriod,
	rateToHourly
} from '$lib/salary/conversion';
import { getStatusLabel, isFinishedStatus } from '$lib/application-status';
import { isSnoozed } from '$lib/application-snooze';
import type { OfferTerms } from './application-summary';
import type { StoredDetail } from '$lib/application-details';

/**
 * Cap on applications rendered. Set well above a realistic open pipeline so it
 * effectively never binds — and when it does, the block says so.
 *
 * A silent cap is worse here than anywhere else in the context system: a
 * comparison over a truncated set is not vague, it is wrong ("this is your
 * strongest option" when the strongest was cut).
 */
const MAX_APPLICATIONS = 25;

/**
 * Char ceiling on the whole block.
 *
 * This is the only context source whose size grows with how long the user has
 * been job-hunting, and standing summaries roughly tripled its per-row cost.
 * Measured on dev: the fixed header is ~1.2k, a bare row ~250, a summarised row
 * ~800. So 25 bare rows is ~7.4k but 25 summarised rows is ~21k — two thirds of
 * the 32k chat budget, for background on applications the user did not ask
 * about.
 *
 * 12k leaves every row present with roughly the eight most active keeping their
 * summaries, and sits far enough above the common case (six applications, all
 * summarised, ~6k) that it does not bind until the pipeline is genuinely large.
 */
export const DEFAULT_PIPELINE_BUDGET_CHARS = 12000;

/**
 * The ceiling on a page where the pipeline is the SUBJECT rather than
 * background — the applications list and its siblings.
 *
 * 12k was sized against the competition on an application page, where
 * `application_activity` (10.2k measured) and `job` (1.7k) take a third of the
 * chat budget before this source gets a look in. On a list page neither exists,
 * so that space is simply free, and rationing the one source the page is
 * actually about would be backwards.
 *
 * At ~800 chars a summarised row this covers the full MAX_APPLICATIONS cap, so
 * in practice the ladder does not engage there at all. It is a ceiling, not a
 * target: unusually long summaries will still shed a few, which is the ladder
 * working rather than a limit being hit.
 */
export const LIST_PIPELINE_BUDGET_CHARS = 24000;

/** Everything one row needs. Kept narrow so the renderer is testable dry. */
export interface PipelineRow {
	id: number;
	isCurrent: boolean;
	title: string | null;
	company: string | null;
	/**
	 * The intermediary the job came through — agency, staffing firm, named
	 * recruiter — when the posting names one distinct from the company.
	 *
	 * Loaded here since the beginning and, until now, discarded: `company` fell
	 * back to it and otherwise it went nowhere. So a recruiter placing the
	 * applicant at five different clients was five unrelated rows, and asked
	 * whether one application connected to any other the assistant answered "I
	 * checked for any overlap in company names or recruiters — entirely
	 * separate" about a job posted by the firm the applicant works for.
	 *
	 * It is rendered rather than resolved into an entity, because spotting the
	 * same string on three rows is what a model is already good at. Build the
	 * entity when THAT fails.
	 */
	poster: string | null;
	status: string;
	step: string | null;
	action: string | null;
	/** Days since the stage last moved — the highest-signal derived column. */
	daysInStage: number | null;
	/**
	 * The day a paused application comes back, when one is set and still ahead.
	 *
	 * The pipeline is rendered WHOLE on purpose, so a snoozed application stays
	 * in the table rather than being filtered out of it — but `daysInStage` on a
	 * parked application reads as stalled, and "you have not touched this in 40
	 * days" is wrong advice about a decision the applicant already made.
	 */
	snoozedUntil: string | null;
	appliedOn: string | null;
	/** As written, e.g. "EUR 70000-90000/year". Null when the job says nothing. */
	salary: string | null;
	/** The same figure normalised to one currency and period, for ranking. */
	salaryAnnual: number | null;
	workLocation: string | null;
	matchScore: number | null;
	matchRecommendation: string | null;
	/** What depth exists, so the model knows when to say "I can look that up". */
	entryCount: number;
	hasOffer: boolean;
	/** The standing digest, when one has been generated. */
	summary: string | null;
	/**
	 * The details extracted from this application's entries. On OTHER
	 * applications these are the only specifics the model gets — the current
	 * one's entries are already in the prompt in full — so this is where a
	 * question like "which of these needs a certification I don't have?" finds
	 * its answer instead of hedging.
	 */
	details: StoredDetail[];
	/**
	 * Offer terms as extracted fields. This is what turns "an offer exists" into
	 * "which offer is better" — the answer the spine could not give before.
	 */
	offer: OfferTerms | null;
	/**
	 * Whether anyone from the employer has been recorded on this application.
	 * NULL means nothing has been analysed yet, which is NOT the same as "nobody
	 * was involved" — see derived_at in APPLICATION-ACTIVITY.md. Reporting the
	 * two as the same is how a stalled application would look like an active one.
	 */
	employerContact: boolean | null;
	/**
	 * Who was involved, deduped across every analysed entry on this application.
	 *
	 * `employerContact` used to be the whole story — `contacts` was selected and
	 * then reduced to `.some(… .length > 0)`, so the names were loaded and
	 * thrown away, and the model could report THAT the applicant had spoken to
	 * someone but never WHO. Asked who they had spoken to at a named company it
	 * answered "the names will be in those transcripts… we can go to that
	 * application's page", about names already extracted into a column.
	 *
	 * The tri-state stays: it is what distinguishes "nobody was involved" from
	 * "nobody has looked yet", and an empty array cannot say which.
	 */
	contacts: string[];
}

const dash = (v: string | number | null | undefined) =>
	v === null || v === undefined || v === '' ? '—' : String(v);

/**
 * The offer's terms, as offered. Deliberately NOT converted: a comparison the
 * model makes across currencies is its own business, but quoting a converted
 * number as what an employer put in writing would be a fabrication about the
 * most consequential thing in the product.
 */
export function describeOffer(o: OfferTerms): string {
	const parts: string[] = [];
	if (o.base !== null) {
		parts.push(
			[o.currency, o.base.toLocaleString()].filter(Boolean).join(' ') +
				(o.period ? `/${o.period}` : '')
		);
	}
	if (o.bonus) parts.push(`bonus ${o.bonus}`);
	if (o.equity) parts.push(`equity ${o.equity}`);
	if (o.start_date) parts.push(`starts ${o.start_date}`);
	// Last, and labelled loudly: it is the only field here with a deadline
	// attached, and missing it costs the applicant the offer.
	if (o.respond_by) parts.push(`RESPOND BY ${o.respond_by}`);
	if (o.notes) parts.push(o.notes);
	return parts.length > 0 ? parts.join(' · ') : 'terms not stated';
}

/** One application as its block of lines. Extracted so the budgeter can price
 * a row exactly, by rendering it, rather than estimating. */
function renderRow(r: PipelineRow, currency: string): string {
	// The id is always stated, even when there is a perfectly good name, because
	// the activity index names the same applications and the model has to be able
	// to match the two up. Without it: profile 12's one application appeared as
	// "Senior Backend Engineer" here and "Senior Backend Engineer (application
	// 16)" there, and the assistant reported a transcript belonging to "another
	// Senior Backend Engineer position" — inventing a second application out of
	// two spellings of one.
	const who = [[r.title, r.company].filter(Boolean).join(' at '), `(application ${r.id})`]
		.filter(Boolean)
		.join(' ');
	const stage = [
		getStatusLabel(r.status),
		r.step,
		r.action,
		r.snoozedUntil ? `SNOOZED until ${r.snoozedUntil}` : null
	]
		.filter(Boolean)
		.join(' / ');
	const stalled = r.daysInStage !== null ? `${r.daysInStage}d in stage` : 'age unknown';
	const pay = r.salary
		? r.salaryAnnual
			? `${r.salary} (~${r.salaryAnnual.toLocaleString()} ${currency}/yr)`
			: r.salary
		: 'no salary stated';
	const match =
		r.matchScore !== null
			? `match ${r.matchScore}${r.matchRecommendation ? ` (${r.matchRecommendation})` : ''}`
			: 'not scored';
	const depth = [
		`${r.entryCount} ${r.entryCount === 1 ? 'entry' : 'entries'}`,
		r.hasOffer ? 'OFFER RECORDED' : null,
		r.employerContact === null
			? 'employer contact unknown'
			: r.employerContact
				? `spoke with ${r.contacts.join(', ')}`
				: 'no employer contact recorded'
	]
		.filter(Boolean)
		.join(', ');

	// Deliberately NOT part of `who`: that string has to match the activity
	// index heading character for character, or one application reads as two.
	const via = r.poster && r.poster !== r.company ? `via ${r.poster}` : null;

	return [
		`- ${r.isCurrent ? '**THIS ONE** — ' : ''}${who}`,
		`  ${[stage, stalled, `applied ${dash(r.appliedOn)}`, via].filter(Boolean).join(' · ')}`,
		`  ${pay} · ${dash(r.workLocation)} · ${match}`,
		`  ${depth}`,
		r.offer ? `  OFFER: ${describeOffer(r.offer)}` : null,
		r.summary ? `  ${r.summary.replace(/\s+/g, ' ').trim()}` : null,
		// Optional-chained though the type says it is always there: a throw here
		// is swallowed by applicationPipelineText and reaches the model as an
		// EMPTY pipeline, which is the one failure this source cannot afford — a
		// comparison over a set that silently lost every row is wrong, not thin.
		r.details?.length
			? `  Noted: ${r.details.map((d) => `${d.label} — ${d.value}`).join('; ')}`
			: null
	]
		.filter(Boolean)
		.join('\n');
}

/**
 * Render the pipeline as a prompt block. Pure — no DB — so both the layout and
 * the "what does the model do with it" guidance are directly testable.
 */
export function formatPipelineContext(
	rows: PipelineRow[],
	opts: { omitted?: number; shed?: number; finished?: number; currency?: string } = {}
): string {
	const finished = opts.finished ?? 0;
	// An all-finished profile still gets a block. Returning '' there would say
	// "no applications" to a user who has twenty — which is the same confident
	// false negative this note exists to prevent, at its most extreme.
	if (rows.length === 0 && finished === 0) return '';

	const currency = opts.currency ?? 'EUR';
	const lines = rows.map((r) => renderRow(r, currency));

	const omission =
		opts.omitted && opts.omitted > 0
			? [
					'',
					`NOTE: ${opts.omitted} further application(s) exist but were omitted to`,
					'fit. Say the picture is partial if the user asks you to rank or count.'
				]
			: [];

	// The empty-vs-never-looked distinction again, one level down. A row with no
	// summary looks identical whether none was ever generated or one was dropped
	// to fit — and read as the former, a busy application reads as a dormant one.
	//
	// The count alone would leave the model guessing WHICH rows, so it is pointed
	// at the discriminator already on every row: entries are counted whether or
	// not a summary survived, so "entries but no summary" is exactly the set.
	// Erring the other way is harmless (offering detail that turns out thin);
	// erring this way tells someone an active application is dead.
	const shedding =
		opts.shed && opts.shed > 0
			? [
					'',
					`NOTE: ${opts.shed} application(s) below show their headline facts`,
					'without a summary, which did not fit. That is a budget limit, NOT an',
					'empty history: a row with entries but no summary HAS a history you',
					'cannot see from here. Offer to open that application rather than',
					'treating it as one where nothing has happened.'
				]
			: [];

	// Finished applications are absent by design (see loadPipelineRows), and the
	// model cannot tell "excluded" from "does not exist" — the failure this file
	// and activity-manifest.ts have each been patched for once already.
	//
	// It is pointed at where they ARE visible rather than just given a count,
	// because a count alone invites a guess. The activity index lists every
	// application, finished ones included, and carries the status on each
	// heading; that is a place to look, not a number to reason from.
	const excluded =
		finished > 0
			? [
					'',
					`NOTE: ${finished} finished application(s) — rejected, withdrawn or`,
					'accepted — are not in the table below. This table is what is IN PLAY,',
					'not everything that exists. They are listed in the activity index with',
					'their status, so answer questions about outcomes and history from',
					'there rather than saying there are none.'
				]
			: [];

	// Two framings, because the same rows mean different things depending on
	// whether one of them is the one on screen. On an application page the
	// pipeline is peripheral and an assistant that leads with it is answering a
	// question nobody asked. Where none is current it IS the subject, and the
	// same restraint would make it refuse to do the one thing the page is for.
	//
	// Which one is decided by whether a row is marked, never by a flag a caller
	// passes: the old header promised "the one they are looking at now (marked
	// THIS ONE)" unconditionally, so on /jobs/[id] — where the pipeline has
	// always been in scope with no application current — it told the model to
	// find a marker no row carried. Pointing a model at something absent is an
	// invitation to nominate a substitute.
	//
	// ## What this block does NOT say any more
	//
	// Where the user is, and what a bare question means there, is now stated once
	// by the `page_scope` block (page-scope.ts). This one used to say it too —
	// "the applicant is looking at a LIST ... do not single one out" — which was
	// the same claim sourced from different evidence, and two places wording one
	// rule is how they drift.
	//
	// The division that survives is page fact vs block fact. That the user is not
	// on any single application is a fact about the PAGE, and page_scope owns it.
	// That no row here carries a marker is a fact about THESE ROWS, and it stays,
	// because it is what stops the model hunting for a THIS ONE that is not there
	// — the bug above. Both are true at once and neither implies the other: the
	// pipeline appears on /jobs/[id] with no row marked and no application page
	// in sight.
	const onOne = rows.some((r) => r.isCurrent);

	const framing = onOne
		? [
				"## The applicant's other applications in progress",
				'',
				// The tone guard. Always-on context makes an assistant volunteer
				// summaries nobody asked for; most turns here are not about it.
				"This is background on the rest of the applicant's pipeline, including the",
				'one they are looking at now (marked THIS ONE). Draw on it when they ask',
				'how this compares, when they ask what to prioritise, or when it materially',
				'changes your advice — an application stuck for weeks, or an offer already',
				'in hand elsewhere, changes what is worth doing here. Do NOT open every',
				'reply with a pipeline summary, and do not bring up other applications when',
				'the question is only about this one.',
				'',
				// Wrapped so "not of the others" stays whole — these lines are joined
				// with "\n" and a phrase broken across two of them can never be asserted
				// on. Same convention as application-activity.ts's guidance block.
				'You can read the full history of the application they are ON,',
				'but not of the others.'
			]
		: [
				"## The applicant's applications in progress",
				'',
				// Deliberately does not name the marker. Saying which token is absent
				// still puts it in front of the model, and the whole bug this framing
				// exists for was the model going looking for one.
				'No row below is marked: none of these is the current one.',
				'Comparing, ranking and prioritising across them is exactly what gets',
				'asked of this block, and the whole set is below, so answering across all',
				'of them is normal rather than a digression.'
			];

	return [
		...framing,
		'',
		// Was written out twice, once per framing, in near-identical words. The
		// guard is the same either way: a line here is a digest, and the thing it
		// digests is readable somewhere else.
		'Each line is a summary, not the whole story. If they ask for detail about',
		'one of them — what an interviewer actually said, what a document contains',
		"— say it is on that application's page rather than inventing it.",
		'',
		'An OFFER line carries terms exactly as they were offered — quote those',
		'verbatim and never convert them. A RESPOND BY date is a deadline: if one',
		'is close, say so unprompted, because missing it costs the offer.',
		'',
		'Salary figures in brackets are converted to one currency and period so',
		'they can be ranked. Quote the figure as written, never the converted one,',
		'and never present a conversion as what the employer offered.',
		...omission,
		...shedding,
		...excluded,
		'',
		...lines
	].join('\n');
}

/**
 * The degradation ladder: fit the block into `budgetChars` by giving up depth
 * before giving up applications.
 *
 * Completeness is the invariant this whole source rests on — a comparison over
 * a partial set is wrong rather than thin — so rows are the LAST thing to go.
 * The rungs, cheapest loss first:
 *
 *  1. The current application's summary AND its details — both are the most
 *     redundant text in the prompt: `application_activity` (priority 40, so it
 *     is always present when this block is) carries that application's full
 *     history right alongside, at roughly fifteen times the length.
 *  2. Details from the stalest rows down, before any surviving summary. A
 *     summary is the row's spine — where this stands, what is outstanding — and
 *     the details are specifics hanging off it. Given the choice, a model
 *     answering "how is my search going" needs the position more than the
 *     particulars, and the particulars are exactly what it can offer to look up.
 *  3. Summaries from the stalest rows down. A summary earns its place by
 *     describing something in motion; on an application that has not moved in
 *     two months the structured line ("94d in stage", stage, entry count)
 *     already says the useful part. Rows carrying an offer are held back to
 *     last — an offer means a decision is pending, however long it has sat.
 *  4. Only then, rows themselves, from the stalest end, counted into the
 *     omission note so the model knows the picture is partial.
 *
 * Returns rows with shed details emptied and shed summaries nulled, so the
 * renderer stays unchanged.
 *
 * Only summaries are counted into `shed`. The note it drives exists to stop a
 * summary-less row reading as an empty history; a row that kept its summary and
 * lost its details has not lost its history, and announcing it would train the
 * model to hedge about applications it can see perfectly well.
 */
export function fitPipelineToBudget(
	rows: PipelineRow[],
	budgetChars: number,
	currency = 'EUR',
	/** Counted into the price because the note it drives ships inside the block —
	 *  measuring without it would budget for a block that is not the one sent. */
	finished = 0
): { rows: PipelineRow[]; omitted: number; shed: number } {
	// Price by rendering. The block is at most 25 short rows, so measuring the
	// real thing costs nothing and cannot drift from what actually ships — which
	// an estimate of header + per-row would, silently, on the next layout edit.
	const cost = (rs: PipelineRow[], omitted: number, shed: number) =>
		formatPipelineContext(rs, { omitted, shed, finished, currency }).length;

	if (rows.length === 0) return { rows, omitted: 0, shed: 0 };
	if (cost(rows, 0, 0) <= budgetChars) return { rows, omitted: 0, shed: 0 };

	const working = rows.map((r) => ({ ...r }));

	/**
	 * Ascending order of what a row's depth is worth, shared by both shedding
	 * rungs so they cannot disagree about which application matters least.
	 */
	const orderBy = (has: (r: PipelineRow) => boolean) =>
		working
			.map((r, i) => ({ r, i }))
			.filter(({ r }) => has(r))
			.sort(
				(a, z) =>
					// The current application first: its full history is in another block.
					Number(z.r.isCurrent) - Number(a.r.isCurrent) ||
					// Then anything without an offer, since an offer means a live decision.
					Number(!!a.r.offer) - Number(!!z.r.offer) ||
					// Then stalest down. An unknown age sorts last: it is a weak signal,
					// and a known-stale row is the safer thing to thin.
					(z.r.daysInStage ?? -1) - (a.r.daysInStage ?? -1)
			)
			.map(({ i }) => i);

	// Tracked by object identity rather than index, so the count stays right
	// whichever rows the last rung goes on to remove.
	const shedRows = new Set<PipelineRow>();

	// Rungs 1 and 2 — details go before any summary does.
	for (const i of orderBy((r) => r.details.length > 0)) {
		if (cost(working, 0, shedRows.size) <= budgetChars) break;
		working[i].details = [];
	}

	// Rungs 1 and 3 — then summaries, in the same order.
	for (const i of orderBy((r) => !!r.summary)) {
		if (cost(working, 0, shedRows.size) <= budgetChars) break;
		working[i].summary = null;
		shedRows.add(working[i]);
	}
	const shedIn = (rs: PipelineRow[]) => rs.filter((r) => shedRows.has(r)).length;

	// Rung 3 — drop rows from the stale end. `rows` arrives sorted current-first
	// then most-recently-active, so the last droppable row is the stalest.
	//
	// A current row is never dropped, and that is enforced here rather than left
	// to the caller's sort order: losing it would not just omit a row, it would
	// flip the framing above to "the applicant is looking at a list of these",
	// which on an application page is simply false.
	//
	// The condition prices the CURRENT state, not the state after another drop.
	// Dropping the first row is what makes the omission note appear, so asking
	// "would it fit if I dropped one more" charges for a note that is not there
	// yet, and drops rows that a block which already fits need not lose.
	let kept = working;
	let omitted = 0;
	while (kept.length > 1 && cost(kept, omitted, shedIn(kept)) > budgetChars) {
		let last = kept.length - 1;
		while (last >= 0 && kept[last].isCurrent) last--;
		if (last < 0) break;
		kept = [...kept.slice(0, last), ...kept.slice(last + 1)];
		omitted++;
	}

	// Only the surviving rows are worth announcing as shed — a dropped row is
	// reported by the omission note, and counting it twice would overstate both.
	return { rows: kept, omitted, shed: shedIn(kept) };
}

/** Whole days between then and now, or null when there is no date. */
/**
 * The distinct people across a set of entries, "Name (role)" where a role is
 * known, in first-seen order.
 *
 * Deduped on the name as written, which is imperfect on purpose: "P Baeten"
 * and "P. Baeten" are two entries here, as they are two entries in the column.
 * Collapsing them is entity resolution and belongs in a table, not in a
 * renderer that would have to guess. Listing both is honest and still lets the
 * model see the recurrence.
 *
 * Capped, because one application can accumulate a whole hiring panel and this
 * line sits inside the pipeline budget.
 */
const MAX_CONTACTS_LISTED = 8;

function namesOf(entries: Array<{ contacts?: unknown }>): string[] {
	const seen = new Map<string, string>();
	for (const e of entries) {
		const list = (e.contacts ?? []) as Array<{ name?: unknown; role?: unknown }>;
		if (!Array.isArray(list)) continue;
		for (const c of list) {
			const name = typeof c?.name === 'string' ? c.name.trim() : '';
			if (!name || seen.has(name)) continue;
			const role = typeof c?.role === 'string' && c.role.trim() ? ` (${c.role.trim()})` : '';
			seen.set(name, `${name}${role}`);
		}
	}
	const all = [...seen.values()];
	return all.length > MAX_CONTACTS_LISTED
		? [...all.slice(0, MAX_CONTACTS_LISTED), `+${all.length - MAX_CONTACTS_LISTED} more`]
		: all;
}

function daysSince(date: Date | string | null): number | null {
	if (!date) return null;
	const then = date instanceof Date ? date : new Date(date);
	if (isNaN(then.getTime())) return null;
	const days = Math.floor((Date.now() - then.getTime()) / 86_400_000);
	return days < 0 ? 0 : days;
}

/** "EUR 70000-90000/year", or null when the job states nothing usable. */
function describeSalary(job: {
	salary_min: number | null;
	salary_max: number | null;
	salary_currency: string | null;
	salary_period: string | null;
}): string | null {
	const { salary_min: min, salary_max: max } = job;
	if (min == null && max == null) return null;
	const cur = job.salary_currency || '';
	const per = normalizeSalaryPeriod(job.salary_period);
	const amount =
		min != null && max != null && min !== max
			? `${min.toLocaleString()}-${max.toLocaleString()}`
			: (min ?? max)!.toLocaleString();
	return [cur, amount].filter(Boolean).join(' ') + (per ? `/${per}` : '');
}

/**
 * A single comparable number: the midpoint, normalised to one currency and a
 * yearly period. Null whenever any part of that is unknown — a missing FX rate
 * must read as "cannot compare", never as zero.
 */
function annualise(
	job: {
		salary_min: number | null;
		salary_max: number | null;
		salary_currency: string | null;
		salary_period: string | null;
	},
	target: string,
	rates: Record<string, number>
): number | null {
	const { salary_min: min, salary_max: max } = job;
	if (min == null && max == null) return null;
	const mid = min != null && max != null ? (min + max) / 2 : (min ?? max)!;
	const period = normalizeSalaryPeriod(job.salary_period);
	// A fixed-price engagement has no annual equivalent; saying one would be a
	// fabricated comparison rather than a rough one.
	if (!period || period === 'project') return null;
	// No stated currency means no comparable figure. Defaulting to the target
	// would silently assert a currency the employer never named — dev has a job
	// listed as "100/year" that rendered as "~100 EUR/yr", which reads as a fact.
	const from = job.salary_currency?.trim();
	if (!from) return null;
	const yearly = Math.round(hourlyToRate(rateToHourly(mid, period), 'year'));
	return convertCurrency(yearly, from, target, rates);
}

/**
 * Load the profile's in-progress applications as rows: the DB reads, the
 * derived columns (days in stage, normalised salary, match score, entry count,
 * employer contact) and the sort. Every application is returned — the caps are
 * a prompt-budget concern and live in `applicationPipelineText`, which
 * announces what they cost.
 *
 * ⚠️ This is the first context source that reads rows the route never
 * authorized. Every other scoped source reads only the entity resolved and
 * checked in chat-context.ts, so the `profile_id` filter here is load-bearing
 * rather than hygiene.
 *
 * THROWS on a real failure, deliberately. Swallowing is a prompt-assembly
 * policy, and it lives one level up; for this source especially, a caller
 * reading it as data must not receive a failed query as an empty pipeline —
 * a comparison over a set that silently lost rows is wrong, not thin.
 */
export async function loadPipelineRows(
	profileId: number,
	currentApplicationId: number | null
): Promise<{ rows: PipelineRow[]; finished: number }> {
	const rows = await db.query.applications.findMany({
		where: eq(applications.profile_id, profileId),
		columns: {
			id: true,
			// Selected because the match score is keyed by job, not application.
			// Without it every lookup below missed and the whole pipeline rendered
			// "not scored" — silently, since "not scored" is a legitimate state.
			job_id: true,
			status: true,
			status_step: true,
			status_action: true,
			status_action_date: true,
			snoozed_until: true,
			application_sent_date: true,
			date_updated: true,
			date_created: true,
			context_summary: true,
			offer_terms: true,
			context_details: true
		},
		with: {
			job: {
				columns: {
					title: true,
					company: true,
					job_poster: true,
					salary_min: true,
					salary_max: true,
					salary_currency: true,
					salary_period: true,
					work_location: true
				}
			}
		}
	});

	// Finished applications are excluded: they grow without bound and dilute
	// "what am I working on". The current one is kept even if finished — the
	// user is looking at it, so a table that omits it reads as a bug.
	const live = rows.filter((a) => !isFinishedStatus(a.status) || a.id === currentApplicationId);
	// The count of what the filter dropped is returned, not swallowed. Excluding
	// them is right — see the comment above — but doing it SILENTLY is what let
	// "what patterns come up across my rejected applications?" be answered with
	// "I don't actually see any that are marked as rejected" on a profile with
	// four of them. The rows go; the fact that they exist does not.
	const finished = rows.length - live.length;
	if (live.length === 0) return { rows: [], finished };

	const ids = live.map((a) => a.id);
	const [matches, records, rates] = await Promise.all([
		db.query.job_matches.findMany({
			where: eq(job_matches.profile_id, profileId),
			columns: {
				job_id: true,
				score: true,
				recommendation: true
			}
		}),
		db.query.application_records.findMany({
			where: inArray(application_records.application_id, ids),
			columns: {
				application_id: true,
				record_type: true,
				contacts: true,
				derived_at: true
			}
		}),
		getFxRates()
	]);

	const byApp = new Map<number, typeof records>();
	for (const r of records) {
		const list = byApp.get(r.application_id) ?? [];
		list.push(r);
		byApp.set(r.application_id, list);
	}

	const built: PipelineRow[] = live.map((a) => {
		const entries = byApp.get(a.id) ?? [];
		const analysed = entries.filter((e) => e.derived_at);
		return {
			id: a.id,
			isCurrent: a.id === currentApplicationId,
			title: a.job?.title ?? null,
			company: a.job?.company ?? a.job?.job_poster ?? null,
			poster: a.job?.job_poster ?? null,
			status: a.status,
			step: a.status_step,
			action: a.status_action,
			// The stage's own date first: date_updated moves on any edit, so it
			// would report a freshly retitled note as "the stage just changed".
			daysInStage: daysSince(a.status_action_date ?? a.date_updated ?? a.date_created),
			// Only while it is still ahead: an elapsed snooze is not one, and
			// stating a date in the past would read as a pause still in force.
			snoozedUntil: isSnoozed(a) ? a.snoozed_until : null,
			appliedOn: a.application_sent_date,
			salary: a.job ? describeSalary(a.job) : null,
			salaryAnnual: a.job ? annualise(a.job, 'EUR', rates) : null,
			workLocation: Array.isArray(a.job?.work_location)
				? (a.job.work_location as string[]).join(', ')
				: null,
			matchScore: null,
			matchRecommendation: null,
			entryCount: entries.length,
			summary: a.context_summary,
			offer: a.offer_terms ?? null,
			details: a.context_details ?? [],
			// True from either direction: an entry typed as an offer, or terms
			// actually extracted. The type alone is what shows before the
			// summariser has run.
			hasOffer:
				!!a.offer_terms ||
				entries.some((e) => e.record_type === 'offer' || e.record_type === 'contract'),
			// Unknown until something has actually looked. Reporting "no contact"
			// for an un-analysed application would make it look stalled when it
			// may be the most active one.
			employerContact:
				analysed.length === 0
					? null
					: analysed.some((e) => ((e.contacts ?? []) as unknown[]).length > 0),
			contacts: namesOf(analysed)
		};
	});

	// Match scores are keyed by job, not application; attach them separately so
	// an application with no job (hand-created) simply has none.
	const scoreByJob = new Map(matches.map((m) => [m.job_id, m]));
	for (const [i, a] of live.entries()) {
		const m = a.job_id != null ? scoreByJob.get(a.job_id) : undefined;
		if (m) {
			built[i].matchScore = m.score;
			built[i].matchRecommendation = m.recommendation;
		}
	}

	// Current first, then most recently active — so a long pipeline is
	// truncated from its stalest end rather than arbitrarily.
	built.sort(
		(x, y) =>
			Number(y.isCurrent) - Number(x.isCurrent) || (x.daysInStage ?? 1e9) - (y.daysInStage ?? 1e9)
	);

	return { rows: built, finished };
}

/**
 * Load, fit and render. Returns "" only when the applicant has no applications
 * at all — callers interpolate it blindly. A profile whose applications are all
 * finished gets the block with an empty table and the note saying so, because
 * "" there would read as "you have none".
 */
export async function applicationPipelineText(
	profileId: number,
	currentApplicationId: number | null,
	budgetChars: number = DEFAULT_PIPELINE_BUDGET_CHARS
): Promise<string> {
	try {
		const { rows: built, finished } = await loadPipelineRows(profileId, currentApplicationId);

		// Two caps in series, and their omissions add up: the hard row cap first,
		// then the char budget. Reporting only one would understate how partial
		// the picture is.
		const capped = built.slice(0, MAX_APPLICATIONS);
		const fitted = fitPipelineToBudget(capped, budgetChars, 'EUR', finished);
		return formatPipelineContext(fitted.rows, {
			omitted: built.length - capped.length + fitted.omitted,
			shed: fitted.shed,
			finished,
			currency: 'EUR'
		});
	} catch {
		// Context is a bonus, never a reason to fail the generation.
		return '';
	}
}
