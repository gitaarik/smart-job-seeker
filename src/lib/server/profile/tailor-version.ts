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
	side_projects,
	tech_skills,
	work_experience_achievements,
	work_experiences
} from '$lib/server/db/schema';
import { getProfileByIdentifier } from '$lib/server/profile/default';
import { createProfileFilter } from '$lib/components/ProfileDisplay/profile-filter';
import { isTailoredSlug, OVERRIDE_ENTITIES, tailoredSlugFor } from '$lib/version-overrides';
import {
	DEFAULT_SELECTION,
	DROPPABLE_ENTITIES,
	selectForJob,
	type Candidate,
	type Decision
} from '$lib/tailoring';
import { hiddenSkillsKey } from '$lib/version-coverage';
import { BASE_TEMPLATE_TAGS, renameTagSlug, tagSlug } from '$lib/profile-visibility';
import {
	semanticScoreUnits,
	poolKey,
	type ContentUnit
} from '$lib/server/documents/content-embeddings';
import { scoreUnitAgainstQuery } from '$lib/server/documents/content-retrieval';
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
}

type ProfileRow = NonNullable<Awaited<ReturnType<typeof getProfileByIdentifier>>>;

function text(value: unknown): string {
	return typeof value === 'string' ? value.trim() : '';
}

function asStringArray(value: unknown): string[] {
	return Array.isArray(value) ? value.filter((v): v is string => typeof v === 'string') : [];
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
	const printedNames = new Set<string>();
	for (const category of profile.tech_skill_categories ?? []) {
		const visibleSkills = new Set(
			filterOnTags(category.tech_skills ?? [], OVERRIDE_ENTITIES.skill).map((s) => s.id)
		);
		visibleSkillsByCategory.set(category.id, visibleSkills);
		if (!visibleCategories.has(category.id)) continue;
		for (const skill of category.tech_skills ?? []) {
			const name = text(skill.name);
			if (name && visibleSkills.has(skill.id)) printedNames.add(name.toLowerCase());
		}
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
				pinned: true,
				score: 1
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

	const built = buildCandidates(profile, docType, baseSlug, requiredSkills);
	const { candidates, ranker, floor } = await scoreCandidates(profileId, built, query);

	const pinnedReason = (c: Candidate) => `this job requires ${c.label}`;
	const deterministic = selectForJob(candidates, {
		floor,
		...DEFAULT_SELECTION,
		pinnedReason
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
				// Re-run the same selector: the model changed scores, not rules.
				decisions = selectForJob(applied.candidates, {
					floor,
					...DEFAULT_SELECTION,
					pinnedReason
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
		baseSlug,
		jobTitle: text(job.title),
		company: text(job.company)
	});
	await persistDecisions(versionId, decisions);

	const version = await db.query.profile_versions.findFirst({
		where: eq(profile_versions.id, versionId),
		columns: { slug: true, name: true }
	});

	return {
		versionId,
		versionSlug: version?.slug ?? tailoredSlugFor(applicationId),
		versionName: version?.name ?? 'Tailored version',
		decisions,
		ranker,
		modelReviewed
	};
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

	const [achievements, projects, skills] = await Promise.all([
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

			// Relative, not absolute. An embedding floor tuned for retrieval says
			// "somewhat related to this job", which most of a career is — flagging
			// on that produces a list, not a warning. The question worth raising is
			// comparative: is this document leaving out something MORE relevant
			// than half of what it prints? That calibrates itself per document and
			// per job, and it says nothing when the selection is already sensible.
			const visibleScores = scored
				.filter((c) => c.visible)
				.map((c) => c.score)
				.sort((a, z) => a - z);
			const median = visibleScores.length
				? visibleScores[Math.floor(visibleScores.length / 2)]
				: floor;
			const bar = Math.max(floor, median);
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
