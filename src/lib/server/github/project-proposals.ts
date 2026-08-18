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
 * incidents, deadlines or money. So this asks the model for a summary and a
 * technology list — both fully evidenced by the code — and for the achievement
 * half it asks the model to ask *the applicant questions* instead. A generated
 * "reduced latency by 40%" would be a fabricated metric on a real person's CV,
 * about their own project, with nothing to check it against.
 */

import { runProfileAiChat } from '$lib/server/ai-chat/job-utils';
import { buildDocumentBlob, type SummarizableFile } from '$lib/server/documents/summarize';
import { normalizeSkill } from '$lib/skills';

export interface RepoQuestion {
	/** What the applicant is being asked. */
	question: string;
	/** The code observation behind it, so the question can be judged. */
	evidence: string;
}

export interface RepoProposals {
	summary: string;
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
		summary?: string | null;
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

	const summary = (result.response.summary ?? '').trim();
	if (!summary && technologies.length === 0 && questions.length === 0) return null;
	return { summary, technologies, questions };
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
	const achievement = (result.response.achievement ?? '').trim();
	if (!achievement) return null;
	return { achievement, usedFromAnswer: (result.response.usedFromAnswer ?? '').trim() };
}
