/**
 * Project code → profile proposals (Tier 3 of
 * `planning/SEMANTIC-MATCHING-AND-RAG.md` § Repo-derived project evidence).
 *
 * Corpus-shaped, not GitHub-shaped: the files reaching this module are the same
 * whether Tier 2 scanned a repository or the applicant uploaded a ZIP, which is
 * what lets a work-experience project — which has no `repo_url` and never will
 * for proprietary work — use it on equal terms.
 *
 * Tiers 1 and 1b read facts GitHub reports about a repository. This one reads
 * the *code* — so unlike them it can be wrong, and its shape is chosen around
 * that.
 *
 * The split that matters: source code proves what was **built** and says
 * nothing about whether it **mattered**. It has no access to user counts, load,
 * incidents, deadlines or money. So a description and a technology list are
 * fair game — both are fully evidenced — while impact is not, and a generated
 * "reduced latency by 40%" would be a fabricated metric on a real person's CV
 * with nothing to check it against.
 *
 * `outcome` is the one concession, and a narrow one: the corpus is not always
 * code. Someone who uploads the acceptance email for a placement test has
 * supplied a result *stated by a third party*, and quoting that is not
 * invention. So the prompt may fill `outcome` when the files assert one, and
 * must return "" and ask a question when they do not.
 */

import { runProfileAiChat } from '$lib/server/ai-chat/job-utils';
import { buildDocumentBlob, type SummarizableFile } from '$lib/server/documents/summarize';
import { normalizeSkill } from '$lib/skills';

/**
 * Rewrite third-person stand-ins into first person.
 *
 * The prompt forbids "the applicant" twice over and gpt-oss writes it anyway —
 * the same "a prompt is a request, the caller is the guarantee" shape as the
 * technology dedupe below. A CV that refers to its own subject in the third
 * person reads as machine-written, which is the one thing this feature must not
 * produce.
 *
 * Only **subject position** is rewritten: the start of the text or of a
 * sentence, where "The applicant passed" becomes "I passed" and "The
 * applicant's tests" becomes "My tests". A mid-sentence occurrence is left
 * alone, because turning it into "me" or "my" correctly needs grammar this
 * cannot see, and a mangled sentence is worse than a stray phrase the user can
 * edit.
 */
export function toFirstPerson(text: string): string {
	return text.replace(
		/(^|[.!?]\s+)(?:the\s+)?(applicant|author|candidate)(['’]s)?\s+/gi,
		(_match, lead: string, _noun: string, possessive: string | undefined) =>
			`${lead}${possessive ? 'My' : 'I'} `
	);
}

export interface RepoQuestion {
	/** What the applicant is being asked. */
	question: string;
	/** The code observation behind it, so the question can be judged. */
	evidence: string;
}

export interface RepoProposals {
	description: string;
	/** Empty unless the supplied files actually assert a result. */
	outcome: string;
	technologies: string[];
	questions: RepoQuestion[];
}

export interface ProjectContext {
	name: string;
	summary: string;
	technologies: string[];
	achievements: string[];
}

/** What the prompt is told the project already says, so it proposes deltas. */
function renderContext(context: ProjectContext) {
	return {
		projectName: context.name || 'Untitled project',
		existingSummary: context.summary.trim() || '(none yet)',
		existingTechnologies: context.technologies.join(', ') || '(none yet)',
		existingAchievements: context.achievements.map((a) => `- ${a}`).join('\n') || '(none yet)'
	};
}

/**
 * Ask the model what this repository suggests for the project's CV entry.
 *
 * Returns null on any failure — this is an optional assist, so a dead provider
 * must not turn into a failed request the user has to make sense of.
 */
export async function proposeFromCode(
	profileId: number,
	files: SummarizableFile[],
	context: ProjectContext
): Promise<RepoProposals | null> {
	const document = buildDocumentBlob(files);
	if (!document) return null;

	const result = await runProfileAiChat<{
		description?: string | null;
		outcome?: string | null;
		technologies?: string[] | null;
		questions?: { question?: string; evidence?: string }[] | null;
	}>(profileId, 'propose_project_from_code', { document, ...renderContext(context) });

	if (!result.success || !result.response) return null;

	// Drop technologies the project already lists. The prompt is told to, but a
	// prompt is a request and this is the guarantee — by the matching pipeline's
	// own rule, so "node-js" cannot slip past an existing "Node.js".
	const have = new Set(context.technologies.map(normalizeSkill).filter(Boolean));
	const technologies: string[] = [];
	for (const raw of result.response.technologies ?? []) {
		const name = String(raw).trim();
		const key = normalizeSkill(name);
		if (!name || !key || have.has(key)) continue;
		have.add(key);
		technologies.push(name);
	}

	const questions: RepoQuestion[] = [];
	for (const raw of result.response.questions ?? []) {
		const question = String(raw?.question ?? '').trim();
		if (!question) continue;
		questions.push({ question, evidence: String(raw?.evidence ?? '').trim() });
	}

	const description = toFirstPerson((result.response.description ?? '').trim());
	const outcome = toFirstPerson((result.response.outcome ?? '').trim());
	if (!description && !outcome && technologies.length === 0 && questions.length === 0) {
		return null;
	}
	return { description, outcome, technologies, questions };
}

export interface AchievementDraft {
	achievement: string;
	/** The part of the applicant's own answer the claim rests on, verbatim. */
	usedFromAnswer: string;
}

/**
 * Turn one answered question into one CV achievement line.
 *
 * The inverse of the constraint above, and the reason the questions exist at
 * all: `proposeFromCode` may not assert impact because it only has the code,
 * and this may because the applicant just supplied it. The safety property is
 * that the impact came from the person — so the prompt is told, at length, not
 * to add any of its own, and `usedFromAnswer` makes that auditable rather than
 * merely requested.
 */
export async function achievementFromAnswer(
	profileId: number,
	input: { projectName: string; question: string; evidence: string; answer: string }
): Promise<AchievementDraft | null> {
	if (!input.answer.trim()) return null;

	const result = await runProfileAiChat<{
		achievement?: string | null;
		usedFromAnswer?: string | null;
	}>(profileId, 'write_achievement_from_answer', {
		projectName: input.projectName || 'Untitled project',
		question: input.question,
		evidence: input.evidence || '(none recorded)',
		answer: input.answer
	});

	if (!result.success || !result.response) return null;
	const achievement = toFirstPerson((result.response.achievement ?? '').trim());
	if (!achievement) return null;
	return { achievement, usedFromAnswer: (result.response.usedFromAnswer ?? '').trim() };
}
