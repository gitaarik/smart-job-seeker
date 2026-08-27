/**
 * Choosing what a job-tailored resume shows — the deterministic half.
 *
 * A tailored version is a SELECTION over the profile the applicant already
 * wrote, never new prose: it decides which bullets, projects and skills print
 * for one job. That constraint is the point. A selection cannot invent
 * experience, it can be reviewed at a glance, and every decision can be
 * explained by the data that produced it.
 *
 * Three of the four layers in planning/TAILORED-VERSIONS.md live here, because
 * they are pure and therefore testable:
 *
 *   L0  hard rules — what must show, and what may never be dropped
 *   L2  fit to the page — length is the scarce resource, and the ONLY reason
 *       anything is removed. Relevance ranks what goes first; it does not
 *       decide how much goes, or a document with room to spare gets cut for
 *       nothing (see the trim pass)
 *   ordering — lead with the bullet this job cares about
 *
 * L1 (semantic relevance) arrives as a score per candidate, and L3 (the model)
 * only ever re-decides what this file short-listed; both live server-side.
 *
 * The rule that shapes the whole thing: only ACHIEVEMENTS and SIDE PROJECTS can
 * be dropped. Roles and education are not droppable — omitting a job
 * misrepresents a history rather than focusing it, and that is the line between
 * a tailored resume and a dishonest one. Enforcing it by leaving them out of
 * the droppable set is stronger than checking for it afterwards. Skills are
 * likewise never dropped here: a single skill name is thin evidence to rank on,
 * and the downside of quietly removing one outweighs the tidiness.
 */

import { OVERRIDE_ENTITIES, type OverrideAction } from '$lib/version-overrides';

/** Entities a selection may drop. Everything else can only be added. */
export const DROPPABLE_ENTITIES: string[] = [
	OVERRIDE_ENTITIES.achievement,
	OVERRIDE_ENTITIES.sideProject
];

export interface Candidate {
	/** An $lib/version-overrides entity type. */
	entityType: string;
	entityId: number;
	/** What it belongs to — a bullet's role, a skill's category. Null if free-standing. */
	parentId: number | null;
	/** Human label, shown in the review diff. Short by design. */
	label: string;
	/**
	 * What the item actually SAYS, for the ranker and the model. Falls back to
	 * the label when an item's label is already its content.
	 *
	 * A bullet's label carries its text and a skill category's lists the skills
	 * in it, so for those two the label has always been both. A side project's
	 * label is its NAME — and the name is the least informative thing about it.
	 * The consequence, measured on one real job: the model was handed the eight
	 * characters "LitState" and asked whether they fit a web-components role,
	 * answered "likely unrelated hobby project", and dropped the one item in the
	 * profile written for exactly that rendering model. "Monkful" — a Python
	 * REST API package — went the same way against a Python/FastAPI/NoSQL post.
	 *
	 * The applicant cannot fix that from their side. A project has no bullets to
	 * add; its summary IS the content, and the summary was the part nothing read.
	 */
	detail?: string;
	/** Rough printed length, the currency L2 spends. */
	chars: number;
	/** Whether the version this one is built on already prints it. */
	visible: boolean;
	/**
	 * Whether the thing it hangs off prints — the bullet's role, the skill's
	 * category. Including an item whose parent is filtered out changes nothing,
	 * because the parent is filtered first, so a decision about it would claim
	 * the document changed when it didn't. Absent means "no parent to worry
	 * about".
	 */
	parentVisible?: boolean;
	/**
	 * The entity type of that parent, so a decision can speak about IT — a role
	 * brought back needs an include row of its own, or the row for the bullet
	 * inside it is a claim about a document that will not print it.
	 */
	parentType?: string;
	/**
	 * Why the parent doesn't print, when it doesn't. One boolean could not tell
	 * these apart, and they are not the same statement:
	 *
	 * - `template` — "CV only" on a resume. The applicant said not on this
	 *   document.
	 * - `profile` — off every document (`!resume` + `!cv`).
	 * - `alternative` — a second write-up of a role that IS printing, held on
	 *   another version. Bringing it back would put the same job on the page
	 *   twice.
	 * - `version` — hidden only because its whitelist names a version this
	 *   document is not. That one is not a judgement about this document at all;
	 *   it says "show it on X", and a job-tailored version is as entitled to it
	 *   as X was.
	 */
	parentHeldBack?: 'template' | 'profile' | 'version' | 'alternative';
	/**
	 * Whether this item's OWN tags would print it once its parent printed.
	 *
	 * A hidden parent hides everything under it, so `visible` cannot answer
	 * "what does this role bring with it". Restoring a role prints these for
	 * free — the tags that hid them named the parent — so they have to enter the
	 * page budget with everything else rather than appearing after it is spent.
	 */
	visibleIfParentShown?: boolean;
	/**
	 * How far back this item sits, 0 for current work and 1 for as far back as
	 * this profile goes. Absent means unknown, which is treated as current:
	 * missing dates are not evidence of age.
	 *
	 * Scaled by the applicant's own history rather than in years, and capped by
	 * years as well — see ageScale in tailor-version.ts. Both have to agree that
	 * something is old before it counts as old, so a three-year career does not
	 * have its first job treated as ancient and a forty-year one does not have
	 * everything before last decade written off.
	 */
	age?: number;
	/**
	 * Whether the applicant has held it off documents entirely — the `!resume`
	 * plus `!cv` pair. The most emphatic thing the tag vocabulary can say, and
	 * graded accordingly: still not a veto, because a job can be about exactly
	 * the thing somebody keeps for interviews.
	 */
	profileOnly?: boolean;
	/**
	 * Whether a base-template tag holds it off this document — "CV only, not on
	 * my resume" — rather than a version tag.
	 *
	 * Not a veto. That tag usually means "too much detail for a short document",
	 * which is a judgement about focus, and focus is precisely what a targeted
	 * resume revisits: an item that outranks half of what this one prints has
	 * earned the space, and something weaker loses it to the page budget. It is
	 * carried so the decision can SAY where the item came from, because that is
	 * the one a reader will want to check.
	 */
	templateHeldBack?: boolean;
	/**
	 * Must appear: a skill this job requires that the applicant has. Pinned
	 * candidates are included whatever their relevance score says.
	 */
	pinned: boolean;
	/**
	 * Required skills this item NAMES — directly, or through the skill graph.
	 *
	 * Pinning answers "is this skill on the page". Nothing answered "is the
	 * EVIDENCE for it on the page", so a bullet reading *"Scaled the platform to
	 * thousands of orders per minute by optimizing SQL & Python"* was trimmed off
	 * a resume for a job whose required list contains both SQL and Python, by
	 * name. It lost on cosine to lines that read more like the posting — which is
	 * exactly what cosine is for, and exactly what it cannot see past.
	 *
	 * Empty for most items and unset when there is no job to compare against.
	 */
	covers?: string[];
	/** L1 relevance to this job. Comparable within one run, not across runs. */
	score: number;
	/**
	 * Where a pinned candidate should land among its siblings, when appending it
	 * would read wrong: a skill surfaced for this job belongs beside the ones it
	 * relates to, not tacked onto the end of the category. An index in the list
	 * the document already shows — see orderByOverrides. Null appends.
	 */
	anchor?: number | null;
	/**
	 * A skill the document already prints that carries this one's name as a
	 * whole word. Metadata for the reason line, not an input to any rule: the
	 * decision still stands, it just gets to say the case against itself.
	 */
	carriedBy?: string | null;
}

