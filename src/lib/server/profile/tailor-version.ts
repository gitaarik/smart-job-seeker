/**
 * Building the version tailored to one job.
 *
 * The layering, and why it is in this order (planning/TAILORED-VERSIONS.md):
 *
 *   L1  every candidate scored against the job — semantic when embeddings are
 *       configured, lexical overlap when they are not. Cached per content hash,
 *       so the cost is one embedding per item per EDIT, not per application.
 *   L0  hard rules and L2 page budget — $lib/tailoring, pure and tested.
 *   L3  the model, last and smallest: it sees a shortlist of one-line summaries,
 *       never the profile, and cannot introduce an item or write a word of
 *       prose. Its opinions are fed back through the SAME deterministic
 *       selector as an adjusted score, so no answer it can give — including a
 *       malformed or adversarial one — can violate a hard rule.
 *
 * Everything degrades: no embeddings falls back to lexical, no model (or a
 * failed call) leaves the deterministic selection standing, and no job_matches
 * row still leaves the job's own spec to rank against.
 */

import { and, asc, eq, inArray, isNull, sql, type SQL } from 'drizzle-orm';
import { dbDirect as db, queryRaw } from '$lib/server/db';
import {
	applications,
	job_matches,
	profile_version_extensions,
	profile_version_overrides,
	profile_versions,
	profiles,
	side_projects,
	tech_skill_categories,
	tech_skills,
	work_experience_achievements,
	work_experiences
} from '$lib/server/db/schema';
import { getProfileByIdentifier } from '$lib/server/profile/default';
import { createProfileFilter } from '$lib/components/ProfileDisplay/profile-filter';
import { isTailoredSlug, OVERRIDE_ENTITIES, tailoredSlugFor } from '$lib/version-overrides';
import {
	chooseBudget,
	DEFAULT_SELECTION,
	DROPPABLE_ENTITIES,
	FIT_ATTEMPTS,
	PAGE_BUDGETS,
	selectForJob,
	surfaceBar,
	tightenBudget,
	type Candidate,
	type Decision
} from '$lib/tailoring';
import { carrierOf, carriesName, hiddenSkillsKey } from '$lib/version-coverage';
import {
	BASE_TEMPLATE_TAGS,
	heldBackByTemplate,
	renameTagSlug,
	tagSlug
} from '$lib/profile-visibility';
import {
	semanticScoreUnits,
	poolKey,
	type ContentUnit
} from '$lib/server/documents/content-embeddings';
import { scoreUnitAgainstQuery } from '$lib/server/documents/content-retrieval';
import { countVersionPages } from '$lib/server/profile/page-fit';
import { createAndGenerateAiChat } from '$lib/server/ai-chat/utils';
import { config } from '$lib/server/config';

/** Lexical scores are small integers; cosine scores sit in 0..1. */
const LEXICAL_FLOOR = 1;

/** How many shortlist lines the model is shown. Beyond this it is noise. */
const SHORTLIST_LIMIT = 40;

export interface TailorResult {
	versionId: number;
	versionSlug: string;
	versionName: string;
	decisions: Decision[];
	/** Which ranker produced the scores — surfaced so the diff can say so. */
	ranker: 'semantic' | 'lexical';
	/** Whether the model reviewed the shortlist, or the run stayed deterministic. */
	modelReviewed: boolean;
	/** Pages this document was aimed at — see chooseBudget. */
	targetPages: number;
	/** Pages it actually renders to, or null when the renderer couldn't answer. */
	pages: number | null;
}

type ProfileRow = NonNullable<Awaited<ReturnType<typeof getProfileByIdentifier>>>;

function text(value: unknown): string {
	return typeof value === 'string' ? value.trim() : '';
}

function asStringArray(value: unknown): string[] {
	return Array.isArray(value) ? value.filter((v): v is string => typeof v === 'string') : [];
}

/**
 * Where to slot a surfaced skill among the ones its category already prints.
 *
 * A skill this job requires gets added at whatever position its own global sort
 * happens to give it, which for a recently-added one is the very end — "SQL"
 * arriving after MongoDB and Redis, three lines below the SQL cluster it
 * belongs to. Anyone reading it sees an afterthought, which is the opposite of
 * the point.
 *
 * Relatedness here is whole-word containment, not similarity: "SQL optimization"
 * contains the word, "MySQL" does not. That is a narrow test on purpose — it is
 * free, it never misfires, and it answers the case that actually arises, which
 * is an exact skill name being added next to the compounds built on it. A
 * relative sharing no words (Kubernetes beside Docker) needs an embedding to
 * find and gets no anchor; appending is the honest fallback.
 *
 * Returns the index AFTER the last relative, so the skill closes the run rather
 * than splitting it. Null when nothing in the category is related.
 */
function anchorAmongSiblings(name: string, siblings: string[]): number | null {
	let last = -1;
	siblings.forEach((sibling, i) => {
		if (carriesName(name, sibling)) last = i;
	});
	return last === -1 ? null : last + 1;
}

/**
 * Every item a tailored version may speak about, with what the BASE version
 * already prints marked as visible.
 *
 * Visibility is resolved by running the real document filter for the base
 * version rather than by re-deriving the tag rules here — the prediction and
 * the render have to agree, and the only way to guarantee that is to ask the
 * same function.
 */
