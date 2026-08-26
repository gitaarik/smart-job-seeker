/**
 * Project ↔ job relevance retrieval.
 *
 * Ranks the applicant's ACTUAL projects — their work-experience projects and
 * side (personal) projects — against a job, so a cover letter / application
 * answer cites only the ones that fit. Each project is scored on BOTH what the
 * user typed (name, description, outcome, technologies, achievements) AND what
 * any attached source/docs revealed (the uploaded documents' summary +
 * keywords). This unifies the two signals instead of ranking uploaded files as
 * a separate list.
 *
 * Two rankers, one interface:
 *  - SEMANTIC (embedding cosine) when SJS_EMBEDDING_ENABLED is on — genuine RAG,
 *    catches paraphrase/synonym fit. See project-embeddings.ts.
 *  - DETERMINISTIC (keyword/skill overlap), which always works, so retrieval
 *    survives embeddings being unconfigured or the provider failing.
 * Both produce the same RankableProject shape, cited by name.
 *
 * Ahead of the deterministic ranker, each project's own skills are widened
 * upward through the skill graph (widenProjectKeywords) — the retrieval half of
 * GraphRAG. A Svelte project reaches "frontend", so a job written in general
 * terms finds it, and the ranker itself knows no graph exists.
 * See planning/SEMANTIC-MATCHING-AND-RAG.md.
 *
 * The two are a UNION rather than a fallback, and that distinction is the whole
 * value of the graph here. As a fallback the widened ranker ran only when
 * embeddings were off or the floor cleared nobody — so with embeddings on, which
 * is the normal case, the graph affected no request at all. `withGraphPick` now
 * gives it the last of the K slots on every request, bounded to exactly one so
 * the change is measurable and reversible.
 */

import { dbDirect as db } from '$lib/server/db';
import { eq } from 'drizzle-orm';
import { side_projects, work_experiences } from '$lib/server/db/schema';
import { config } from '$lib/server/config';
import { type EmbeddableUnit, projectKey, semanticScoreProjects } from './project-embeddings';
import { expandForRetrieval } from '$lib/server/job/skill-ontology';
import { normalizeSkill } from '$lib/skills';
import { profile_document_projects } from '$lib/server/db/schema';

export interface JobLike {
	title?: string | null;
	job_description?: string | null;
	skills_required?: string[] | null;
}

/** A project (typed + doc-enriched) that can be ranked against a job. */
export interface RankableProject {
	/** Set when the caller named this project rather than the ranker finding it. */
	pinned?: boolean;
	/**
	 * Set when the graph-widened ranker put this here and semantic ranking had
	 * not. Deliberately NOT shown to the model — it is for measuring whether the
	 * union earns its query, which is otherwise unanswerable from the outside.
	 */
	viaGraph?: boolean;
	kind: 'side_project' | 'work_experience_project';
	id: number;
	title: string;
	/** e.g. "at Acme Corp" for a work-experience project; "" for a side project. */
	context: string;
	/** Technologies (typed) ∪ attached-document keywords — for skill matching. */
	keywords: string[];
	/** Description / outcome / achievements prose — for text matching. */
	text: string;
	/** The rich blurb handed to the writer to cite (typed data + doc summaries). */
	citation: string;
	/**
	 * ONLY the attachment-derived evidence (uploaded doc / repo summaries +
	 * keywords), for match scoring — the part the profile blob doesn't already
	 * carry. "" when the project has no attachments.
	 */
	docEvidence?: string;
}