export interface Decision {
	entityType: string;
	entityId: number;
	action: OverrideAction;
	/** Per-version order; null leaves the item's own global sort alone. */
	sort: number | null;
	/** Why — carried into the sidecar and shown to the applicant. */
	reason: string;
}

export interface SelectionOptions {
	/**
	 * Relevance below which a droppable candidate is a candidate for dropping.
	 * Scale depends on the ranker (cosine vs lexical overlap), so the caller —
	 * which knows which ran — supplies it.
	 */
	floor: number;
	/** Bullets a role keeps no matter what. A role with none reads as padding. */
	minPerParent: number;
	/** Rough character budget for the printed document. */
	budgetChars: number;
	/** Name of the skill or theme that pinned a candidate, for the reason line. */
	pinnedReason?: (candidate: Candidate) => string;
	/** Why a hidden item was surfaced — see surfaceBar. */
	surfacedReason?: (candidate: Candidate) => string;
	/** Why a skill group was dropped whole. */
	groupDropReason?: (candidate: Candidate) => string;
	/** Why a hidden parent was brought back, given the item that earned it. */
	restoredParentReason?: (child: Candidate) => string;
	/**
	 * How much better a promoted item must be than the one it displaces. Scale
	 * depends on the ranker, so the caller — which knows which ran — supplies it,
	 * exactly as it does for `floor`. See PROMOTION_MARGIN.
	 */
	promotionMargin: number;
}

/**
 * What one and two A4 pages of the default template hold, measured rather than
 * guessed: rendered and stripped until the PDF changed page count.
 *
 * One page is 7 bullets (824 chars) plus one side project (332), with two skill
 * groups, education and the header taking the rest — and the skills block is
 * expensive per GROUP rather than per skill, since four groups cut to a single
 * skill each still ran to two pages. Re-measure with a browser if the
 * template's spacing changes.
 */
export const PAGE_BUDGETS = { one: 1156, two: 3400 };

/**
 * How far over a page target the content may sit and still be aimed at it.
 *
 * Generous, because missing is cheap now: the fit pass renders the result, and
 * a target it cannot reach falls back to the roomier one and selects again for
 * that. So an optimistic aim costs a few seconds of rendering rather than a
 * gutted document, and the renderer settles what a character count only ever
 * guessed at.
 *
 * Twice over is still a refusal, and a deliberate one: this profile carries
 * 3,502 characters of prose, and one page would have meant dropping two thirds
 * of it — the answer its owner gave when asked was that one page is not worth
 * that. Past this the aim is two pages and the trim only has to fit them.
 */
const BUDGET_SLACK = 2;

/**
 * How many times to re-select and re-render when a document overshoots its page
 * target, and how hard to tighten each time.
 *
 * Each attempt costs a browser render, so this is a budget in seconds as much
 * as in characters. Three is enough to cross a page boundary from either side
 * without turning a click into a minute.
 */
export const FIT_ATTEMPTS = 3;