export function buildCandidates(
	profile: ProfileRow,
	docType: string,
	baseSlug: string,
	requiredSkills: string[]
): Candidate[] {
	const { filterOnTags } = createProfileFilter(
		(profile.profile_versions ?? []) as never,
		docType,
		null,
		baseSlug
	);
	const required = new Set(requiredSkills.map((s) => s.trim().toLowerCase()).filter(Boolean));
	const candidates: Candidate[] = [];

	const visibleRoles = new Set(
		filterOnTags(profile.work_experiences ?? [], OVERRIDE_ENTITIES.workExperience).map((w) => w.id)
	);
	for (const role of profile.work_experiences ?? []) {
		const roleLabel = [role.position, role.name].filter(Boolean).join(' at ') || `role ${role.id}`;
		const visibleAchievements = new Set(
			filterOnTags(role.work_experience_achievements ?? [], OVERRIDE_ENTITIES.achievement).map(
				(a) => a.id
			)
		);
		for (const achievement of role.work_experience_achievements ?? []) {
			const body = text(achievement.description);
			if (!body) continue;
			candidates.push({
				entityType: OVERRIDE_ENTITIES.achievement,
				entityId: achievement.id,
				parentId: role.id,
				label: `${roleLabel}: ${body.slice(0, 80)}`,
				chars: body.length,
				// A bullet on a role the document doesn't print isn't printed either.
				visible: visibleRoles.has(role.id) && visibleAchievements.has(achievement.id),
				parentVisible: visibleRoles.has(role.id),
				templateHeldBack: heldBackByTemplate(asStringArray(achievement.tags), docType),
				pinned: false,
				score: 0
			});
		}
	}

	const visibleProjects = new Set(
		filterOnTags(profile.side_projects ?? [], OVERRIDE_ENTITIES.sideProject).map((p) => p.id)
	);
	for (const project of profile.side_projects ?? []) {
		const summary = text(project.summary);
		candidates.push({
			entityType: OVERRIDE_ENTITIES.sideProject,
			entityId: project.id,
			parentId: null,
			label: text(project.name) || `project ${project.id}`,
			chars: (text(project.name) + summary).length,
			visible: visibleProjects.has(project.id),
			parentVisible: true,
			templateHeldBack: heldBackByTemplate(asStringArray(project.tags), docType),
			pinned: false,
			score: 0
		});
	}

	// Skills are include-only (see $lib/tailoring): a required one the document
	// would hide is exactly the gap this feature exists to close, but dropping a
	// skill on a relevance score is thin evidence for a lasting decision.
	//
	// Visibility is answered by NAME, not by row, the way the coverage map
	// answers it: a profile may hold the same skill in two categories — one per
	// version is a real pattern here — and a reader or a keyword search sees the
	// word, not which row printed it. Asking per row produced an "include
	// Python" decision on a document already printing Python from its other
	// category, and the decision did nothing at all.
	const visibleCategories = new Set(
		filterOnTags(profile.tech_skill_categories ?? [], OVERRIDE_ENTITIES.skillCategory).map(
			(c) => c.id
		)
	);
	const visibleSkillsByCategory = new Map<number, Set<number>>();
	// In render order, because an anchor is an index into exactly this list.
	const printedInCategory = new Map<number, string[]>();
	const printedNames = new Set<string>();
	// Carriers are not confined to one category — "Docker Compose" can vouch for
	// a Docker held somewhere else — so this list spans the whole document.
	const printedAnywhere: string[] = [];
	for (const category of profile.tech_skill_categories ?? []) {
		const kept = filterOnTags(category.tech_skills ?? [], OVERRIDE_ENTITIES.skill);
		visibleSkillsByCategory.set(category.id, new Set(kept.map((s) => s.id)));
		if (!visibleCategories.has(category.id)) continue;
		printedInCategory.set(category.id, kept.map((s) => text(s.name)).filter(Boolean));
		for (const name of printedInCategory.get(category.id) ?? []) {
			printedNames.add(name.toLowerCase());
			printedAnywhere.push(name);
		}
	}

	// Skill CATEGORIES are droppable, and they are the only part of the document
	// that was identical on every tailored version — a data role listing Vue,
	// Shopify and Jinja among 59 skills. A category is the right grain for it:
	// one reviewable line ("Frontend — 10 skills, none of them what this job
	// asks for") rather than ten fiddly ones, which is the objection that kept
	// skills include-only.
	//
	// The label doubles as the embedding text (see embedTextFor), so it lists
	// what is actually in the group rather than just naming it.
	for (const category of profile.tech_skill_categories ?? []) {
		if (!visibleCategories.has(category.id)) continue;
		const names = printedInCategory.get(category.id) ?? [];
		if (names.length === 0) continue;
		// Any required skill IN the group, printed or not: a hidden one is about to
		// be surfaced, and the surfacing prints nothing if its group has gone —
		// the filter reaches the category first.
		const holdsRequired = (category.tech_skills ?? []).some((skill) => {
			const name = text(skill.name);
			return !!name && required.has(name.toLowerCase());
		});
		candidates.push({
			entityType: OVERRIDE_ENTITIES.skillCategory,
			entityId: category.id,
			parentId: null,
			label: `${text(category.name) || 'Skills'}: ${names.join(', ')}`,
			// Deliberately zero. The skills block is a compact list, and the page
			// budget is calibrated on prose; counting it would silently re-tune
			// how much of the rest survives. A category goes for irrelevance, not
			// for space.
			chars: 0,
			visible: true,
			// A group holding a skill this job requires is not up for discussion —
			// dropping it would take the required skill with it, since the filter
			// reaches the category before the skills inside it.
			pinned: holdsRequired,
			score: holdsRequired ? 1 : 0
		});
	}

	// One candidate per required NAME, for the same reason: two rows would mean
	// two identical "now showing: Python" lines in the diff.
	const claimed = new Set<string>();
	for (const category of profile.tech_skill_categories ?? []) {
		// An include on a skill inside a hidden category prints nothing — the
		// category is filtered first, and the skill never gets asked. Recording a
		// decision that cannot take effect is worse than recording none: the diff
		// claims the document now shows something it does not. The skills strip
		// calls the same case "held back by another rule" and declines to offer.
		if (!visibleCategories.has(category.id)) continue;
		for (const skill of category.tech_skills ?? []) {
			const name = text(skill.name);
			if (!name || !required.has(name.toLowerCase())) continue;
			if (claimed.has(name.toLowerCase())) continue;
			claimed.add(name.toLowerCase());
			candidates.push({
				entityType: OVERRIDE_ENTITIES.skill,
				entityId: skill.id,
				parentId: category.id,
				label: name,
				chars: name.length,
				visible:
					printedNames.has(name.toLowerCase()) ||
					(visibleSkillsByCategory.get(category.id)?.has(skill.id) ?? false),
				parentVisible: true,
				pinned: true,
				score: 1,
				anchor: anchorAmongSiblings(name, printedInCategory.get(category.id) ?? []),
				carriedBy: carrierOf(name, printedAnywhere)
			});
		}
	}

	return candidates;
}

