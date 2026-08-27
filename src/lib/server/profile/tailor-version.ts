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
	beyondReach,
	canSurface,
	chooseBudget,
	DEFAULT_SELECTION,
	DROPPABLE_ENTITIES,
	FIT_ATTEMPTS,
	LOOSEN_ATTEMPTS,
	LOOSEN_EPSILON,
	PAGE_BUDGETS,
	TAIL_RESTORE_ATTEMPTS,
	TAIL_RESTORE_MISSES,
	PROMOTION_MARGIN,
	selectForJob,
	surfaceBar,
	surfaceScore,
	tightenBudget,
	type Candidate,
	type Decision,
	type ItemGroup,
	type ItemRow
} from '$lib/tailoring';
import { carrierOf, carriesName, hiddenSkillsKey } from '$lib/version-coverage';
import { expandUpwardBySeed, resolveConcepts } from '$lib/server/job/skill-ontology';
import { normalizeSkill } from '$lib/skills';
import {
	BASE_TEMPLATE_TAGS,
	heldBackByTemplate,
	isProfileOnly,
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
/** Past which point in years an item is as old as this scale goes. */
const OLD_YEARS = 12;
const MS_PER_YEAR = 365.25 * 24 * 60 * 60 * 1000;

/**
 * How far back an item sits, on a scale this profile sets: 0 for current work,
 * 1 for as far back as it goes.
 *
 * Two measures, and the gentler wins. Relative to the applicant's own span,
 * because "old" for someone three years out of school is not what it is for
 * someone with twenty years behind them — and absolute in years, because a long
 * career would otherwise have everything but the last few years written off
 * just for being long. Taking the smaller means BOTH have to call something old
 * before it counts as old.
 *
 * Worked through: a bullet from a role that ended in 2011, in a career that
 * started in 2006, scores 0.74 relative and 1.0 absolute — old. The same
 * fifteen-year-old bullet in a forty-year career scores 0.36 relative and stays
 * mild. A two-year-old role in a three-year career scores 0.67 relative but
 * 0.17 absolute, so it is left alone, which is the point.
 *
 * Anything current, undated or unparseable is 0. Missing dates are not evidence
 * of age, and guessing against the applicant on data they never entered is the
 * wrong direction to be wrong in.
 */
function ageScale(profile: ProfileRow, now: number): (ended: unknown) => number {
	const starts = (profile.work_experiences ?? [])
		.map((role) => Date.parse(String(role.start_date ?? '')))
		.filter((value) => !Number.isNaN(value));
	const careerStart = starts.length > 0 ? Math.min(...starts) : NaN;

	return (ended: unknown) => {
		const end = Date.parse(String(ended ?? ''));
		if (Number.isNaN(end) || end >= now) return 0;
		const absolute = Math.min(1, (now - end) / MS_PER_YEAR / OLD_YEARS);
		if (Number.isNaN(careerStart) || now <= careerStart) return absolute;
		return Math.max(0, Math.min(absolute, (now - end) / (now - careerStart)));
	};
}

export function buildCandidates(
	profile: ProfileRow,
	docType: string,
	baseSlug: string,
	requiredSkills: string[],
	/**
	 * Normalised skill name → the concept slug it resolves to, for the callers
	 * that have the graph. Optional: without it the pin check falls back to
	 * comparing spellings, which is what it did before.
	 */
	conceptOf?: Map<string, string>
): Candidate[] {
	const { filterOnTags } = createProfileFilter(
		(profile.profile_versions ?? []) as never,
		docType,
		null,
		baseSlug
	);
	const required = new Set(requiredSkills.map((s) => s.trim().toLowerCase()).filter(Boolean));
	const candidates: Candidate[] = [];
	const ageOf = ageScale(profile, Date.now());

	const visibleRoles = new Set(
		filterOnTags(profile.work_experiences ?? [], OVERRIDE_ENTITIES.workExperience).map((w) => w.id)
	);
	const labelOfRole = (role: { position?: unknown; name?: unknown; id: number }) =>
		[text(role.position), text(role.name)].filter(Boolean).join(' at ') || `role ${role.id}`;
	// The roles this document already prints, by name — so a second write-up of
	// one of them is never offered as a role to add. Two versions of the same
	// job on one page is not a tailored resume.
	const printingRoles = new Set(
		(profile.work_experiences ?? [])
			.filter((role) => visibleRoles.has(role.id))
			.map((role) => labelOfRole(role).toLowerCase())
	);
	/**
	 * Why a role does not print — the four answers are different statements and
	 * only one of them is about this document being the wrong document. See
	 * Candidate.parentHeldBack in $lib/tailoring.
	 */
	const holdOn = (tags: string[], label: string): Candidate['parentHeldBack'] => {
		if (isProfileOnly(tags)) return 'profile';
		if (heldBackByTemplate(tags, docType)) return 'template';
		if (printingRoles.has(label.toLowerCase())) return 'alternative';
		return 'version';
	};
	for (const role of profile.work_experiences ?? []) {
		const roleLabel = labelOfRole(role);
		const parentHeldBack = visibleRoles.has(role.id)
			? undefined
			: holdOn(asStringArray(role.tags), roleLabel);
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
				parentType: OVERRIDE_ENTITIES.workExperience,
				parentHeldBack,
				visibleIfParentShown: visibleAchievements.has(achievement.id),
				// A bullet is as old as the role it sits in — it has no dates of its own.
				age: ageOf(role.end_date),
				templateHeldBack: heldBackByTemplate(asStringArray(achievement.tags), docType),
				profileOnly: isProfileOnly(asStringArray(achievement.tags)),
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
			// The summary is the project. Kept out of the label so the review diff
			// stays a list of names rather than paragraphs.
			detail: [text(project.name), summary].filter(Boolean).join(' — '),
			chars: (text(project.name) + summary).length,
			visible: visibleProjects.has(project.id),
			parentVisible: true,
			age: ageOf(project.end_date),
			templateHeldBack: heldBackByTemplate(asStringArray(project.tags), docType),
			profileOnly: isProfileOnly(asStringArray(project.tags)),
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
	// Unlike a role, a hidden skill GROUP is never brought back. The pattern that
	// hides one is almost always a pair — this profile carries a full Backend
	// list tagged `!fullstack-react` and a shorter one tagged `fullstack-react` —
	// so restoring the hidden half prints the same category twice under the same
	// name. Skills are include-only anyway (see $lib/tailoring), so the required
	// ones a group holds are reported as out of reach rather than added.
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
	// The concepts the document already shows, whatever it calls them.
	const printedConcepts = new Set(
		conceptOf ? printedAnywhere.map((n) => conceptOf.get(normalizeSkill(n))).filter(Boolean) : []
	);

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
			// A required skill the document ALREADY PRINTS under another name is
			// not a skill to add. `carrierOf` below answers a narrower question —
			// whether the word appears inside a longer one — and cannot see that
			// "RAG" and "Retrieval Augmented Generation" are one thing. The graph
			// can: `rag` is an approved alias of that concept.
			//
			// Both spellings sat in one job's required list, because the posting
			// used both, and the pass surfaced a skill the applicant had
			// deliberately hidden in order to satisfy a requirement its own visible
			// twin already met. The result printed the same skill twice.
			const sameConceptPrinted = conceptOf
				? (() => {
						const slug = conceptOf.get(normalizeSkill(name));
						return !!slug && printedConcepts.has(slug);
					})()
				: false;
			candidates.push({
				entityType: OVERRIDE_ENTITIES.skill,
				entityId: skill.id,
				parentId: category.id,
				label: name,
				chars: name.length,
				visible:
					printedNames.has(name.toLowerCase()) ||
					sameConceptPrinted ||
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

/**
 * What each candidate is embedded/compared as — its content, not its name.
 *
 * Bullets and skill categories carry theirs in the label already (a category's
 * label lists the skills in it for exactly this reason). Side projects carry a
 * `detail`, because a project name says nothing a ranker can use.
 */
function embedTextFor(candidate: Candidate): string {
	return candidate.detail || candidate.label;
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
				: // Title and body are weighted differently by the scorer (title tokens
					// count double), so the name stays the title and the content becomes
					// the body — a project whose NAME matches still scores highest.
					scoreUnitAgainstQuery({ title: c.label, keywords: [], text: embedTextFor(c) }, query)
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
export interface ModelVerdict {
	/** "keep" or "drop", as the model said it. */
	action: string;
	reason: string;
}

export function applyModelOpinions(
	candidates: Candidate[],
	opinions: Array<{ ref: string; action: string; reason: string }>,
	floor: number
): { candidates: Candidate[]; verdicts: Map<string, ModelVerdict> } {
	const verdicts = new Map<string, ModelVerdict>();
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
		// The action is carried with the reason, not thrown away. A reason is only
		// worth printing next to a decision that agrees with it — see where these
		// are applied.
		const reason = text(opinion.reason);
		if (reason) verdicts.set(refFor(candidate), { action, reason });
	}

	return {
		candidates: candidates.map((c) => {
			const score = adjusted.get(refFor(c));
			return score === undefined ? c : { ...c, score };
		}),
		verdicts
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
/**
 * How much of an item's text the model sees per line. Enough for a project
 * summary (measured: 197-268 characters on this profile), short enough that
 * SHORTLIST_LIMIT lines stay a shortlist rather than a document.
 */
const SHORTLIST_DETAIL_CHARS = 300;

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
			// What it says, not what it is called. Asked to judge "LitState" against
			// a web-components job, the model called it a likely unrelated hobby
			// project; its summary names Lit web components in the first six words.
			const said = (c.detail || c.label).replace(/\s+/g, ' ');
			return `${refFor(c)} | ${said.slice(0, SHORTLIST_DETAIL_CHARS)} | ${c.score.toFixed(2)} | ${proposal}`;
		})
		.join('\n');
}

/**
 * Give each decision the model's wording — but only where the model AGREES with
 * what the document did.
 *
 * It does not have to agree. The page budget re-selects AFTER the model has
 * spoken, so a "keep" the model argued for can still lose its line for space,
 * and the row is then an exclusion carrying a sentence written to defend the
 * item. Measured on application 27: *"excluded — shows you ensured uptime and
 * performance of critical services, relevant to scaling SaaS backends"*, which
 * reads as the document arguing with itself.
 *
 * Where they disagree the deterministic reason stands, because it is the rule
 * that actually decided — "trimmed to fit the page — the least relevant line
 * left". Silence about the model's opinion is better than quoting it as though
 * it had won.
 */
export function applyVerdictReasons(
	decisions: Decision[],
	verdicts: Map<string, ModelVerdict>
): Decision[] {
	for (const decision of decisions) {
		const verdict = verdicts.get(refFor(decision));
		if (!verdict) continue;
		const agrees =
			decision.action === 'exclude' ? verdict.action === 'drop' : verdict.action === 'keep';
		if (agrees) decision.reason = verdict.reason;
	}
	return decisions;
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
	/**
	 * Presentation template the document will be SENT in, so the fit pass counts
	 * pages of the document that actually goes out rather than of the plain one.
	 *
	 * `null` means the default renderer. **Omit it** to fall back to what this
	 * application already records — the distinction matters, because a caller
	 * whose form carried no template must not silently claim "default" over a
	 * branded choice the applicant made earlier.
	 */
	template?: string | null;
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
	const template =
		opts.template !== undefined ? opts.template : (application.cv_template_sent ?? null);

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
	const built = buildCandidates(
		profile,
		docType,
		effectiveBase,
		requiredSkills,
		await conceptResolver(profile, requiredSkills)
	);
	await markCoverage(built, profile, requiredSkills);
	const { candidates, ranker, floor } = await scoreCandidates(profileId, built, query);

	// The reason carries the counter-argument when there is one: a keyword search
	// already finds "AWS" inside "AWS EC2", so this include is a judgement about
	// human readers, and the diff should let it be reviewed as one.
	const pinnedReason = (c: Candidate) =>
		c.carriedBy
			? `this job requires ${c.label} — “${c.carriedBy}” already carries the word`
			: `this job requires ${c.label}`;
	const otherLabel = docType === 'cv' ? 'resume' : 'CV';
	const groupDropReason = (c: Candidate) => {
		const count = c.label.split(':')[1]?.split(',').length ?? 0;
		return count > 0
			? `none of these ${count} skills is what this job asks for`
			: 'this job asks for none of the skills in this group';
	};
	// An old item that got here cleared a higher bar than a recent one, and the
	// applicant is the one who decided it was old news — so the row says which
	// judgement is being overruled, not just that something was added.
	const OLD_ENOUGH_TO_SAY = 0.5;
	const surfacedReason = (c: Candidate) => {
		const dated = (c.age ?? 0) >= OLD_ENOUGH_TO_SAY ? 'older work, but ' : '';
		if (c.profileOnly) {
			return `${dated}kept off your documents, and this job is about it`;
		}
		return c.templateHeldBack
			? `${dated}kept for your ${otherLabel} only, and it outranks what it displaces here`
			: `${dated}not on the version this builds on, and it outranks what it displaces here`;
	};
	// A restored role is the largest thing a run can do, so the row says what
	// bought it: the role names itself in the diff, and the bullet that earned
	// it is the part the applicant will want to check.
	const restoredParentReason = (child: Candidate) => {
		const bullet = child.label.split(': ').slice(1).join(': ') || child.label;
		return `on your ${otherLabel} version only, and this job asks about “${bullet}”`;
	};
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
		promotionMargin: PROMOTION_MARGIN[ranker],
		budgetChars,
		pinnedReason,
		surfacedReason,
		groupDropReason,
		restoredParentReason
	});

	// ── L3 ──
	let decisions = deterministic;
	let modelReviewed = false;
	let modelVerdicts = new Map<string, ModelVerdict>();
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
				modelVerdicts = applied.verdicts;
				selectionCandidates = applied.candidates;
				// Re-run the same selector: the model changed scores, not rules.
				decisions = selectForJob(applied.candidates, {
					floor,
					...DEFAULT_SELECTION,
					promotionMargin: PROMOTION_MARGIN[ranker],
					budgetChars,
					pinnedReason,
					surfacedReason,
					groupDropReason,
					restoredParentReason
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

	applyVerdictReasons(decisions, modelVerdicts);

	const versionId = await upsertTailoredVersion({
		profileId,
		applicationId,
		baseSlug: effectiveBase,
		jobTitle: text(job.title),
		company: text(job.company)
	});
	await persistDecisions(versionId, decisions);

	// When this document's decisions were made — the other half of "your profile
	// changed since this was built".
	//
	// Stamped by a RUN and by nothing else. A hand toggle also writes to this
	// version, but it re-decides one item; everything the run concluded about
	// the rest is exactly as old as it was, so treating a toggle as "rebuilt"
	// would retire the notice without doing the work it asks for.
	await db
		.update(profile_versions)
		.set({ date_updated: new Date() })
		.where(eq(profile_versions.id, versionId));

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
		template,
		candidates: selectionCandidates,
		targetPages,
		budgetChars,
		fallback: targetPages === 1 ? { targetPages: 2, budgetChars: PAGE_BUDGETS.two } : null,
		select: (budget) =>
			selectForJob(selectionCandidates, {
				floor,
				...DEFAULT_SELECTION,
				promotionMargin: PROMOTION_MARGIN[ranker],
				budgetChars: budget,
				pinnedReason,
				surfacedReason,
				groupDropReason,
				restoredParentReason
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
 * Normalised skill name → the concept slug it resolves to, for every name this
 * run might compare: the job's required skills and the applicant's own.
 *
 * One query, resolved through `resolveConcepts`, which already knows both slugs
 * and approved aliases. It exists so `buildCandidates` can stay synchronous
 * while still asking a question only the database can answer.
 *
 * Empty on failure, and an empty map means the pin check compares spellings —
 * the behaviour before the graph was consulted at all.
 */
async function conceptResolver(
	profile: { tech_skill_categories?: { tech_skills?: { name?: unknown }[] }[] },
	requiredSkills: string[]
): Promise<Map<string, string>> {
	const names = [
		...requiredSkills,
		...(profile.tech_skill_categories ?? []).flatMap((c) =>
			(c.tech_skills ?? []).map((s) => text(s.name))
		)
	].filter(Boolean);
	try {
		const resolved = await resolveConcepts(names);
		return new Map([...resolved].map(([key, concept]) => [key, concept.slug]));
	} catch (err) {
		console.warn('[tailor] concepts unresolved, pinning compares spellings only:', err);
		return new Map();
	}
}

/**
 * Record, on each candidate, which of the job's required skills its own words
 * name — directly, or through the skill graph.
 *
 * ## Why the ranker cannot do this
 *
 * L1 scores how much an item READS LIKE the posting. That is the right question
 * for prose and the wrong one for a name: this job's posting is in Dutch and
 * about knowledge graphs, and the bullet *"Scaled the platform to thousands of
 * orders per minute by optimizing SQL & Python"* reads nothing like it — while
 * containing two entries from the job's own required list, spelled the same way
 * the job spells them. Cosine had no way to notice and the page budget trimmed
 * it. Naming what was asked for is a different kind of evidence from sounding
 * like it, and it needed its own pass.
 *
 * ## Why the graph, and which one
 *
 * A job requiring `SQL` is answered by a line naming `PostgreSQL`, and only the
 * ontology knows that. `expandUpwardBySeed` — upward only, keyed by which skill
 * reached what — is the traversal for it: coverage is the MATCH question, so the
 * `related` hop stays out. A MariaDB line is a reasonable suggestion for a MySQL
 * job and not an answer to a MySQL requirement.
 *
 * Degrades to the literal reading if the graph cannot be reached; a bullet that
 * spells the requirement out is still found.
 */
async function markCoverage(
	candidates: Candidate[],
	profile: { tech_skill_categories?: { tech_skills?: { name?: unknown }[] }[] },
	requiredSkills: string[]
): Promise<void> {
	if (requiredSkills.length === 0) return;

	// Required skill → the wordings that answer it. The requirement's own
	// spelling is always one of them, which is what survives a graph failure.
	const answers = new Map<string, Set<string>>(requiredSkills.map((r) => [r, new Set([r])]));

	const held = [
		...new Set(
			(profile.tech_skill_categories ?? [])
				.flatMap((c) => (c.tech_skills ?? []).map((s) => text(s.name)))
				.filter(Boolean)
		)
	];
	try {
		const reach = await expandUpwardBySeed(held);
		const wanted = new Map(requiredSkills.map((r) => [normalizeSkill(r), r]));
		for (const name of held) {
			for (const c of reach.get(normalizeSkill(name)) ?? []) {
				const req = wanted.get(c.slug);
				if (req) answers.get(req)?.add(name);
			}
		}
	} catch (err) {
		console.warn('[tailor] skill graph unreachable, coverage falls back to literal names:', err);
	}

	for (const candidate of candidates) {
		// The label carries a bullet's text; detail carries a project's summary.
		const said = `${candidate.label} ${candidate.detail ?? ''}`;
		const named = [...answers]
			.filter(([, wordings]) => [...wordings].some((w) => carriesName(w, said)))
			.map(([req]) => req);
		if (named.length > 0) candidate.covers = named;
	}
}

/**
 * Re-select and re-render until the version fits its page target — and then
 * until it fills it.
 *
 * A run that cannot reach the target falls back to the LARGER one and selects
 * again for it — not to its own first attempt, which was already trimmed for a
 * page it never reached. Half a career removed in pursuit of a page that stayed
 * two is the worst of both, and it is the outcome measuring was meant to end.
 *
 * The walk back up exists for the mirror image of that. `tightenBudget`
 * overshoots deliberately, so the budget that first fits is well under the
 * largest that would have, and "fits" was the only question asked. On one
 * tailored version that produced two pages whose second held 32 rendered lines
 * against a full page's 53 — thirteen achievements dropped to buy whitespace,
 * on a document whose whole purpose is to be read by a person and scanned by a
 * matcher. Both want the page used.
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
	/** Rendered in this template, because page height is a property of it. */
	template: string | null;
	targetPages: number;
	budgetChars: number;
	/** The roomier target to settle for. Null when already at the roomiest. */
	fallback: { targetPages: number; budgetChars: number } | null;
	select: (budget: number) => Decision[];
	/** What the selection ran over, so the tail pass can value what it cut. */
	candidates: Candidate[];
}): Promise<{ decisions: Decision[] | null; pages: number | null; targetPages: number }> {
	const { profileId, versionId, versionSlug, docType, template, targetPages } = opts;
	const count = () => countVersionPages(profileId, versionSlug, docType, template);

	let budget = opts.budgetChars;
	let pages = await count();

	for (
		let attempt = 1;
		attempt < FIT_ATTEMPTS && pages !== null && pages > targetPages;
		attempt++
	) {
		// The loop only runs while the document is too long, and `pages` was
		// measured at this budget — so on entry it is by definition the budget that
		// overflowed, which is the upper bound the walk back up needs.
		const overflowing = budget;
		budget = tightenBudget(budget, pages, targetPages);
		const tighter = opts.select(budget);
		await persistDecisions(versionId, tighter);
		pages = await count();
		if (pages !== null && pages <= targetPages) {
			const loosened = await loosenToFill(opts, count, {
				fits: { budget, decisions: tighter, pages },
				overflowing
			});
			const filled = await restoreTail(versionId, opts.candidates, count, targetPages, loosened);
			return { ...filled, targetPages: loosened.targetPages };
		}
	}

	if (pages !== null && pages > targetPages && opts.fallback) {
		const full = opts.select(opts.fallback.budgetChars);
		await persistDecisions(versionId, full);
		return { decisions: full, pages: await count(), targetPages: opts.fallback.targetPages };
	}

	// Fit on the first measurement, so nothing was tightened — but the selector
	// still trimmed to the budget it was handed, and that budget is a character
	// count guessing at a page. Re-deriving the standing selection is free: the
	// same pure call over the same candidates the caller already persisted.
	if (pages !== null && pages <= targetPages) {
		const standing = opts.select(opts.budgetChars);
		const filled = await restoreTail(versionId, opts.candidates, count, targetPages, {
			decisions: standing,
			pages
		});
		return { ...filled, targetPages };
	}

	return { decisions: null, pages, targetPages };
}

/**
 * Put single dropped items back until the page will not take another.
 *
 * The budget cannot do this. `selectForJob` re-runs from scratch at each one, so
 * a larger budget can restore a whole role — header, dates, TECH list, every
 * child it hides — and the smallest thing a budget can buy is that block. On one
 * tailored version the largest budget that fits and the smallest that does not
 * sat one bullet apart, with page two 72% full between them. This works on the
 * finished selection instead, at the grain of the leftovers.
 *
 * ## Only un-excluding
 *
 * It restores by DELETING an exclude row, never by adding an include. That is a
 * deliberate limit and it buys the honest version of this feature: a decision
 * carries a reason the applicant reads, and "the selector kept this" and "a
 * later pass put it back" are different claims that would need different
 * wording. Removing a row makes no claim at all — the document simply agrees
 * with the version it is built on again, and the diff gets shorter rather than
 * more confusing. Everything the trim took is reachable this way, because the
 * trim takes by excluding.
 *
 * ## Order
 *
 * Requirements with no evidence left on the page first, then by relevance. By
 * score alone this fills the page with whatever ranked next; uncovered-first
 * finishes the job the coverage guarantee starts, which is putting evidence on
 * the page rather than only keeping it there.
 */
async function restoreTail(
	versionId: number,
	candidates: Candidate[],
	count: () => Promise<number | null>,
	targetPages: number,
	settled: { decisions: Decision[]; pages: number | null }
): Promise<{ decisions: Decision[]; pages: number | null }> {
	const key = (d: { entityType: string; entityId: number }) => `${d.entityType}:${d.entityId}`;
	const byKey = new Map(candidates.map((c) => [key(c), c]));
	const excluded = settled.decisions.filter((d) => d.action === 'exclude');
	if (excluded.length === 0) return settled;

	// What the page still says, so "uncovered" means uncovered on the document
	// rather than uncovered in the profile.
	const gone = new Set(excluded.map(key));
	const covered = new Set(
		candidates.filter((c) => !gone.has(key(c))).flatMap((c) => c.covers ?? [])
	);
	const value = (c: Candidate | undefined) => (c?.covers?.some((req) => !covered.has(req)) ? 1 : 0);

	const queue = excluded
		.map((d) => ({ row: d, candidate: byKey.get(key(d)) }))
		.filter((x) => x.candidate)
		.sort(
			(a, z) =>
				value(z.candidate) - value(a.candidate) ||
				(z.candidate?.score ?? 0) - (a.candidate?.score ?? 0)
		);

	let kept = settled.decisions;
	let pages = settled.pages;
	let persisted = kept;
	let misses = 0;

	for (
		let attempt = 0;
		attempt < TAIL_RESTORE_ATTEMPTS && misses < TAIL_RESTORE_MISSES;
		attempt++
	) {
		const next = queue.shift();
		if (!next) break;
		const trial = kept.filter((d) => d !== next.row);
		await persistDecisions(versionId, trial);
		persisted = trial;
		const p = await count();
		if (p !== null && p <= targetPages) {
			kept = trial;
			pages = p;
			misses = 0;
			// Its coverage now counts, so the next item is valued against a page
			// that already says this.
			for (const req of next.candidate?.covers ?? []) covered.add(req);
		} else {
			// Includes a null count, for the same reason the loosen pass treats one
			// as overflow: an unanswerable render is not evidence that more fits.
			misses++;
		}
	}

	if (persisted !== kept) await persistDecisions(versionId, kept);
	return { decisions: kept, pages };
}

/**
 * Bisect between the budget that fits and the one that overflowed, keeping the
 * largest that still fits.
 *
 * Rank order is what makes this safe to do blind: `select` at a larger budget
 * restores the next-most-relevant items, never arbitrary ones, so a bigger
 * document here is a strictly better-informed one rather than merely a fuller
 * page.
 *
 * The persisted decisions are always the best ones seen. A probe that overflows
 * writes its selection to the database on the way past, so the winner is
 * re-persisted before returning — otherwise the document left standing is the
 * one that did not fit.
 */
async function loosenToFill(
	opts: { versionId: number; targetPages: number; select: (budget: number) => Decision[] },
	count: () => Promise<number | null>,
	start: {
		fits: { budget: number; decisions: Decision[]; pages: number };
		overflowing: number;
	}
): Promise<{ decisions: Decision[]; pages: number | null; targetPages: number }> {
	const { versionId, targetPages } = opts;
	let lo = start.fits.budget;
	let hi = start.overflowing;
	let best = start.fits;
	let persisted = lo;

	for (let attempt = 0; attempt < LOOSEN_ATTEMPTS && hi - lo > LOOSEN_EPSILON; attempt++) {
		const mid = Math.round((lo + hi) / 2);
		const candidate = opts.select(mid);
		await persistDecisions(versionId, candidate);
		persisted = mid;
		const pages = await count();
		if (pages !== null && pages <= targetPages) {
			lo = mid;
			best = { budget: mid, decisions: candidate, pages };
		} else {
			// Includes a null count: an unanswerable render is not evidence that a
			// roomier document fits, and treating it as one would ship the overflow.
			hi = mid;
		}
	}

	if (persisted !== best.budget) await persistDecisions(versionId, best.decisions);
	return { decisions: best.decisions, pages: best.pages, targetPages };
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

	// One more round-trip, for the roles: a bullet needs the role it sits under
	// to be identifiable, and a run can now decide about a role itself — the
	// biggest change it can make, and the one that would have gone unlisted,
	// because a row with no label is dropped at the end of this function.
	const roleIds = [
		...new Set([
			...achievements.map((a) => a.work_experience_id).filter(Boolean),
			...idsOf(OVERRIDE_ENTITIES.workExperience)
		])
	];
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
	for (const role of roles) {
		const label = roleLabels.get(role.id);
		if (label) labels.set(`${OVERRIDE_ENTITIES.workExperience}:${role.id}`, label);
	}
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
 * A container this document does not print, holding work that speaks to this
 * job — and that no amount of tailoring will reach, because turning it on is
 * not a decision a run gets to make.
 */
export interface HeldBackParent {
	entityType: string;
	entityId: number;
	label: string;
	/** Relevant items it holds that this document cannot print. */
	count: number;
	/** `template` — "CV only" here. `profile` — off every document. */
	reason: 'template' | 'profile';
}

/**
 * What one scoring pass can say about every candidate document: the relevant
 * things it leaves out, what is out of reach entirely, and which containers are
 * holding that.
 *
 * Three answers rather than one because they are read by three parts of the
 * page — the warning about the document being sent, the ranking of the versions
 * offered as a base, and the strip that names the roles worth turning on — and
 * because all three fall out of the same scoring pass.
 */
export interface VersionReach {
	exclusions: Record<string, ExcludedItem[]>;
	outOfReach: Record<string, number>;
	heldBackParents: Record<string, HeldBackParent[]>;
}

const EMPTY_REACH: VersionReach = { exclusions: {}, outOfReach: {}, heldBackParents: {} };

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
}): Promise<VersionReach> {
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
	if (!job) return EMPTY_REACH;

	const profile = await getProfileByIdentifier(profileId);
	if (!profile) return EMPTY_REACH;

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
	if (!query.text && query.skills.length === 0) return EMPTY_REACH;

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
	const outOfReach: Record<string, number> = {};
	const heldBackParents: Record<string, HeldBackParent[]> = {};
	const roleLabels = new Map(
		(profile.work_experiences ?? []).map((role) => [
			role.id,
			[text(role.position), text(role.name)].filter(Boolean).join(' at ') || `role ${role.id}`
		])
	);
	for (const docType of BASE_TEMPLATE_TAGS) {
		for (const versionSlug of versionSlugs) {
			const built = buildCandidates(profile, docType, versionSlug, requiredSkills).filter((c) =>
				DROPPABLE_ENTITIES.includes(c.entityType)
			);
			const scored = built.map((c) => ({
				...c,
				score: scoreOf.get(`${c.entityType}:${c.entityId}`) ?? 0
			}));

			// The same bar AND the same eligibility test the generator surfaces on,
			// from the same functions: this warning is what tells the applicant a
			// version is leaving out proof, and the two would be worth nothing if
			// they disagreed about which. They did disagree, on parent visibility —
			// see canSurface.
			const bar = surfaceBar(scored, floor);
			const decided = decidedAgainst.get(versionSlug) ?? new Set<string>();

			const excluded = scored
				.filter((c) => canSurface(c) && !decided.has(`${c.entityType}:${c.entityId}`))
				.filter((c) => surfaceScore(c, floor) >= bar)
				.sort((a, z) => surfaceScore(z, floor) - surfaceScore(a, floor))
				.slice(0, MAX_EXCLUSIONS_REPORTED)
				.map((c) => ({
					entityType: c.entityType,
					entityId: c.entityId,
					label: c.label,
					score: c.score
				}));

			if (excluded.length > 0) result[hiddenSkillsKey(docType, versionSlug)] = excluded;

			// The exact complement of the warning above, and the reason it is worth
			// computing here rather than anywhere else: `canBringBack` is what a run
			// may show, so everything it turns down is what THIS base can never be
			// talked into showing. One scoring pass answers both questions.
			//
			// An alternative write-up is NOT counted. Its bullets are unreachable in
			// the same literal sense, but the job they describe is on the page
			// already under the other write-up, so counting them would mark a base
			// down for a loss the reader cannot see.
			// Same bar as the warning above, and the rule itself lives in
			// $lib/tailoring next to the two it has to stay consistent with.
			const stranded = scored.filter((c) => beyondReach(c, floor, bar));
			if (stranded.length > 0) {
				const key = hiddenSkillsKey(docType, versionSlug);
				outOfReach[key] = stranded.length;
				const byParent = new Map<number, HeldBackParent>();
				for (const item of stranded) {
					if (item.parentId === null || !item.parentType) continue;
					const existing = byParent.get(item.parentId);
					if (existing) {
						existing.count += 1;
						continue;
					}
					byParent.set(item.parentId, {
						entityType: item.parentType,
						entityId: item.parentId,
						label: roleLabels.get(item.parentId) ?? `role ${item.parentId}`,
						count: 1,
						reason: item.parentHeldBack === 'profile' ? 'profile' : 'template'
					});
				}
				heldBackParents[key] = [...byParent.values()].sort((a, z) => z.count - a.count);
			}
		}
	}

	return { exclusions: result, outOfReach, heldBackParents };
}

/** How an override row is keyed: entity ids are per table, so the type is part of it. */
function refKey(candidate: Pick<Candidate, 'entityType' | 'entityId'>): string {
	return `${candidate.entityType}:${candidate.entityId}`;
}

function yearOf(value: unknown): string {
	const raw = value instanceof Date ? value.toISOString() : text(value);
	return raw.slice(0, 4);
}

/**
 * Every item a document could print, with whether it does and why.
 *
 * The diff answers "what did tailoring change"; this answers "what is on it",
 * which is the question you have to answer to change something tailoring did
 * NOT decide about. Those were unreachable: an item nobody surfaced and nobody
 * dropped left no row anywhere, so the only way to reach it was to go and edit
 * the tags on your profile — which changes every job that uses that version,
 * the one thing a per-job document exists to avoid.
 *
 * It reads the same three layers the renderer does, in the same order, through
 * the same filter: the item's tags, the version's, and the override sidecar.
 * Nothing here re-derives visibility — a panel that disagreed with the document
 * would be worse than no panel.
 */
export async function versionItemStates(opts: {
	profileId: number;
	applicationId: number | null;
	docType: string;
	versionSlug: string;
}): Promise<ItemGroup[]> {
	const { profileId, applicationId, docType, versionSlug } = opts;

	const profile = await getProfileByIdentifier(profileId);
	if (!profile) return [];

	// The job is optional: without one there are no scores and no required
	// skills, and the panel is still the only place to see what prints.
	const application = applicationId
		? await db.query.applications.findFirst({
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
			})
		: null;
	const job = application?.job ?? null;
	const requiredSkills = job ? asStringArray(job.skills_required) : [];

	const built = buildCandidates(profile, docType, versionSlug, requiredSkills);

	let scoreOf = new Map<string, number>();
	if (job) {
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
		if (query.text || query.skills.length > 0) {
			const { candidates } = await scoreCandidates(
				profileId,
				buildCandidates(profile, 'resume', '', requiredSkills),
				query,
				{ unitType: 'job_query', unitId: job.id }
			);
			scoreOf = new Map(candidates.map((c) => [refKey(c), c.score]));
		}
	}

	// What the override sidecar says, so a row can name who decided and why.
	// Only a version that HAS one — a library version's items are all "base".
	const version = await db.query.profile_versions.findFirst({
		where: and(eq(profile_versions.profile_id, profileId), eq(profile_versions.slug, versionSlug)),
		columns: { id: true }
	});
	const overrides = version
		? await db.query.profile_version_overrides.findMany({
				where: eq(profile_version_overrides.version_id, version.id),
				columns: { entity_type: true, entity_id: true, action: true, reason: true, source: true }
			})
		: [];
	const overrideOf = new Map(overrides.map((o) => [`${o.entity_type}:${o.entity_id}`, o]));

	function describe(candidate: Candidate, stripPrefix = ''): ItemRow {
		const key = refKey(candidate);
		const override = overrideOf.get(key);
		const row: ItemRow = {
			entityType: candidate.entityType,
			entityId: candidate.entityId,
			// The group already names the role; repeating it in every row is noise.
			label:
				stripPrefix && candidate.label.startsWith(`${stripPrefix}: `)
					? candidate.label.slice(stripPrefix.length + 2)
					: candidate.label,
			on: candidate.visible,
			reason: '',
			source: 'base',
			score: scoreOf.get(key) ?? null
		};
		if (override) {
			row.source = override.source === 'user' ? 'user' : 'tailoring';
			row.reason = text(override.reason);
			return row;
		}
		// No override: the tags decided, and which tag it was changes what the
		// applicant would do about it. Except when the parent is what holds it
		// back — the group says that once, and repeating it per row would name the
		// wrong tag as well as the wrong fix.
		if (!candidate.visible && candidate.parentVisible !== false) {
			row.reason = candidate.templateHeldBack
				? `only on your ${docType === 'cv' ? 'resume' : 'CV'}`
				: 'not on this version';
		}
		return row;
	}

	// Role visibility through the same filter buildCandidates uses. A role with
	// no achievements produces no candidates, so it cannot be read off them.
	const { filterOnTags } = createProfileFilter(
		(profile.profile_versions ?? []) as never,
		docType,
		null,
		versionSlug
	);
	const visibleRoles = new Set(
		filterOnTags(profile.work_experiences ?? [], OVERRIDE_ENTITIES.workExperience).map((w) => w.id)
	);

	const byParent = new Map<number, Candidate[]>();
	for (const candidate of built) {
		if (candidate.entityType !== OVERRIDE_ENTITIES.achievement) continue;
		if (candidate.parentId === null) continue;
		const list = byParent.get(candidate.parentId) ?? [];
		list.push(candidate);
		byParent.set(candidate.parentId, list);
	}

	const groups: ItemGroup[] = [];
	for (const role of profile.work_experiences ?? []) {
		const title = [role.position, role.name].filter(Boolean).join(' at ') || `role ${role.id}`;
		const rows = (byParent.get(role.id) ?? []).map((c) => describe(c, title));
		if (rows.length === 0 && visibleRoles.has(role.id)) continue;
		groups.push({
			key: `${OVERRIDE_ENTITIES.workExperience}:${role.id}`,
			entityType: OVERRIDE_ENTITIES.workExperience,
			entityId: role.id,
			title,
			subtitle:
				[yearOf(role.start_date), role.end_date ? yearOf(role.end_date) : 'now']
					.filter(Boolean)
					.join(' – ') || null,
			on: visibleRoles.has(role.id),
			rows
		});
	}

	const projects = built.filter((c) => c.entityType === OVERRIDE_ENTITIES.sideProject);
	if (projects.length > 0) {
		groups.push({
			key: 'side-projects',
			entityType: null,
			entityId: null,
			title: 'Side projects',
			subtitle: null,
			on: true,
			rows: projects.map((c) => describe(c))
		});
	}

	return groups;
}

/**
 * Show or hide one item on this application's version, creating that version if
 * it does not exist yet.
 *
 * Creating on demand is the point. Noticing that the version you picked leaves
 * out a bullet your CV has, and wanting it for this one job, IS tailoring —
 * asking someone to first generate a tailored version and then find the same
 * item again in its diff made a two-step ceremony out of one intent. The
 * version it makes here holds nothing but the change asked for; a later run
 * fills in the rest without touching it, because this is recorded as the
 * applicant's own.
 *
 * An override is only written when the answer differs from what the base
 * already does. Setting something back to the base's own answer deletes the row
 * instead, so the sidecar stays a diff and a later regeneration is free to
 * decide about that item again.
 */
export async function setItemStateForApplication(opts: {
	profileId: number;
	applicationId: number;
	docType: string;
	baseSlug: string;
	entityType: string;
	entityId: number;
	on: boolean;
}): Promise<{ versionSlug: string; created: boolean }> {
	const { profileId, applicationId, docType, baseSlug, entityType, entityId, on } = opts;

	const profile = await getProfileByIdentifier(profileId);
	if (!profile) throw new Error('Profile not found');

	const application = await db.query.applications.findFirst({
		where: and(eq(applications.id, applicationId), eq(applications.profile_id, profileId)),
		with: { job: { columns: { title: true, company: true } } }
	});
	if (!application) throw new Error('Application not found');

	const existing = await db.query.profile_versions.findFirst({
		where: and(
			eq(profile_versions.profile_id, profileId),
			eq(profile_versions.application_id, applicationId)
		),
		columns: { id: true, slug: true }
	});

	const versionId =
		existing?.id ??
		(await upsertTailoredVersion({
			profileId,
			applicationId,
			baseSlug,
			jobTitle: text(application.job?.title),
			company: text(application.job?.company)
		}));
	const versionSlug = existing?.slug ?? tailoredSlugFor(applicationId);

	// What the version this one extends does about it, so an override is only
	// written for a genuine difference. A role is not a candidate — nothing may
	// drop one — so its visibility comes from the filter directly.
	const baseVisible =
		entityType === OVERRIDE_ENTITIES.workExperience
			? createProfileFilter((profile.profile_versions ?? []) as never, docType, null, baseSlug)
					.filterOnTags(profile.work_experiences ?? [], OVERRIDE_ENTITIES.workExperience)
					.some((w) => w.id === entityId)
			: (buildCandidates(profile, docType, baseSlug, []).find(
					(c) => c.entityType === entityType && c.entityId === entityId
				)?.visible ?? false);

	if (on === baseVisible) {
		await db
			.delete(profile_version_overrides)
			.where(
				and(
					eq(profile_version_overrides.version_id, versionId),
					eq(profile_version_overrides.entity_type, entityType),
					eq(profile_version_overrides.entity_id, entityId)
				)
			);
		return { versionSlug, created: !existing };
	}

	const now = new Date();
	const action = on ? 'include' : 'exclude';
	const reason = on ? 'you chose to show this' : 'you chose to hide this';
	await db
		.insert(profile_version_overrides)
		.values({
			version_id: versionId,
			entity_type: entityType,
			entity_id: entityId,
			action,
			reason,
			source: 'user',
			date_created: now,
			date_updated: now
		})
		.onConflictDoUpdate({
			target: [
				profile_version_overrides.version_id,
				profile_version_overrides.entity_type,
				profile_version_overrides.entity_id
			],
			set: { action, sort: null, reason, source: 'user', date_updated: now }
		});

	return { versionSlug, created: !existing };
}