/**
 * How many times to walk BACK UP once a document fits.
 *
 * `tightenBudget` overshoots on purpose, so the first budget that fits is
 * usually far below the largest one that would have. Only "does it fit?" was
 * ever asked, and a document that fits with two-fifths of its last page blank
 * answers that question and still fails the applicant.
 *
 * Measured on one tailored version: the tighten pass landed on two pages with
 * 32 rendered lines on page two, where a full page holds 53. Thirteen
 * achievements had been dropped to buy whitespace.
 *
 * Same cost model as FIT_ATTEMPTS — one render each — and it only runs when the
 * tighten pass actually cut something, so the common case pays nothing.
 *
 * Three, measured rather than reasoned: on that version it took page two from
 * 32 rendered lines to 41 and its achievements from 11 to 14, and raising it to
 * five changed neither number. The bracket converges inside three here, so the
 * extra renders bought nothing.
 *
 * It does NOT reach a full page, and the remaining gap is not attempts. The
 * budget maps onto the selection as a step function — the next budget that
 * restores anything restores a group — so bisecting it cannot land between two
 * steps. Closing that needs a different pass: restore from the ranked tail one
 * item at a time until the render refuses. Not built.
 */
export const LOOSEN_ATTEMPTS = 3;

/**
 * When to stop bisecting, in characters.
 *
 * Roughly one bullet. Below this the search is refining a number the renderer
 * cannot act on: the next item to restore is a whole line or it is nothing.
 */
export const LOOSEN_EPSILON = 120;

/**
 * How many single items the tail pass may try putting back, and how many
 * failures in a row end it.
 *
 * The budget cannot reach the last of a page. `selectForJob` re-runs from
 * scratch at every budget, so a larger one can restore a whole ROLE — header,
 * dates, TECH list, every visibleIfParentShown child — which makes the smallest
 * increment a budget can buy a block rather than a line. Measured on one
 * tailored version: the largest budget that fits and the smallest that does not
 * are one bullet's worth of characters apart, and between them page two goes
 * from 72% full to overflowing. Bisecting a number that moves in blocks cannot
 * land between two of them.
 *
 * So this works on the finished selection instead, one item at a time, which is
 * the grain of what is actually left over. Six renders is the ceiling; two
 * misses in a row is the practical end, because the list is ordered by value and
 * what follows two failures is smaller in every sense.
 */
export const TAIL_RESTORE_ATTEMPTS = 6;
export const TAIL_RESTORE_MISSES = 2;

/**
 * The next budget to try when the document came out too long.
 *
 * Aggressive on purpose. Halving the prose does not halve the pages — the
 * template's fixed height goes nowhere — so scaling by the page ratio
 * undershoots every time and wastes an attempt.
 */
export function tightenBudget(budget: number, pages: number, targetPages: number): number {
	const ratio = targetPages / Math.max(pages, targetPages + 1);
	return Math.max(1, Math.round(budget * ratio * 0.8));
}

/**
 * The smallest page target this document is already close to.
 *
 * One page is right for someone whose material nearly fits it and wrong for
 * someone with fifteen years of it, so it is a property of the profile before
 * it is a preference. Falls back to the largest target, which trims to fit
 * rather than promising anything.
 *
 * It is a guess, and it errs towards two pages on purpose, because the thing
 * that actually decides the page count is invisible from here: the fixed height
 * of the template around the prose — role headers, the skills block, education.
 * Checked against every profile on this instance, it sends three to one page
 * and the rest to two. One of the three cannot reach one page at any budget
 * (its two pages are all shell, with nothing removable), where the effect is
 * nil rather than wrong; another needed to lose 55% of its prose to fit, which
 * is what the slack exists to refuse.
 *
 * Knowing rather than guessing means rendering and counting pages, which needs
 * a browser and a fitting loop.
 */
export function chooseBudget(candidates: Candidate[], budgets = PAGE_BUDGETS): number {
	const printed = candidates
		.filter((c) => (c.visible || c.pinned) && isDroppable(c))
		.reduce((sum, c) => sum + c.chars, 0);
	const targets = Object.values(budgets).sort((a, z) => a - z);
	return targets.find((target) => printed <= target * BUDGET_SLACK) ?? targets[targets.length - 1];
}

export const DEFAULT_SELECTION: Pick<SelectionOptions, 'minPerParent' | 'budgetChars'> = {
	minPerParent: 2,
	// The two-page target, and the default for anyone calling selectForJob
	// directly. The tailoring picks between the two with chooseBudget.
	budgetChars: PAGE_BUDGETS.two
};

/**
 * How many items may be promoted within one group — two for a short role, more
 * for a long one, never more than four.
 *
 * A flat two was the whole answer while the cap's job was keeping the diff
 * reviewable. It reads differently against a role with eleven printed bullets:
 * the third most relevant thing this applicant did there still lands fifth, and
 * a reader who stops after the first few lines never reaches it. Scaling with
 * the group keeps the same promise — a handful of rows, not a re-sort — at the
 * size where a handful means something.
 */
export function promotionsFor(siblings: number): number {
	return Math.min(2 + Math.floor(siblings / 6), 4);
}