/** What each candidate is embedded/compared as. */
function embedTextFor(candidate: Candidate): string {
	return candidate.label;
}

/**
 * L1. Scores every candidate — no floor, no top-K — because the selector needs
 * the whole field to reason about siblings and budget.
 */
export async function scoreCandidates(
	profileId: number,
	candidates: Candidate[],
	query: { text: string; skills: string[] },
	/** Cache the query vector under this key — see semanticScoreUnits. */
	queryUnit?: { unitType: string; unitId: number }
): Promise<{ candidates: Candidate[]; ranker: 'semantic' | 'lexical'; floor: number }> {
	const units: ContentUnit[] = candidates.map((c) => ({
		unitType: c.entityType,
		unitId: c.entityId,
		subId: 0,
		embedText: embedTextFor(c)
	}));
	const queryText = [query.text, ...query.skills].filter(Boolean).join('\n');

	const semantic = await semanticScoreUnits(profileId, units, queryText, queryUnit);
	if (semantic) {
		return {
			candidates: candidates.map((c) => ({
				...c,
				score: c.pinned ? 1 : (semantic.get(poolKey(c.entityType, c.entityId)) ?? 0)
			})),
			ranker: 'semantic',
			floor: config.embeddingProjectThreshold
		};
	}

	return {
		candidates: candidates.map((c) => ({
			...c,
			score: c.pinned
				? Number.MAX_SAFE_INTEGER
				: scoreUnitAgainstQuery({ title: c.label, keywords: [], text: c.label }, query)
		})),
		ranker: 'lexical',
		floor: LEXICAL_FLOOR
	};
}

/**
 * L3. The model's opinions folded back in as adjusted scores, so the
 * deterministic selector — not the model — has the last word on every hard rule.
 *
 * A "drop" sinks the candidate below any floor; a "keep" lifts it above one.
 * Anything the model says about a ref that isn't on the shortlist is discarded.
 */
export function applyModelOpinions(
	candidates: Candidate[],
	opinions: Array<{ ref: string; action: string; reason: string }>,
	floor: number
): { candidates: Candidate[]; reasons: Map<string, string> } {
	const reasons = new Map<string, string>();
	const byRef = new Map(candidates.map((c) => [refFor(c), c]));
	const adjusted = new Map<string, number>();

	for (const opinion of opinions) {
		const candidate = byRef.get(String(opinion.ref).trim());
		if (!candidate || candidate.pinned) continue;
		const action = String(opinion.action).trim().toLowerCase();
		if (action === 'drop') {
			adjusted.set(refFor(candidate), floor - Math.abs(floor) - 1);
		} else if (action === 'keep') {
			// Only for something already ON the document. "Keep" about a hidden
			// item means "I have no objection", not "add it" — but a lift to the
			// floor is exactly what the surfacing bar reads as "add it", and the
			// model says keep to most of the shortlist. It surfaced three filler
			// side projects onto an AI role and pushed real bullets off the page
			// to make room for them.
			if (!candidate.visible) continue;
			adjusted.set(refFor(candidate), Math.max(candidate.score, floor));
		} else {
			continue;
		}
		const reason = text(opinion.reason);
		if (reason) reasons.set(refFor(candidate), reason);
	}

	return {
		candidates: candidates.map((c) => {
			const score = adjusted.get(refFor(c));
			return score === undefined ? c : { ...c, score };
		}),
		reasons
	};
}

/** Stable handle for one candidate, used in the shortlist the model sees. */
export function refFor(candidate: Pick<Candidate, 'entityType' | 'entityId'>): string {
	const short =
		candidate.entityType === OVERRIDE_ENTITIES.achievement
			? 'bullet'
			: candidate.entityType === OVERRIDE_ENTITIES.sideProject
				? 'project'
				: candidate.entityType === OVERRIDE_ENTITIES.skillCategory
					? 'skillgroup'
					: 'skill';
	return `${short}:${candidate.entityId}`;
}

/**
 * The lines the model is asked to judge.
 *
 * Ordered by where the ranker is most likely to be WRONG, not by relevance.
 * Proposed drops come first — they are the consequential decisions, and a bad
 * one removes something the applicant wanted — then whatever sits closest to
 * the floor in either direction, which is where a similarity score and a human
 * reading of a job disagree. Sorting by score instead would spend the whole
 * budget on the obvious keeps and truncate exactly the items worth a second
 * opinion.
 */
export function shortlistFor(
	candidates: Candidate[],
	decisions: Decision[],
	floor: number
): string {
	const dropped = new Set(
		decisions.filter((d) => d.action === 'exclude').map((d) => `${d.entityType}:${d.entityId}`)
	);
	const key = (c: Candidate) => `${c.entityType}:${c.entityId}`;
	const judgeable = candidates.filter((c) => !c.pinned);

	const proposedDrops = judgeable.filter((c) => dropped.has(key(c)));
	const rest = judgeable
		.filter((c) => !dropped.has(key(c)))
		.sort((a, z) => Math.abs(a.score - floor) - Math.abs(z.score - floor));

	return [...proposedDrops, ...rest]
		.slice(0, SHORTLIST_LIMIT)
		.map((c) => {
			const proposal = dropped.has(key(c)) ? 'drop' : 'keep';
			return `${refFor(c)} | ${c.label.replace(/\s+/g, ' ')} | ${c.score.toFixed(2)} | ${proposal}`;
		})
		.join('\n');
}

/**
 * Generate (or regenerate) the version tailored to one application.
 *
 * Regeneration replaces the decisions this feature made and leaves the
 * applicant's own alone — `source` on each row is what keeps a rerun from
 * quietly undoing a judgement someone made by hand.
 */