/** Normalize for loose token matching; keep tech chars like + # . */
function norm(s: string): string {
	return s
		.toLowerCase()
		.replace(/[^a-z0-9+#. ]/g, ' ')
		.replace(/\s+/g, ' ')
		.trim();
}

/**
 * Overlap score of one project against a job. An explicit required-skill match
 * (via a technology or doc keyword) weighs most; a job skill merely appearing
 * in the project's own prose also counts. Pure — unit-testable.
 */
export function scoreProjectAgainstJob(
	project: { keywords: string[]; text?: string },
	job: JobLike
): number {
	const jobSkills = (job.skills_required ?? []).map(norm).filter(Boolean);
	const jobText = norm(
		[job.title, job.job_description, ...(job.skills_required ?? [])].filter(Boolean).join(' ')
	);

	let score = 0;
	for (const raw of project.keywords ?? []) {
		const kw = norm(raw);
		if (kw.length < 2) continue;
		const skillMatch = jobSkills.some(
			(s) => s === kw || (kw.length >= 3 && s.includes(kw)) || (s.length >= 3 && kw.includes(s))
		);
		if (skillMatch) {
			score += 3;
			continue;
		}
		if (kw.length >= 3 && jobText.includes(kw)) score += 1;
	}
	// A required skill mentioned in the project's own prose also counts.
	if (project.text) {
		const ptext = norm(project.text);
		for (const s of jobSkills) {
			if (s.length >= 3 && ptext.includes(s)) score += 1;
		}
	}
	return score;
}

/** Rank projects by relevance to a job; drop zero-score, take top K. Pure. */
export function rankProjects<T extends { keywords: string[]; text?: string }>(
	projects: T[],
	job: JobLike,
	k = 3
): (T & { score: number })[] {
	return projects
		.map((p) => ({ ...p, score: scoreProjectAgainstJob(p, job) }))
		.filter((p) => p.score > 0)
		.sort((a, b) => b.score - a.score)
		.slice(0, k);
}

const clip = (s: string, n: number): string => (s.length > n ? s.slice(0, n).trimEnd() + '…' : s);

function asStrings(v: unknown): string[] {
	return Array.isArray(v) ? v.filter((x): x is string => typeof x === 'string') : [];
}

function dedupe(arr: string[]): string[] {
	const seen = new Set<string>();
	const out: string[] = [];
	for (const s of arr) {
		const t = s.trim();
		const key = t.toLowerCase();
		if (t && !seen.has(key)) {
			seen.add(key);
			out.push(t);
		}
	}
	return out;
}

function buildCitation(description: string, docSummaries: string[], techs: string[]): string {
	const parts: string[] = [];
	if (description.trim()) parts.push(description.trim());
	if (docSummaries.length) parts.push(docSummaries.join(' '));
	if (techs.length) parts.push(`Technologies: ${techs.join(', ')}.`);
	return clip(parts.join(' ').trim(), 800);
}

/** One attached document/repo, reduced to what retrieval needs. */
export interface DocRow {
	id: number;
	title: string | null;
	original_filename: string | null;
	summary: string | null;
	keywords: unknown;
}

/**
 * Embed text for a project's OWN typed data (no attachment content — each
 * attachment is embedded as its own unit). Clipped generously; providers
 * truncate long inputs anyway.
 */
function buildTypedEmbedText(
	title: string,
	context: string,
	description: string,
	techs: string[]
): string {
	return clip(
		[title, context, description, techs.join(', ')]
			.map((s) => s.trim())
			.filter(Boolean)
			.join('\n'),
		8000
	);
}

/** Embed text for a single attachment (its label + summary + keywords). */
function buildAttachmentEmbedText(projectTitle: string, doc: DocRow): string {
	const label = doc.title?.trim() || doc.original_filename?.trim() || '';
	return clip(
		[projectTitle, label, doc.summary ?? '', asStrings(doc.keywords).join(', ')]
			.map((s) => s.trim())
			.filter(Boolean)
			.join('\n'),
		8000
	);
}

/**
 * The attachment-only evidence for a project (summaries + keywords), for match
 * scoring. Excludes typed project data, which the profile blob already carries.
 * Returns "" when the project has no summarized attachments.
 */
export function buildDocEvidence(docs: DocRow[]): string {
	const lines = docs
		.map((d) => {
			const label = d.title?.trim() || d.original_filename?.trim() || 'Source';
			const summary = (d.summary ?? '').trim();
			const kws = asStrings(d.keywords);
			if (!summary && kws.length === 0) return '';
			const kwPart = kws.length ? ` [${kws.join(', ')}]` : '';
			return `- ${label}: ${summary}${kwPart}`.trim();
		})
		.filter(Boolean);
	return lines.join('\n');
}

/** A project named by the caller rather than found by ranking it. */
export interface PinnedProject {
	kind: RankableProject['kind'];
	id: number;
}

/**
 * Each project's skills, widened with what they imply — the "Graph" half of
 * GraphRAG.
 *
 * A project is tagged with the specific things it used ("Svelte", "PostgreSQL");
 * a posting is written in whatever terms its author chose, often general
 * ("frontend"). Nothing overlaps, and the project is dropped despite being the
 * right one. Walking the project UP to the terms a posting might use closes that
 * gap, and it is the same movement getExpandedProfileSkills makes on the other
 * side of the match — the applicant's specifics reach the employer's generalities.
 *
 * Widening the JOB downward instead would work on the same example and is the
 * wrong shape. Downward fan-out does not converge — measured on the live graph a
 * bidirectional hop reaches 19 concepts at worst and 170 by depth 4, against 10
 * for any upward depth — so it would have to be clamped to a single hop. It also
 * inflates scores, since a project listing four sibling technologies would score
 * four hits on one requirement. Per project, per profile, it is cacheable and
 * the job is not.
 *
 * ⚠️ This lifts the DETERMINISTIC ranker only. The semantic ranker scores against
 * vectors built from each project's typed text, which this does not touch.
 * Putting ancestors in that text would make the graph bite there too, at the risk
 * of pulling every project toward the same generic terms — a change worth
 * measuring before making, not assuming.
 *
 * Never throws: an unreachable graph costs the raw project skills, not the
 * ranking.
 *
 * Exported for its test — the fallback path is the one that must not regress,
 * and it is unreachable through relevantProfileProjects without a database.
 */
export async function widenProjectKeywords<T extends { keywords: string[] }>(
	projects: T[]
): Promise<T[]> {
	const all = [...new Set(projects.flatMap((p) => p.keywords))];
	if (all.length === 0) return projects;
	try {
		const near = await expandForRetrieval(all);
		if (near.size === 0) return projects;
		return projects.map((p) => {
			const implied = p.keywords.flatMap(
				(k) => near.get(normalizeSkill(k))?.map((c) => c.label) ?? []
			);
			return implied.length ? { ...p, keywords: dedupe([...p.keywords, ...implied]) } : p;
		});
	} catch (err) {
		console.warn('[retrieval] graph expansion failed, ranking on raw project skills:', err);
		return projects;
	}
}

/**
 * Load the applicant's projects (work-experience + side), fold in any attached
 * documents, and return the top-K relevant to `job`.
 *
 * `pinned` names a project the caller already knows this is about — it is
 * always included, always first, and takes one of the K slots.
 */
export async function relevantProfileProjects(
	profileId: number,
	job: JobLike,
	k = 3,
	pinned?: PinnedProject
): Promise<(RankableProject & { score: number })[]> {
	const docCols = {
		id: true,
		title: true,
		original_filename: true,
		summary: true,
		keywords: true
	} as const;
	const [sideRows, weRows] = await Promise.all([
		db.query.side_projects.findMany({
			where: eq(side_projects.profile_id, profileId),
			columns: { id: true, name: true, summary: true },
			with: {
				side_project_technologies: { columns: { name: true } },
				side_project_achievements: { columns: { description: true } },
				profile_document_projects: { columns: docCols }
			}
		}),
		db.query.work_experiences.findMany({
			where: eq(work_experiences.profile_id, profileId),
			columns: { id: true, name: true },
			with: {
				work_experience_projects: {
					columns: { id: true, name: true, description: true, outcome: true },
					with: {
						work_experience_project_technologies: { columns: { name: true } },
						profile_document_projects: { columns: docCols }
					}
				}
			}
		})
	]);

	const projects: RankableProject[] = [];
	// One embeddable unit per project (its typed data) + one per attachment.
	const units: EmbeddableUnit[] = [];

	const addProject = (
		kind: RankableProject['kind'],
		id: number,
		title: string,
		context: string,
		description: string,
		techs: string[],
		docs: DocRow[]
	) => {
		const docKeywords = docs.flatMap((d) => asStrings(d.keywords));
		const docSummaries = docs.map((d) => d.summary ?? '').filter(Boolean);
		projects.push({
			kind,
			id,
			title,
			context,
			keywords: dedupe([...techs, ...docKeywords]),
			text: description,
			citation: buildCitation(description, docSummaries, techs),
			docEvidence: buildDocEvidence(docs)
		});
		// Typed unit (attachment_id 0) + one unit per attachment, max-pooled later.
		units.push({
			projectKind: kind,
			projectId: id,
			attachmentId: 0,
			embedText: buildTypedEmbedText(title, context, description, techs)
		});
		for (const d of docs) {
			const embedText = buildAttachmentEmbedText(title, d);
			if (embedText) {
				units.push({
					projectKind: kind,
					projectId: id,
					attachmentId: d.id,
					embedText
				});
			}
		}
	};

	for (const sp of sideRows) {
		if (!sp.name?.trim()) continue;
		const techs = sp.side_project_technologies.map((t) => t.name ?? '').filter(Boolean);
		const achievements = sp.side_project_achievements
			.map((a) => a.description ?? '')
			.filter(Boolean);
		const description = [sp.summary ?? '', ...achievements].filter(Boolean).join(' ');
		addProject(
			'side_project',
			sp.id,
			sp.name.trim(),
			'',
			description,
			techs,
			sp.profile_document_projects
		);
	}

	for (const we of weRows) {
		for (const wep of we.work_experience_projects) {
			if (!wep.name?.trim()) continue;
			const techs = wep.work_experience_project_technologies
				.map((t) => t.name ?? '')
				.filter(Boolean);
			const description = [wep.description ?? '', wep.outcome ?? ''].filter(Boolean).join(' ');
			addProject(
				'work_experience_project',
				wep.id,
				wep.name.trim(),
				we.name ? `at ${we.name}` : '',
				description,
				techs,
				wep.profile_document_projects
			);
		}
	}

	// A pinned project is the subject, not a candidate: the applicant said this
	// piece of writing is about it. It goes first and it is never ranked away —
	// scoring it against a query derived from the thing being written *about* it
	// is circular, and a floor that dropped it would leave the model to write
	// about a project it was never shown.
	const subject = pinned
		? projects.find((p) => p.kind === pinned.kind && p.id === pinned.id)
		: undefined;
	const rest = subject ? projects.filter((p) => p !== subject) : projects;
	const remaining = subject ? Math.max(0, k - 1) : k;

	// Semantic (embedding) ranking leads; the graph-widened ranker gets the last
	// slot. It used to be a pure fallback, which meant that with embeddings on —
	// the normal case — the graph never affected a single request.
	let ranked: (RankableProject & { score: number })[];
	if (remaining === 0) {
		ranked = [];
	} else {
		const scores = await semanticScoreProjects(profileId, units, job);
		const semantic = scores ? rankBySemanticScores(rest, scores, remaining) : [];
		ranked =
			semantic.length === 0
				? // Semantic is unavailable, or its floor cleared nobody. A floor that
					// rejects every project leaves the writer with none at all, so here the
					// widened keywords are the whole answer rather than a supplement.
					rankProjects(await widenProjectKeywords(rest), job, remaining)
				: await withGraphPick(semantic, rest, job, remaining);
	}

	// The score on the subject is a sort key, not a measurement: nothing ranked it,
	// and 1 keeps it above the cosine scores it is being listed with.
	return subject ? [{ ...subject, score: 1, pinned: true }, ...ranked] : ranked;
}

/**
 * Let the graph-widened ranker claim the last slot, when it has something
 * semantic ranking missed.
 *
 * ## Why a slot and not a merge
 *
 * The two scores are not comparable and cannot be made so: cosine is bounded in
 * [0, 1] with a configured floor, while the deterministic score is an unbounded
 * count of keyword hits (+3 a required skill, +1 a mention). Any arithmetic that
 * puts them on one scale is a fabricated weighting. Ranks are comparable;
 * numbers are not, so this merges by rank and takes exactly one.
 *
 * ## Why exactly one
 *
 * Because the change has to be bounded to be reversible. Interleaving the two
 * lists would hand the graph a third of a K=3 prompt on its first day of
 * affecting anything. This trades the *last* semantic pick for the graph's
 * first, so the worst case is one slot, and the projects the semantic ranker was
 * most confident about are never displaced.
 *
 * The cost is one `expandForRetrieval` query per request — the widening no
 * longer happens lazily, which is the entire point of the change.
 *
 * `viaGraph` marks what it added. Without it there is no way to answer "does
 * this help?", and picking the size of the change before measuring the first one
 * is how the fallback ended up dark for a week.
 *
 * Exported for its test, for the same reason `widenProjectKeywords` is: reaching
 * it through `relevantProfileProjects` needs a database and an embedding
 * provider, and the displacement rule is the part that must not regress.
 */
export async function withGraphPick(
	semantic: (RankableProject & { score: number })[],
	candidates: RankableProject[],
	job: JobLike,
	k: number
): Promise<(RankableProject & { score: number })[]> {
	const chosen = new Set(semantic.map((p) => projectKey(p.kind, p.id)));
	const widened = rankProjects(await widenProjectKeywords(candidates), job, k);
	const newcomer = widened.find((p) => !chosen.has(projectKey(p.kind, p.id)));
	if (!newcomer) return semantic;

	// `rankProjects` already dropped everything scoring zero, so a newcomer has at
	// least one real keyword hit against this job rather than merely being next in
	// an arbitrary order.
	const kept = semantic.length < k ? semantic : semantic.slice(0, k - 1);
	console.log(
		`[retrieval] graph pick: ${newcomer.kind}#${newcomer.id} "${newcomer.title}" ` +
			`(deterministic ${newcomer.score}), ${semantic.length === kept.length ? 'spare slot' : 'displacing the last semantic pick'}`
	);
	// A sort key, not a measurement — the same convention the pinned subject uses.
	// It sits at the floor of the list it joins because it is appended last and
	// nothing downstream re-sorts.
	const floor = semantic[semantic.length - 1].score;
	return [...kept, { ...newcomer, score: floor, viaGraph: true }];
}

/**
 * Rank projects by their semantic cosine scores, dropping anything below the
 * (config) relevance floor and taking the top K. Same output shape as the
 * deterministic rankProjects, so downstream formatting is identical.
 */
function rankBySemanticScores(
	projects: RankableProject[],
	scores: Map<string, number>,
	k: number
): (RankableProject & { score: number })[] {
	const floor = config.embeddingProjectThreshold;
	return projects
		.map((p) => ({ ...p, score: scores.get(projectKey(p.kind, p.id)) ?? 0 }))
		.filter((p) => p.score >= floor)
		.sort((a, b) => b.score - a.score)
		.slice(0, k);
}

/**
 * Format ranked projects into a self-contained prompt block (its own header, so
 * callers just interpolate it). Returns "" when there are no matches.
 */
export function formatProjectCitations(ranked: RankableProject[]): string {
	if (ranked.length === 0) return '';
	const subject = ranked.find((p) => p.pinned);
	const items = ranked.map((p, i) => {
		const head = p.context ? `${p.title} (${p.context})` : p.title;
		const mark = p.pinned ? ' — THE SUBJECT' : '';
		return `${i + 1}. ${head}${mark}\n${p.citation}`;
	});
	const subjectNote = subject
		? `\n\nThe project marked THE SUBJECT is the one this piece of writing is about — ` +
			`the applicant said so, it was not inferred. Write about that one. The others are ` +
			`background, to be drawn on only where they genuinely bear on it.`
		: '';
	return (
		'## Relevant projects from the applicant\n\n' +
		"These are the applicant's REAL projects — from their work experience, " +
		'personal projects, and any source/docs they uploaded. Cite the ones that ' +
		'fit this role; ground every claim only in the notes here, do not invent.' +
		subjectNote +
		'\n\n' +
		items.join('\n\n')
	);
}

/**
 * One-call convenience for prompt call sites: load + rank + format the top-K
 * projects relevant to a job, returning a ready-to-interpolate string ("" if
 * none). `job.skills_required` may be passed straight from the (untyped json)
 * jobs column — cast it to string[] | null at the call site.
 */
export async function relevantProjectsText(
	profileId: number,
	job: JobLike,
	k = 3,
	pinned?: PinnedProject
): Promise<string> {
	const ranked = await relevantProfileProjects(profileId, job, k, pinned);
	return formatProjectCitations(ranked);
}

/**
 * Format the attachment-derived evidence of the top-ranked projects into a
 * neutral, self-contained block for MATCH SCORING. Unlike the citation block,
 * this emits ONLY the uploaded doc/repo evidence (not typed project data the
 * profile blob already carries) and frames it for honest weighing, not
 * advocacy. Returns "" when no ranked project has attachment evidence.
 */
export function formatSupportingEvidence(ranked: RankableProject[]): string {
	const items = ranked
		.filter((p) => (p.docEvidence ?? '').trim())
		.map((p) => {
			const head = p.context ? `${p.title} (${p.context})` : p.title;
			return `### ${head}\n${p.docEvidence!.trim()}`;
		});
	if (items.length === 0) return '';
	return (
		"## Supporting evidence from the applicant's attached materials\n\n" +
		'The applicant attached source code, documents, and/or repositories to ' +
		'some projects; below is what those materials revealed, for the projects ' +
		'most relevant to THIS job. Treat it as factual evidence to weigh for BOTH ' +
		'fit and gaps — it supplements the profile above and is not grounds to ' +
		'inflate the score. Base any claim only on what is stated here.\n\n' +
		items.join('\n\n')
	);
}

/**
 * One-call convenience for the match-scoring prompt: the attachment-derived
 * evidence for the top-K job-relevant projects, ready to interpolate ("" if the
 * profile has no attachments or none are relevant).
 *
 * COST GATE: returns "" without ranking or embedding when the profile has no
 * attachments at all — the common case — so scoring pays nothing extra unless
 * there is genuinely new evidence to surface.
 */
export async function relevantSupportingEvidence(
	profileId: number,
	job: JobLike,
	k = 3
): Promise<string> {
	const hasDocs = await db.query.profile_document_projects.findFirst({
		where: eq(profile_document_projects.profile_id, profileId),
		columns: { id: true }
	});
	if (!hasDocs) return '';
	const ranked = await relevantProfileProjects(profileId, job, k);
	return formatSupportingEvidence(ranked);
}