/**
 * How much better a promoted item must be than the one it displaces.
 *
 * Scaled per ranker, like the floor, because the two live on different numbers.
 *
 * - **semantic** — unrelated text sits near 0.4, the floor is 0.50, and the
 *   median of what a resume shows measured 0.53-0.58 on real jobs, so the whole
 *   meaningful range is a few hundredths wide and 0.02 is a real part of it.
 *   Below that the bullets of one role are indistinguishable: they describe the
 *   same job, so they embed close together, and sorting on the difference is
 *   sorting on noise.
 * - **lexical** — the fallback scores two points per matched word (title tokens
 *   double, body tokens deduped against them), so a margin of 2 says "at least
 *   one more word in common with this job" — the smallest difference that
 *   exists at all.
 */
export const PROMOTION_MARGIN = { semantic: 0.02, lexical: 2 } as const;

/**
 * There is no cap on how many hidden items a version may surface.
 *
 * There was one, of three, on the reasoning that needing more meant the base
 * was the wrong version for this job. That reasoning assumed a base is a
 * content boundary. It is not the useful thing about one: version tags say
 * "this is my Django resume", which is an answer for a CLASS of jobs, and the
 * whole point of tailoring is that this job is not a class. The page budget is
 * the honest limit, and the surfacing bar is the honest quality gate.
 */

/**
 * Skill groups a document always keeps, however little the job wants them. A
 * skills section that empties out reads as a gap rather than as focus.
 *
 * A cap was tried here instead — keep the best two — to buy the page back. It
 * does shrink the section, but not enough to matter: see budgetChars.
 */
const MIN_SKILL_GROUPS = 2;

/**
 * The bar a hidden item must clear to be worth surfacing — and the same one the
 * warning about omitted evidence uses, deliberately: the page said this bullet
 * outranks half of what the document shows, so the generator had better act on
 * the same sentence rather than a neighbouring one.
 *
 * Relative, not absolute. An embedding floor tuned for retrieval says "somewhat
 * related to this job", which most of a career is. The question worth asking is
 * comparative — more relevant than the median of what already prints — which
 * calibrates per document and per job, and says nothing when the selection is
 * already sensible.
 */
export function surfaceBar(candidates: Candidate[], floor: number): number {
	const shown = candidates
		.filter((c) => c.visible && isDroppable(c))
		.map((c) => c.score)
		.sort((a, z) => a - z);
	return shown.length > 0 ? Math.max(floor, shown[Math.floor(shown.length / 2)]) : floor;
}

function isDroppable(candidate: Candidate): boolean {
	return DROPPABLE_ENTITIES.includes(candidate.entityType);
}

/**
 * How much relevance an item at the far end of a career loses when the question
 * is whether to overrule the applicant's own judgement about it.
 */
export const RECENCY_PENALTY = 0.35;

/**
 * What each kind of hold-back costs an item competing to be surfaced.
 *
 * The tag vocabulary makes three different statements and they deserve three
 * different answers:
 *
 * - A **version tag** says "this is my Django resume". That is an answer for a
 *   class of jobs, written before this job existed, and tailoring is the thing
 *   that gets to disagree with it. It costs nothing.
 * - **"CV only"** says "over-complete for a short document". That is a judgement
 *   about focus, and focus is what a targeted resume revisits — but the
 *   applicant meant it, so the item has to be clearly better than what it
 *   displaces.
 * - **Profile-only** says "off my documents". The strongest thing they can say
 *   short of deleting it, and priced accordingly.
 *
 * None of them is a veto. Every one of these items is on the page the moment a
 * job is actually about it, which is the whole reason to consider them at all.
 */
export const HOLD_BACK_PENALTY = { template: 0.25, profile: 0.5 } as const;

/**
 * Age below which nothing is discounted at all, and from which the penalty
 * ramps up rather than starting at zero.
 *
 * The complaint this answers is about work from fifteen years ago, not from
 * last year, and a rule that shaves something off everything not written this
 * morning would be a different rule. It also keeps the discount away from the
 * lexical fallback's coarse scores: those come out as small integers, so the
 * bar routinely lands exactly on one, and a 3% discount on a two-year-old role
 * would be the whole decision. Measured on a real profile, a role that ended
 * last year scored 0.07 and was flipping items out at the bar.
 */
export const RECENCY_GRACE = 0.35;

/**
 * Past this, a whole role is history rather than news, and the applicant's
 * decision to keep it off a document stands unexamined.
 *
 * Age DISCOUNTS an item (D9, D10) — never vetoes one, because a job can be about
 * exactly the old thing. A container is the case that argues the other way. "My
 * resume covers the last decade" is a judgement about an era, not about one job,
 * and re-opening it per application is the opposite of what a per-job feature is
 * for. Measured against this profile: two roles that ended in 2011 and 2013,
 * named for bullets like "promoted to mid-level developer" scoring against a
 * Lead Software Engineer post on word overlap alone.
 *
 * 0.5 is half the applicant's own career, capped by OLD_YEARS in absolute terms
 * — the same two-measures-must-agree scale everything else here uses.
 */
export const OLD_ENOUGH_TO_LEAVE_ALONE = 0.5;