export async function tailorVersionForApplication(opts: {
	profileId: number;
	applicationId: number;
	docType: string;
	/** Library version to build on; '' means the plain base template. */
	baseSlug: string;
}): Promise<TailorResult> {
	const { profileId, applicationId, docType, baseSlug } = opts;

	const application = await db.query.applications.findFirst({
		where: and(eq(applications.id, applicationId), eq(applications.profile_id, profileId)),
		with: {
			job: {
				columns: {
					id: true,
					title: true,
					company: true,
					job_description: true,
					skills_required: true,
					skills_preferred: true,
					responsibilities: true
				}
			}
		}
	});
	if (!application?.job) {
		throw new Error('This application has no job to tailor against.');
	}
	const job = application.job;

	const profile = await getProfileByIdentifier(profileId);
	if (!profile) throw new Error('Profile not found.');

	const requiredSkills = asStringArray(job.skills_required);
	const querySkills = [...requiredSkills, ...asStringArray(job.skills_preferred)];
	const query = {
		text: [
			text(job.title),
			text(job.job_description),
			asStringArray(job.responsibilities).join('\n')
		]
			.filter(Boolean)
			.join('\n'),
		skills: querySkills
	};

	// An empty base means "your plain resume", and for a profile with a public
	// version that is not a document at all: /p/[slug]/resume serves the public
	// version, the PDF export is keyed by slug, and every item tagged onto a
	// version — four side projects here — silently stops printing. A tailored
	// version built on it is a document nobody can send, and the only sign is
	// content quietly missing. Several paths can arrive here with '' (the "tailor
	// from this one" button while nothing is picked, a regenerate that inherited
	// a version with no extension), so the fallback lives at the bottom where
	// they all pass rather than at each of them.
	const effectiveBase = baseSlug || (await defaultBaseSlug(profileId, docType));
	const built = buildCandidates(profile, docType, effectiveBase, requiredSkills);
	const { candidates, ranker, floor } = await scoreCandidates(profileId, built, query);

	// The reason carries the counter-argument when there is one: a keyword search
	// already finds "AWS" inside "AWS EC2", so this include is a judgement about
	// human readers, and the diff should let it be reviewed as one.
	const pinnedReason = (c: Candidate) =>
		c.carriedBy
			? `this job requires ${c.label} — “${c.carriedBy}” already carries the word`
			: `this job requires ${c.label}`;
	const docLabel = docType === 'cv' ? 'CV' : 'resume';
	const otherLabel = docType === 'cv' ? 'resume' : 'CV';
	const groupDropReason = (c: Candidate) => {
		const count = c.label.split(':')[1]?.split(',').length ?? 0;
		return count > 0
			? `none of these ${count} skills is what this job asks for`
			: 'this job asks for none of the skills in this group';
	};
	const surfacedReason = (c: Candidate) =>
		c.templateHeldBack
			? `kept for your ${otherLabel} only, but it outranks half of what this ${docLabel} shows`
			: `hidden on the version this builds on, and more relevant to this job than half of what it shows`;
	// One page or two, decided by how much this applicant has rather than by a
	// setting they would have to understand. The fit pass below then holds the
	// document to it by rendering, which is the only thing that actually knows.
	const budgetChars = chooseBudget(candidates);
	const targetPages = budgetChars === PAGE_BUDGETS.one ? 1 : 2;
	// Whatever the last selection ran against — the model adjusts scores, and
	// re-selecting for the page has to see the same field it did.
	let selectionCandidates = candidates;
	const deterministic = selectForJob(candidates, {
		floor,
		...DEFAULT_SELECTION,
		budgetChars,
		pinnedReason,
		surfacedReason,
		groupDropReason
	});

	// ── L3 ──
	let decisions = deterministic;
	let modelReviewed = false;
	let modelReasons = new Map<string, string>();
	const shortlist = shortlistFor(candidates, deterministic, floor);
	if (shortlist) {
		try {
			const result = await createAndGenerateAiChat(profileId, 'tailor_resume_selection', {
				'job.summary': [text(job.title), text(job.company), text(job.job_description)]
					.filter(Boolean)
					.join('\n')
					.slice(0, 4000),
				'job.skills': querySkills.join(', '),
				shortlist
			});
			// `response` is the raw JSON string the model returned; every caller
			// parses it themselves (see record-derivation.ts).
			//
			// The bare array is handled HERE rather than in the wire schema. gpt-oss
			// answers a single-key object with a naked array often enough to plan
			// for, but a coercion inside the schema is the wrong place for it: the
			// schema is also what gets converted for providers that take a JSON
			// Schema, where a preprocess/transform breaks the conversion. Groq's
			// json_object mode rejects a top-level array at the API before we ever
			// see it, so this covers the providers that let one through.
			const parsed =
				result.success && result.aiChat?.response ? JSON.parse(result.aiChat.response) : null;
			const opinions = Array.isArray(parsed)
				? parsed
				: (parsed as { decisions?: unknown } | null)?.decisions;
			if (Array.isArray(opinions)) {
				const applied = applyModelOpinions(
					candidates,
					opinions as Array<{ ref: string; action: string; reason: string }>,
					floor
				);
				modelReasons = applied.reasons;
				selectionCandidates = applied.candidates;
				// Re-run the same selector: the model changed scores, not rules.
				decisions = selectForJob(applied.candidates, {
					floor,
					...DEFAULT_SELECTION,
					budgetChars,
					pinnedReason,
					surfacedReason,
					groupDropReason
				});
				modelReviewed = true;
			}
		} catch (err) {
			// A tailored version built from the deterministic layers alone is a
			// worse suggestion, not a broken one — so this degrades rather than
			// failing the request.
			console.warn('[tailor-version] model review failed, keeping deterministic selection:', err);
		}
	}

	// The model's wording is better than the ranker's when it has an opinion.
	for (const decision of decisions) {
		const reason = modelReasons.get(refFor(decision));
		if (reason) decision.reason = reason;
	}

	const versionId = await upsertTailoredVersion({
		profileId,
		applicationId,
		baseSlug: effectiveBase,
		jobTitle: text(job.title),
		company: text(job.company)
	});
	await persistDecisions(versionId, decisions);

	const version = await db.query.profile_versions.findFirst({
		where: eq(profile_versions.id, versionId),
		columns: { slug: true, name: true }
	});
	const versionSlug = version?.slug ?? tailoredSlugFor(applicationId);

	// ── Fit ──
	//
	// The budget is characters and the target is pages, and the exchange rate
	// between them is the template's own height, which differs per applicant:
	// one page held 1,150 characters of this profile's prose and 741 of
	// another's. So the document is rendered and counted, and if it overshoots,
	// selected again against a tighter budget.
	//
	// A run that never reaches the target puts back the FULLEST selection it
	// made. Half a career removed in pursuit of a page it was never going to
	// reach is the worst of both, and it is the outcome measuring replaced.
	const fitted = await fitToPages({
		profileId,
		versionId,
		versionSlug,
		docType,
		targetPages,
		budgetChars,
		fallback: targetPages === 1 ? { targetPages: 2, budgetChars: PAGE_BUDGETS.two } : null,
		select: (budget) =>
			selectForJob(selectionCandidates, {
				floor,
				...DEFAULT_SELECTION,
				budgetChars: budget,
				pinnedReason,
				surfacedReason,
				groupDropReason
			})
	});

	return {
		versionId,
		versionSlug,
		versionName: version?.name ?? 'Tailored version',
		decisions: fitted.decisions ?? decisions,
		ranker,
		modelReviewed,
		targetPages: fitted.targetPages,
		pages: fitted.pages
	};
}

/**
 * Re-select and re-render until the version fits its page target.
 *
 * A run that cannot reach the target falls back to the LARGER one and selects
 * again for it — not to its own first attempt, which was already trimmed for a
 * page it never reached. Half a career removed in pursuit of a page that stayed
 * two is the worst of both, and it is the outcome measuring was meant to end.
 *
 * Returns the decisions left in place, the page count reached, and the target
 * it settled on. A null count means the renderer could not answer; the first
 * selection stands, which is what happened before any of this existed.
 */
async function fitToPages(opts: {
	profileId: number;
	versionId: number;
	versionSlug: string;
	docType: string;
	targetPages: number;
	budgetChars: number;
	/** The roomier target to settle for. Null when already at the roomiest. */
	fallback: { targetPages: number; budgetChars: number } | null;
	select: (budget: number) => Decision[];
}): Promise<{ decisions: Decision[] | null; pages: number | null; targetPages: number }> {
	const { profileId, versionId, versionSlug, docType, targetPages } = opts;
	const count = () => countVersionPages(profileId, versionSlug, docType);

	let budget = opts.budgetChars;
	let pages = await count();

	for (
		let attempt = 1;
		attempt < FIT_ATTEMPTS && pages !== null && pages > targetPages;
		attempt++
	) {
		budget = tightenBudget(budget, pages, targetPages);
		const tighter = opts.select(budget);
		await persistDecisions(versionId, tighter);
		pages = await count();
		if (pages !== null && pages <= targetPages) {
			return { decisions: tighter, pages, targetPages };
		}
	}

	if (pages !== null && pages > targetPages && opts.fallback) {
		const full = opts.select(opts.fallback.budgetChars);
		await persistDecisions(versionId, full);
		return { decisions: full, pages: await count(), targetPages: opts.fallback.targetPages };
	}
	return { decisions: null, pages, targetPages };
}

/**
 * What this profile sends when nobody names a version — the only sensible thing
 * to build a tailored version ON.
 *
 * Empty when the profile has no public version for that template, which is the
 * one case where the plain document really is the base: there is nothing else,
 * and no version tags for it to ignore.
 */
async function defaultBaseSlug(profileId: number, docType: string): Promise<string> {
	const profile = await db.query.profiles.findFirst({
		where: eq(profiles.id, profileId),
		columns: { public_resume_version_id: true, public_cv_version_id: true }
	});
	const versionId =
		docType === 'cv' ? profile?.public_cv_version_id : profile?.public_resume_version_id;
	if (!versionId) return '';

	const version = await db.query.profile_versions.findFirst({
		where: and(eq(profile_versions.id, versionId), eq(profile_versions.profile_id, profileId)),
		columns: { slug: true }
	});
	return version?.slug ?? '';
}

/** Create the application's version, or reuse the one it already has. */
async function upsertTailoredVersion(opts: {
	profileId: number;
	applicationId: number;
	baseSlug: string;
	jobTitle: string;
	company: string;
}): Promise<number> {
	const { profileId, applicationId, baseSlug, jobTitle, company } = opts;
	const base = baseSlug
		? await db.query.profile_versions.findFirst({
				where: and(
					eq(profile_versions.profile_id, profileId),
					eq(profile_versions.slug, baseSlug),
					isNull(profile_versions.application_id)
				),
				columns: { id: true }
			})
		: null;

	const existing = await db.query.profile_versions.findFirst({
		where: and(
			eq(profile_versions.profile_id, profileId),
			eq(profile_versions.application_id, applicationId)
		),
		columns: { id: true },
		with: { extension_links: { columns: { extended_id: true } } }
	});

	if (existing) {
		// Regenerating against a different library version has to move the
		// extension too. Without this the selection would be computed against one
		// base and rendered against another — every visible/hidden verdict in the
		// diff would be answering about a document nobody is looking at.
		const current = existing.extension_links?.[0]?.extended_id ?? null;
		if (current !== (base?.id ?? null)) {
			await db
				.delete(profile_version_extensions)
				.where(eq(profile_version_extensions.extender_id, existing.id));
			if (base) {
				await db
					.insert(profile_version_extensions)
					.values({ extender_id: existing.id, extended_id: base.id });
			}
		}
		return existing.id;
	}

	const name = [jobTitle || 'Tailored', company].filter(Boolean).join(' — ');
	const [created] = await db
		.insert(profile_versions)
		.values({
			profile_id: profileId,
			application_id: applicationId,
			slug: tailoredSlugFor(applicationId),
			name,
			// Published because it has to render: the applicant opens it, exports it
			// and sends it. It stays out of every library listing by application_id,
			// not by status.
			status: 'published',
			date_created: new Date()
		})
		.returning();

	// Extending the library version is what makes this a DELTA rather than a
	// copy: the applicant's curation still applies, and later edits to it flow
	// through here.
	if (base) {
		await db
			.insert(profile_version_extensions)
			.values({ extender_id: created.id, extended_id: base.id });
	}

	return created.id;
}