/**
 * Relevance as the surfacing decision reads it: discounted by age.
 *
 * Deliberately not applied to ranking or to trimming. An applicant who tagged
 * a role "CV only" because it is fifteen years old has already said what they
 * think, and this feature's licence to overrule that comes from the item being
 * unusually relevant — so age raises the bar for overruling rather than
 * demoting the work itself. Discounting the score everywhere would push a
 * genuinely relevant old bullet off a role the document DOES show, which is a
 * worse error than the one this fixes, and would reshuffle documents that are
 * currently right.
 *
 * Never a veto: a directly relevant old item still clears the bar, which is the
 * whole intent — old work does belong on a resume when it is what the job is
 * about.
 */
export function surfaceScore(candidate: Candidate, floor = 0): number {
	const age = candidate.age ?? 0;
	const aged =
		age <= RECENCY_GRACE ? 0 : RECENCY_PENALTY * ((age - RECENCY_GRACE) / (1 - RECENCY_GRACE));
	const held = candidate.profileOnly
		? HOLD_BACK_PENALTY.profile
		: candidate.templateHeldBack
			? HOLD_BACK_PENALTY.template
			: 0;

	// Charged against the MARGIN above the floor, not against the whole score.
	//
	// A cosine similarity does not start at zero — unrelated text sits around
	// 0.4, the floor is 0.50, and the median of what a resume shows measured
	// 0.53-0.58 on real jobs. So the entire meaningful range is a few hundredths
	// wide, and taking a quarter off the score takes an item to 0.435: below the
	// floor, below anything, a veto in all but name. Taking a quarter off what
	// it has EARNED above the floor is the same statement at the right scale,
	// and it works for the lexical fallback's small integers too.
	//
	// This is the shape, not the strength. Both were multiplicative first, and
	// both looked sane because they were measured against the lexical fallback,
	// where a floor of 1 and scores of 2 to 6 hide the difference.
	// Below the floor there is nothing earned to charge against, and returning
	// `floor` would RAISE it — enough to clear a bar that sits exactly on the
	// floor, which is what an empty document's bar does. Left alone instead.
	if (candidate.score <= floor) return candidate.score;
	return floor + (candidate.score - floor) * (1 - aged) * (1 - held);
}

/**
 * Whether a hidden item could be shown at all — the eligibility half of
 * surfacing, with the score left out.
 *
 * Shared with the warning about omitted evidence, which is the point. The two
 * already agreed on the bar and disagreed on this: the warning listed anything
 * hidden, so a bullet on a role tagged off the resume entirely was reported as
 * evidence the document leaves out. Its role is filtered before its bullets
 * are, so showing it was never possible — on a tailored version the "Put it
 * back" button beside it wrote an override that changed nothing. Three of the
 * four items warned about on one real resume were that.
 *
 * Absent `parentVisible` means "nothing above it to worry about", so only an
 * explicit false disqualifies.
 */
export function canSurface(candidate: Candidate): boolean {
	return (
		!candidate.visible &&
		!candidate.pinned &&
		isDroppable(candidate) &&
		candidate.parentVisible !== false
	);
}

/**
 * Whether the GENERATOR could show it — a wider question than canSurface, and
 * deliberately a different function.
 *
 * The two differ on one case: an item whose parent is hidden only because a
 * whitelist names another version. A one-click include cannot show it, because
 * an override on the item alone changes nothing while its parent is filtered
 * out first — which is why the warning strip still asks canSurface. A tailoring
 * RUN can, because it writes the parent's include in the same pass, so for it
 * the tag means what it says: "show this on X", not "keep it off everything
 * else".
 *
 * The three other reasons a parent can be hidden stay out. "CV only" and
 * profile-only are the applicant saying not on this document, and a whole role
 * is the shape of a history rather than its emphasis — that one is offered in
 * words instead, next to a button that turns it on. An alternative write-up
 * would put the same job on the page twice.
 */
export function canBringBack(candidate: Candidate): boolean {
	return (
		!candidate.visible &&
		!candidate.pinned &&
		isDroppable(candidate) &&
		(candidate.parentVisible !== false || candidate.parentHeldBack === 'version')
	);
}

/**
 * Whether an item is past even a run's reach, and its container therefore worth
 * naming to the applicant.
 *
 * The third member of the canSurface / canBringBack family, and the strictest,
 * because it is the one that argues with a decision rather than filling a gap:
 * "you keep this role off this document, and it holds work this job asks
 * about". Three things it insists on that surfacing does not —
 *
 * - the hold must be the applicant's own (`template`/`profile`); a container
 *   hidden by a version tag is reachable and gets brought back, not reported;
 * - `bar`, the median of what the document prints, not the floor. The floor
 *   means "somewhat about this job", which most of a career is, and this claim
 *   cannot ask for less evidence than surfacing a single bullet does;
 * - age vetoes. Everywhere else age is a discount (D9), because a job can be
 *   about exactly the old thing. A role is the exception: which era a resume
 *   covers is one judgement, not a per-job one.
 */
export function beyondReach(candidate: Candidate, floor: number, bar: number): boolean {
	if (candidate.visible || canBringBack(candidate)) return false;
	if (candidate.parentHeldBack !== 'template' && candidate.parentHeldBack !== 'profile') {
		return false;
	}
	if ((candidate.age ?? 0) >= OLD_ENOUGH_TO_LEAVE_ALONE) return false;
	return surfaceScore(candidate, floor) >= bar;
}

/**
 * Decide what this job's version shows, as a list of changes against what the
 * base version already prints.
 *
 * Only differences are returned: an item the base version shows and this one
 * keeps produces no row, so the sidecar stays a diff rather than a copy of the
 * profile. Ordering rows are emitted only when the relevance order actually
 * differs from the order the applicant already has.
 */