/** Replace this feature's own rows; never touch one the applicant made. */
async function persistDecisions(versionId: number, decisions: Decision[]): Promise<void> {
	const mine = await db.query.profile_version_overrides.findMany({
		where: eq(profile_version_overrides.version_id, versionId),
		columns: { id: true, entity_type: true, entity_id: true, source: true }
	});
	const userOwned = new Set(
		mine.filter((r) => r.source === 'user').map((r) => `${r.entity_type}:${r.entity_id}`)
	);

	for (const row of mine) {
		if (row.source === 'user') continue;
		await db.delete(profile_version_overrides).where(eq(profile_version_overrides.id, row.id));
	}

	const now = new Date();
	for (const decision of decisions) {
		if (userOwned.has(`${decision.entityType}:${decision.entityId}`)) continue;
		await db.insert(profile_version_overrides).values({
			version_id: versionId,
			entity_type: decision.entityType,
			entity_id: decision.entityId,
			action: decision.action,
			sort: decision.sort,
			reason: decision.reason,
			source: 'ai',
			date_created: now,
			date_updated: now
		});
	}
}

/**
 * What the stored match concluded about this job — the parts a document can be
 * held to account against.
 *
 * `matched` matters here because the matcher is semantic and the document is
 * literal: it counts "SQL" through MySQL and PostgreSQL, so a required skill can
 * be *credited* to the applicant while the word appears nowhere on what they
 * send. Neither the exact-name join nor the score can see that on its own.
 */
export async function jobMatchRead(
	profileId: number,
	jobId: number
): Promise<{ gaps: string[]; matched: string[] }> {
	const match = await db.query.job_matches.findFirst({
		where: and(eq(job_matches.profile_id, profileId), eq(job_matches.job_id, jobId)),
		columns: { gaps: true, matched_skills: true }
	});
	return {
		gaps: asStringArray(match?.gaps).slice(0, 6),
		matched: asStringArray(match?.matched_skills)
	};
}

/** Every decision on one version, newest first, for the review panel. */
export async function decisionsForVersion(versionId: number) {
	return db.query.profile_version_overrides.findMany({
		where: eq(profile_version_overrides.version_id, versionId),
		orderBy: asc(profile_version_overrides.id)
	});
}

export interface DescribedDecision {
	id: number;
	entityType: string;
	entityId: number;
	action: string;
	reason: string | null;
	sort: number | null;
	source: string;
	/** The applicant's own words for the thing being decided about. */
	label: string;
	/**
	 * Where that text lives, when the text alone doesn't place it. A bullet is
	 * one line out of a role and reads like any other; which job it belongs to
	 * is most of what tells you whether hiding it was right.
	 */
	context: string | null;
}

/**
 * Override rows with the item text filled in.
 *
 * The sidecar stores ids, but a review panel showing "exclude
 * work_experience_achievement 412" asks the applicant to audit a decision they
 * cannot see. Rows whose item has since been deleted are dropped rather than
 * shown as a blank — the cascade already made them meaningless.
 */
export async function describeOverrides(
	rows: Array<{
		id: number;
		entity_type: string;
		entity_id: number;
		action: string;
		reason: string | null;
		sort: number | null;
		source: string;
	}>
): Promise<DescribedDecision[]> {
	const idsOf = (type: string) =>
		rows.filter((r) => r.entity_type === type).map((r) => r.entity_id);

	const [achievements, projects, skills, groups] = await Promise.all([
		idsOf(OVERRIDE_ENTITIES.achievement).length
			? db.query.work_experience_achievements.findMany({
					where: inArray(work_experience_achievements.id, idsOf(OVERRIDE_ENTITIES.achievement)),
					columns: { id: true, description: true, work_experience_id: true }
				})
			: [],
		idsOf(OVERRIDE_ENTITIES.sideProject).length
			? db.query.side_projects.findMany({
					where: inArray(side_projects.id, idsOf(OVERRIDE_ENTITIES.sideProject)),
					columns: { id: true, name: true }
				})
			: [],
		idsOf(OVERRIDE_ENTITIES.skill).length
			? db.query.tech_skills.findMany({
					where: inArray(tech_skills.id, idsOf(OVERRIDE_ENTITIES.skill)),
					columns: { id: true, name: true }
				})
			: [],
		idsOf(OVERRIDE_ENTITIES.skillCategory).length
			? db.query.tech_skill_categories.findMany({
					where: inArray(tech_skill_categories.id, idsOf(OVERRIDE_ENTITIES.skillCategory)),
					columns: { id: true, name: true },
					with: { tech_skills: { columns: { name: true } } }
				})
			: []
	]);

	// One more round-trip, and only when bullets are involved: a bullet needs the
	// role it sits under to be identifiable, and the other two entities name
	// themselves.
	const roleIds = [...new Set(achievements.map((a) => a.work_experience_id).filter(Boolean))];
	const roles = roleIds.length
		? await db.query.work_experiences.findMany({
				where: inArray(work_experiences.id, roleIds as number[]),
				columns: { id: true, position: true, name: true }
			})
		: [];
	const roleLabels = new Map(
		roles.map((r) => [r.id, [text(r.position), text(r.name)].filter(Boolean).join(' at ')])
	);

	const labels = new Map<string, string>();
	const contexts = new Map<string, string>();
	for (const a of achievements) {
		labels.set(`${OVERRIDE_ENTITIES.achievement}:${a.id}`, text(a.description));
		const role = roleLabels.get(a.work_experience_id);
		if (role) contexts.set(`${OVERRIDE_ENTITIES.achievement}:${a.id}`, role);
	}
	for (const p of projects) {
		labels.set(`${OVERRIDE_ENTITIES.sideProject}:${p.id}`, text(p.name));
	}
	for (const s of skills) {
		labels.set(`${OVERRIDE_ENTITIES.skill}:${s.id}`, text(s.name));
	}
	for (const g of groups) {
		// The whole list, because what is leaving the page is the list, and a bare
		// "Frontend" asks the applicant to go and look it up before deciding.
		const names = (g.tech_skills ?? []).map((s) => text(s.name)).filter(Boolean);
		labels.set(`${OVERRIDE_ENTITIES.skillCategory}:${g.id}`, text(g.name) || 'Skills');
		if (names.length > 0) {
			contexts.set(`${OVERRIDE_ENTITIES.skillCategory}:${g.id}`, names.join(', '));
		}
	}

	return rows
		.map((row) => ({
			id: row.id,
			entityType: row.entity_type,
			entityId: row.entity_id,
			action: row.action,
			reason: row.reason,
			sort: row.sort,
			source: row.source,
			label: labels.get(`${row.entity_type}:${row.entity_id}`) ?? '',
			context: contexts.get(`${row.entity_type}:${row.entity_id}`) ?? null
		}))
		.filter((row) => row.label);
}

/**
 * Tables carrying a `tags` array that can name a version slug, with what ties a
 * row to one profile. `app-<id>` slugs are only unique per profile, so every
 * rewrite below has to be scoped — another applicant can hold the same one.
 */
const TAGGED_TABLES: { table: string; scope: (profileId: number) => SQL }[] = [
	{ table: 'work_experiences', scope: (p) => sql`profile_id = ${p}` },
	{ table: 'education', scope: (p) => sql`profile_id = ${p}` },
	{ table: 'side_projects', scope: (p) => sql`profile_id = ${p}` },
	{ table: 'tech_skill_categories', scope: (p) => sql`profile_id = ${p}` },
	{
		table: 'tech_skills',
		scope: (p) => sql`category_id IN (SELECT id FROM tech_skill_categories WHERE profile_id = ${p})`
	},
	{
		table: 'work_experience_achievements',
		scope: (p) =>
			sql`work_experience_id IN (SELECT id FROM work_experiences WHERE profile_id = ${p})`
	},
	{
		table: 'work_experience_technologies',
		scope: (p) =>
			sql`work_experience_id IN (SELECT id FROM work_experiences WHERE profile_id = ${p})`
	}
];

/**
 * Point item tags naming `from` at `to` — or drop them, when `to` is null.
 *
 * A version is addressed by slug in two places: `applications.cv_version_sent`
 * and the `tags` array on every profile item. Promoting renames the slug and
 * discarding retires it, and following only the first left the second naming a
 * version that no longer existed — so a skill somebody had added to the
 * tailored version silently stopped printing on the document they added it to,
 * with nothing to see anywhere: the tag was still there, and still looked right.
 *
 * Returns how many rows changed. The SQL only narrows the field — renameTagSlug
 * decides, and a row it leaves alone is not written — so the predicate being
 * approximate (it strips every leading `!`, where a tag means only the first)
 * costs a wasted read at most.
 */
export async function retagVersionSlug(
	profileId: number,
	from: string,
	to: string | null
): Promise<number> {
	const slug = tagSlug(from);
	if (!slug) return 0;
	let touched = 0;

	for (const { table, scope } of TAGGED_TABLES) {
		const rows = await queryRaw<{ id: number; tags: unknown }>(
			sql`SELECT id, tags FROM ${sql.raw(table)}
			     WHERE ${scope(profileId)}
			       -- Some rows store a JSON null rather than a SQL NULL, and
			       -- jsonb_array_elements_text errors on anything but an array.
			       AND jsonb_typeof(tags::jsonb) = 'array'
			       AND EXISTS (
			             SELECT 1 FROM jsonb_array_elements_text(tags::jsonb) AS t(tag)
			              WHERE lower(btrim(ltrim(btrim(t.tag), '!'))) = ${slug}
			           )`
		);
		for (const row of rows) {
			const before = asStringArray(row.tags);
			const next = renameTagSlug(before, slug, to);
			if (next.length === before.length && next.every((tag, i) => tag === before[i])) continue;

			await queryRaw(
				sql`UPDATE ${sql.raw(table)}
				       SET tags = ${next.length > 0 ? JSON.stringify(next) : null}::json
				     WHERE id = ${row.id}`
			);
			touched += 1;
		}
	}

	return touched;
}

/**
 * Move a tailored version into the applicant's library.
 *
 * The version keeps its overrides — that is the point of promoting: the
 * selection made for one job turned out to be a document worth keeping, and
 * throwing away the decisions would leave an empty shell. What has to change is
 * everything that made it *this application's*: the reserved slug (which the
 * library forms refuse, and which would read as noise in a share link) and the
 * `application_id` that ties it to the cascade.
 *
 * Renaming the slug is the part with teeth. `applications.cv_version_sent`
 * stores a slug, not an id, so an application that recorded sending this
 * version would silently point at nothing — hence the update below, scoped to
 * rows that named the old slug. Item tags are the second reference of that
 * shape and were missed at first: see retagVersionSlug.
 */
export async function promoteToLibrary(opts: {
	profileId: number;
	applicationId: number;
	name?: string | null;
}): Promise<{ slug: string; name: string }> {
	const { profileId, applicationId } = opts;

	const version = await db.query.profile_versions.findFirst({
		where: and(
			eq(profile_versions.profile_id, profileId),
			eq(profile_versions.application_id, applicationId)
		),
		columns: { id: true, slug: true, name: true }
	});
	if (!version) throw new Error('This application has no tailored version to promote.');

	const name = (opts.name ?? '').trim() || version.name || 'Tailored version';
	const slug = await uniqueLibrarySlug(profileId, name);
	const oldSlug = version.slug;

	await db
		.update(profile_versions)
		.set({ application_id: null, slug, name, date_updated: new Date() })
		.where(eq(profile_versions.id, version.id));

	if (oldSlug && oldSlug !== slug) {
		await db
			.update(applications)
			.set({ cv_version_sent: slug, date_updated: new Date() })
			.where(
				and(eq(applications.profile_id, profileId), eq(applications.cv_version_sent, oldSlug))
			);
		// The other slug-keyed reference. Overrides survive a rename on their own
		// — they key on the version's id — but item tags name the slug, so a skill
		// added to this version by tag would drop off it here.
		await retagVersionSlug(profileId, oldSlug, slug);
	}

	return { slug, name };
}