export function selectForJob(candidates: Candidate[], options: SelectionOptions): Decision[] {
	const { floor, minPerParent, budgetChars, promotionMargin } = options;
	const decisions: Decision[] = [];
	// Entity ids are per table, so the type has to be part of the key: bullet 12
	// and side project 12 both exist.
	const dropKey = (c: Candidate) => `${c.entityType}:${c.entityId}`;

	// ── L0: what must show ──
	for (const candidate of candidates) {
		if (!candidate.pinned || candidate.visible) continue;
		decisions.push({
			entityType: candidate.entityType,
			entityId: candidate.entityId,
			action: 'include',
			sort: candidate.anchor ?? null,
			reason: options.pinnedReason?.(candidate) ?? 'required by this job'
		});
	}

	// ── L0b: everything eligible enters, and the page decides ──
	//
	// Whether the base version prints an item used to be worth an INFINITE
	// bonus: what it showed printed unconditionally, what it hid had to beat the
	// median of what it showed. And that median came from the base too, so a
	// narrower base raised its own bar and locked more out. Measured on one job,
	// the finished document ranged from 33 items to 37 depending only on which
	// version it started from — four bullets and side projects that a generic
	// version's whitelist removed from a document tailored to one job.
	//
	// So the base stops deciding content. Everything eligible enters here, ranks
	// by relevance priced for what its tags claim and how long ago it was (see
	// surfaceScore), and the page budget takes back what does not fit. The base
	// still supplies the diff, the ordering, and the answer when two items are
	// alternatives — the things it is actually good for.
	//
	// One thing is still gated by tags alone: a whole ROLE. Adding one changes
	// the shape of a history rather than its emphasis, and "my resume covers the
	// last ten years" is not a per-job judgement. A bullet on a role this
	// document omits stays out — canSurface enforces that, and the item panel is
	// where a role gets turned on by hand.
	// The one threshold left, and it comes from the embedding model rather than
	// from the base: genuinely related to THIS job. It replaces a median that a
	// narrow base pushed upward, locking out items at 0.55 against a floor of
	// 0.50 — which is how a generic version's whitelist was still removing four
	// items from a document tailored to one job.
	//
	// It gates additions only. What the base already prints keeps printing until
	// the page says otherwise, because a below-floor bullet on your own resume
	// is your judgement about your own history, and making relevance a second
	// reason to drop is how a role ends up showing two lines.
	const surfaced = new Set<string>();
	for (const candidate of candidates.filter(
		(c) => canBringBack(c) && surfaceScore(c, floor) >= floor
	)) {
		surfaced.add(dropKey(candidate));
	}

	// ── The parent comes back with it ──
	//
	// An include on a bullet whose role is filtered out is a row that changes
	// nothing: the filter meets the role first and never asks about the bullet.
	// That is why surfacing refused those items outright for a long time — the
	// only alternative was to lie in the diff.
	//
	// It refuses fewer now, because a RUN can write both rows at once (see
	// canBringBack), and one of the four reasons a role can be hidden is not a
	// statement about this document: a whitelist naming another version. So the
	// role is restored, and what it holds enters the page budget like anything
	// else — including the siblings that print for free once it does, or the
	// budget would be spent on a document smaller than the one that renders.
	const restored = new Map<number, Candidate>();
	for (const candidate of candidates) {
		if (!surfaced.has(dropKey(candidate)) || candidate.parentId === null) continue;
		if (candidate.parentVisible !== false) continue;
		if (!restored.has(candidate.parentId)) restored.set(candidate.parentId, candidate);
	}
	const ridesAlong = new Set(
		candidates
			.filter(
				(c) =>
					c.parentId !== null &&
					restored.has(c.parentId) &&
					c.visibleIfParentShown === true &&
					!surfaced.has(dropKey(c))
			)
			.map(dropKey)
	);

	// Everything the document would print once L0 has had its say.
	const kept = candidates.filter(
		(c) => c.visible || c.pinned || surfaced.has(dropKey(c)) || ridesAlong.has(dropKey(c))
	);
	const droppable = kept.filter(isDroppable);

	// How many droppable siblings each parent has, so a role cannot be emptied.
	const keptPerParent = new Map<number | null, number>();
	for (const candidate of droppable) {
		keptPerParent.set(candidate.parentId, (keptPerParent.get(candidate.parentId) ?? 0) + 1);
	}

	const dropped = new Set<string>();

	function canDrop(candidate: Candidate): boolean {
		// Surfaced items are NOT exempt. They were, back when at most three of them
		// existed; uncapped, exempting them would have the page eaten by additions
		// while the curated lines they displace get trimmed to make room — the
		// document gutted to fit its own extras. They compete like everything
		// else, and one that loses simply never gets an include row.
		if (candidate.pinned) return false;
		const siblings = keptPerParent.get(candidate.parentId) ?? 0;
		// A free-standing group (side projects share a null parent) keeps one, so
		// the section does not silently disappear; a role keeps minPerParent.
		const floorForParent = candidate.parentId === null ? 1 : minPerParent;
		return siblings > floorForParent;
	}

	function drop(candidate: Candidate, reason: string) {
		dropped.add(dropKey(candidate));
		keptPerParent.set(candidate.parentId, (keptPerParent.get(candidate.parentId) ?? 1) - 1);
		// An item the base version doesn't print needs no exclusion row — it is
		// already absent, and a row saying so would be noise in the diff. A
		// ride-along is the exception: its role is being restored, so it WILL
		// print unless this says otherwise.
		if (!candidate.visible && !ridesAlong.has(dropKey(candidate))) return;
		decisions.push({
			entityType: candidate.entityType,
			entityId: candidate.entityId,
			action: 'exclude',
			sort: null,
			reason
		});
	}

	// ── Skills: drop a group this job has no use for ──
	//
	// The one part of a tailored document that used to be identical on every
	// version. Not a space decision — the group costs a line either way (its
	// chars are zero, see buildCandidates) — but a dilution one: the skills
	// block is read as a keyword list, and a data role listing Vue and Shopify
	// among fifty-nine entries is asking the reader to do the filtering.
	//
	// Absolute rather than comparative, unlike the prose trim: "this job asks
	// for none of these" is a statement about the job, not about how full the
	// page is. A group holding a required skill — printed OR about to be
	// surfaced — is pinned and never reaches here, because the filter meets the
	// category before the skills in it and dropping one would take the required
	// skill with it. The section keeps a floor so it cannot vanish.
	const groups = candidates.filter((c) => c.entityType === OVERRIDE_ENTITIES.skillCategory);
	let groupsLeft = groups.length;
	for (const group of [...groups].sort((a, z) => a.score - z.score)) {
		if (groupsLeft <= MIN_SKILL_GROUPS) break;
		if (group.pinned || group.score >= floor) continue;
		groupsLeft -= 1;
		decisions.push({
			entityType: group.entityType,
			entityId: group.entityId,
			action: 'exclude',
			sort: null,
			reason:
				options.groupDropReason?.(group) ?? 'this job asks for none of the skills in this group'
		});
	}

	// ── L1 + L2: trim the least relevant until the document fits ──
	//
	// Relevance decides the ORDER; the page decides how much. These used to be
	// two passes, and the first one dropped everything under an absolute
	// relevance floor whether or not the document needed the room. That floor is
	// a retrieval threshold — it answers "somewhat about this job", not "worth a
	// line" — and the model sinks a score under it to vote drop, so between them
	// they cut a 26-item document to 8: a quarter of a page, every role sitting
	// on the sibling minimum, which exists to stop a role being emptied and is
	// not a target. Nothing was gained by the space.
	//
	// So budgetChars is now the whole control rather than a backstop that rarely
	// bound. A document that fits keeps what it has, and tailoring it is a matter
	// of what leads and which held-back skills to surface; a document that does
	// not fit loses its weakest lines first, which is the judgement the ranker
	// and the model are actually good for.
	const printedChars = () =>
		kept.filter((c) => !dropped.has(dropKey(c))).reduce((sum, c) => sum + c.chars, 0);
	const trimReason = (c: Candidate) =>
		c.covers?.length
			? `trimmed to fit the page — the last line naming ${c.covers.join(' and ')}, and nothing cheaper was left`
			: c.score < floor
				? `the least relevant thing on a full page, and off-topic for this job (${c.score.toFixed(2)})`
				: `trimmed to fit the page — the least relevant line left (${c.score.toFixed(2)})`;

	// Worst first, and between two the job values equally, the older one — the
	// only place age touches what a document already shows, and only as a
	// tiebreak, so relevance still ranks and the page budget still decides.
	const worstFirst = [...droppable].sort(
		(a, z) => surfaceScore(a, floor) - surfaceScore(z, floor) || (z.age ?? 0) - (a.age ?? 0)
	);

	/**
	 * Whether something ELSE still on the page names everything this item names.
	 *
	 * The guarantee is "don't drop the last line naming a skill the job asked
	 * for", not "keep anything that mentions one". The difference is the whole
	 * design: on one real job, 40 of 66 candidates named a required skill —
	 * because `Python`, `SQL`, `APIs`, `JSON` and `Git` are on the required list
	 * and on half a twenty-year career — so protecting all of them protects
	 * nothing and just re-sorts the same trim. Protecting the LAST one is
	 * self-limiting: once a requirement has a line of evidence, further lines
	 * naming it get nothing.
	 */
	const coveredElsewhere = (c: Candidate) =>
		!c.covers?.length ||
		c.covers.every((req) =>
			kept.some((k) => k !== c && !dropped.has(dropKey(k)) && k.covers?.includes(req))
		);

	const lastEvidence: Candidate[] = [];
	for (const candidate of worstFirst) {
		if (printedChars() <= budgetChars) break;
		if (!canDrop(candidate)) continue;
		if (!coveredElsewhere(candidate)) {
			lastEvidence.push(candidate);
			continue;
		}
		drop(candidate, trimReason(candidate));
	}

	// The page wins in the end. A guarantee that could overflow the document
	// would just move the failure somewhere the applicant cannot see it, so once
	// everything else is gone these go too — worst first, saying what is being
	// given up.
	for (const candidate of lastEvidence) {
		if (printedChars() <= budgetChars) break;
		drop(candidate, trimReason(candidate));
	}

	// Same for a restored parent: written only if something under it survived the
	// trim, and before the item rows so the diff reads top-down.
	for (const [parentId, justifier] of restored) {
		if (!justifier.parentType) continue;
		const printsSomething = kept.some((c) => c.parentId === parentId && !dropped.has(dropKey(c)));
		if (!printsSomething) continue;
		decisions.push({
			entityType: justifier.parentType,
			entityId: parentId,
			action: 'include',
			sort: null,
			reason:
				options.restoredParentReason?.(justifier) ??
				'shown for this job — it holds work this job asks about, and a bullet cannot print without it'
		});
	}

	// The include rows for what was surfaced, written only now that the page has
	// had its say: an item surfaced and then trimmed never reached the document,
	// and a row announcing it was added would be a claim the applicant can check
	// and find false.
	for (const candidate of candidates) {
		const key = dropKey(candidate);
		if (!surfaced.has(key) || dropped.has(key)) continue;
		decisions.push({
			entityType: candidate.entityType,
			entityId: candidate.entityId,
			action: 'include',
			sort: null,
			reason: options.surfacedReason?.(candidate) ?? 'earned its place on the page for this job'
		});
	}

	// ── Ordering: lead with what this job cares about ──
	//
	// PROMOTION, not re-sorting. Ranking every bullet of a role by relevance
	// overrides an order the applicant chose deliberately, on score differences
	// that are often noise — and it writes a row per bullet, turning a reviewable
	// diff into a wall. Moving the one or two that genuinely speak to this job to
	// the front says the same thing in two rows, and the rest keep their order
	// for free: orderByOverrides leaves items without a sort behind the ones that
	// have it, in their original sequence.
	// Surfaced items sit out the promotion. Being added is already the strongest
	// thing this run can say about one, and a sort on top would file it in the
	// diff under "moved up" — a claim about an item that was not there to move.
	const survivors = kept.filter(
		(c) => isDroppable(c) && !dropped.has(dropKey(c)) && !surfaced.has(dropKey(c))
	);
	const byParent = new Map<number | null, Candidate[]>();
	for (const candidate of survivors) {
		const list = byParent.get(candidate.parentId) ?? [];
		list.push(candidate);
		byParent.set(candidate.parentId, list);
	}
	for (const [, siblings] of byParent) {
		if (siblings.length < 2) continue;
		// Only genuinely relevant items are worth promoting; below the floor the
		// ordering would be reshuffling on noise.
		const leaders = [...siblings]
			.sort((a, z) => z.score - a.score)
			.slice(0, promotionsFor(siblings.length))
			.filter((c) => c.score >= floor);

		// Who each leader actually displaces — the first sibling not already at the
		// front, not `siblings[index]`. The two differ the moment anything moves:
		// promoting the third bullet to the top pushes the first down to position
		// one, so measuring the second promotion against the original occupant of
		// that slot compares it to an item that has already left.
		const placed: Candidate[] = [];
		for (const [index, candidate] of leaders.entries()) {
			const incumbent = siblings.find((s) => !placed.some((p) => dropKey(p) === dropKey(s)));
			if (!incumbent) break;
			// Already where relevance would put it: no row, but it holds the slot,
			// and the item behind it may still have something to say.
			if (dropKey(incumbent) === dropKey(candidate)) {
				placed.push(candidate);
				continue;
			}
			// A move has to be worth the row it writes. The cap keeps the diff
			// short; this keeps it TRUE — without it a bullet beating the one you
			// put first by a thousandth is announced as "the most relevant thing
			// you have for this job", which is a claim about a difference nobody
			// could see. Below the margin the applicant's order stands, and the
			// rest of this group stops here: the positions behind an unmoved item
			// are the applicant's answer too.
			if (candidate.score - incumbent.score < promotionMargin) break;
			placed.push(candidate);

			const existing = decisions.find(
				(d) => d.entityType === candidate.entityType && d.entityId === candidate.entityId
			);
			if (existing) {
				existing.sort = index;
				continue;
			}
			decisions.push({
				entityType: candidate.entityType,
				entityId: candidate.entityId,
				action: 'include',
				sort: index,
				reason:
					index === 0
						? 'the most relevant thing you have for this job — moved to the top'
						: 'also speaks to this job — moved up'
			});
		}
	}

	return decisions;
}

/**
 * One item as the editing panel reads it: what it is, whether the document
 * prints it, and who decided that.
 *
 * The diff answers "what did tailoring change"; these answer "what is on it",
 * which is what you need to change something tailoring never decided about.
 */
export interface ItemRow {
	entityType: string;
	entityId: number;
	label: string;
	/** Whether this document prints it. */
	on: boolean;
	/** Why it is in that state, in terms the applicant can act on. */
	reason: string;
	/** Who put it there: the version's own tags, this feature, or the applicant. */
	source: 'base' | 'tailoring' | 'user';
	/** Relevance to this job, or null when nothing scored it. */
	score: number | null;
}

export interface ItemGroup {
	/** Stable key for the UI, and the parent this group's rows hang off. */
	key: string;
	entityType: string | null;
	entityId: number | null;
	title: string;
	/** Dates, for a role. */
	subtitle: string | null;
	/** Whether the section itself prints. A section that doesn't takes its rows with it. */
	on: boolean;
	rows: ItemRow[];
}