/**
 * A library slug derived from the name, suffixed until it is free.
 *
 * Uniqueness is enforced here rather than by a constraint because the column
 * has none — versions are addressed by slug in URLs and in item tags, so a
 * duplicate would make both ambiguous.
 */
async function uniqueLibrarySlug(profileId: number, name: string): Promise<string> {
	const base =
		name
			.toLowerCase()
			.trim()
			.replace(/[^\w\s-]/g, '')
			.replace(/[\s_]+/g, '-')
			.replace(/-+/g, '-')
			.replace(/^-+|-+$/g, '')
			.slice(0, 40) || 'tailored';
	// Never hand back a slug the library forms would reject.
	const seed = isTailoredSlug(base) ? `v-${base}` : base;

	const taken = new Set(
		(
			await db.query.profile_versions.findMany({
				where: eq(profile_versions.profile_id, profileId),
				columns: { slug: true }
			})
		)
			.map((v) => v.slug)
			.filter(Boolean) as string[]
	);

	if (!taken.has(seed)) return seed;
	for (let n = 2; n < 100; n++) {
		const candidate = `${seed}-${n}`;
		if (!taken.has(candidate)) return candidate;
	}
	throw new Error('Could not find a free slug for this version.');
}

/** Something a chosen document leaves out that speaks to this job. */
export interface ExcludedItem {
	entityType: string;
	entityId: number;
	label: string;
	score: number;
}

/** At most this many per document — a list of everything is not a warning. */
const MAX_EXCLUSIONS_REPORTED = 4;

/**
 * Per candidate document, the relevant things it does NOT show.
 *
 * The hidden-skills strip answers this for skills, by exact name and for free.
 * This is the same question about EVIDENCE — bullets and side projects — which
 * is the more damaging omission: a missing skill name costs you a keyword, a
 * missing bullet costs you the proof. Pick your frontend version for a data
 * role and the pipeline bullet silently stays home.
 *
 * It costs no LLM call and no credits. Item vectors are already cached per
 * content hash in `content_embeddings`, so scoring is cosine over cached
 * vectors; the job's own vector is cached too (see the `queryUnit` argument),
 * so a page view after the first embeds nothing at all. With embeddings
 * unconfigured it degrades to lexical overlap, which is much weaker here — a
 * bullet about migrating a monolith does not lexically resemble "platform
 * engineering" — so the floor does more work than the ranking.
 *
 * Scores are version-independent, so they are computed ONCE and the loop below
 * only re-asks which items each document happens to show.
 */
export async function relevantExclusionsByVersion(opts: {
	profileId: number;
	applicationId: number;
	versionSlugs: string[];
}): Promise<Record<string, ExcludedItem[]>> {
	const { profileId, applicationId, versionSlugs } = opts;

	const application = await db.query.applications.findFirst({
		where: and(eq(applications.id, applicationId), eq(applications.profile_id, profileId)),
		with: {
			job: {
				columns: {
					id: true,
					title: true,
					job_description: true,
					skills_required: true,
					skills_preferred: true,
					responsibilities: true
				}
			}
		}
	});
	const job = application?.job;
	if (!job) return {};

	const profile = await getProfileByIdentifier(profileId);
	if (!profile) return {};

	const requiredSkills = asStringArray(job.skills_required);
	const query = {
		text: [
			text(job.title),
			text(job.job_description),
			asStringArray(job.responsibilities).join('\n')
		]
			.filter(Boolean)
			.join('\n'),
		skills: [...requiredSkills, ...asStringArray(job.skills_preferred)]
	};
	if (!query.text && query.skills.length === 0) return {};

	// One scoring pass: an item's relevance to the job does not depend on which
	// document is being considered.
	const { candidates, floor } = await scoreCandidates(
		profileId,
		buildCandidates(profile, 'resume', '', requiredSkills),
		query,
		{ unitType: 'job_query', unitId: job.id }
	);
	const scoreOf = new Map(candidates.map((c) => [`${c.entityType}:${c.entityId}`, c.score]));

	// Decisions recorded ON a version are not accidents: the tailored version
	// hides things because this feature, and the model, said so — with a reason
	// the applicant can read in the diff. Warning about those would have the
	// page argue with itself. Only what the TAGS hold back is news here.
	const decidedAgainst = new Map<string, Set<string>>();
	for (const version of profile.profile_versions ?? []) {
		const slug = (version as { slug?: string | null }).slug;
		const overrides = (version as { overrides?: unknown }).overrides;
		if (!slug || !Array.isArray(overrides)) continue;
		decidedAgainst.set(
			slug,
			new Set(
				overrides
					.filter((o) => (o as { action?: string }).action === 'exclude')
					.map((o) => {
						const row = o as { entity_type: string; entity_id: number };
						return `${row.entity_type}:${row.entity_id}`;
					})
			)
		);
	}

	const result: Record<string, ExcludedItem[]> = {};
	for (const docType of BASE_TEMPLATE_TAGS) {
		for (const versionSlug of versionSlugs) {
			const built = buildCandidates(profile, docType, versionSlug, requiredSkills).filter((c) =>
				DROPPABLE_ENTITIES.includes(c.entityType)
			);
			const scored = built.map((c) => ({
				...c,
				score: scoreOf.get(`${c.entityType}:${c.entityId}`) ?? 0
			}));

			// The same bar the generator surfaces on, from the same function: this
			// warning is what tells the applicant a version is leaving out proof,
			// and the two would be worth nothing if they disagreed about which.
			const bar = surfaceBar(scored, floor);
			const decided = decidedAgainst.get(versionSlug) ?? new Set<string>();

			const excluded = scored
				.filter((c) => !c.visible && !decided.has(`${c.entityType}:${c.entityId}`))
				.filter((c) => c.score >= bar)
				.sort((a, z) => z.score - a.score)
				.slice(0, MAX_EXCLUSIONS_REPORTED)
				.map((c) => ({
					entityType: c.entityType,
					entityId: c.entityId,
					label: c.label,
					score: c.score
				}));

			if (excluded.length > 0) result[hiddenSkillsKey(docType, versionSlug)] = excluded;
		}
	}

	return result;
}
