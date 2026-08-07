/**
 * POST /api/ai/questions/extract
 *
 * Takes a free-text blob the applicant pasted (questions they've already
 * answered elsewhere) and asks the LLM to split it into discrete
 * question/answer pairs, preserving their wording verbatim. Nothing is
 * persisted here — the parsed pairs are returned for the client to render
 * as an editable preview. The user reviews/edits, then saves via the
 * `?/createQuestions` form action on the texts page.
 *
 * Body: { text: string }
 * Returns: { success: true, pairs: Array<{ question, answer, confidence }> }
 */
import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { requireAuth } from '$lib/server/utils/api-helpers';
import { getSelectedProfileId } from '../../../../(app)/profile/utils';
import { createAndGenerateAiChat } from '$lib/server/ai-chat/utils';
import { extractQaPairsSchema } from '$lib/server/schemas/ai-prompt-schemas';
import { requireCredits } from '$lib/server/billing/require-credits';

/** Cap the paste size so a runaway input can't blow up token spend. */
const MAX_TEXT_LENGTH = 20000;

export const POST: RequestHandler = async ({ request, cookies, locals }) => {
	const user = requireAuth(locals);

	const profileId = await getSelectedProfileId(cookies, user.id);
	if (!profileId) {
		return json({ success: false, message: 'No active profile selected' }, { status: 400 });
	}

	let body: unknown;
	try {
		body = await request.json();
	} catch {
		return json({ success: false, message: 'Invalid JSON body' }, { status: 400 });
	}

	const text = (body as { text?: unknown })?.text;
	if (typeof text !== 'string' || !text.trim()) {
		return json(
			{ success: false, message: 'Paste some text to extract questions from' },
			{ status: 400 }
		);
	}
	if (text.length > MAX_TEXT_LENGTH) {
		return json(
			{
				success: false,
				message: `Text is too long (max ${MAX_TEXT_LENGTH} characters)`
			},
			{ status: 400 }
		);
	}

	await requireCredits(user.id, 5);

	// Extraction is pure text parsing — no profile grounding needed, so pass an
	// empty profileDataFields to skip the collected_data interpolation.
	const result = await createAndGenerateAiChat(
		profileId,
		'extract_qa_pairs',
		{ pastedText: text },
		undefined,
		{ profileDataFields: [] }
	);

	if (!result.success || !result.aiChat?.response) {
		return json(
			{ success: false, message: result.message || 'Extraction failed' },
			{ status: 422 }
		);
	}

	let parsed: unknown;
	try {
		parsed = JSON.parse(result.aiChat.response);
	} catch {
		return json({ success: false, message: 'AI returned non-JSON response' }, { status: 502 });
	}

	const validated = extractQaPairsSchema.safeParse(parsed);
	if (!validated.success) {
		return json({ success: false, message: 'AI response failed validation' }, { status: 502 });
	}

	// Drop fully-empty pairs (no question and no answer) — nothing to edit or
	// save. Everything else, including answer-only pairs (empty question), goes
	// to the preview so the user can fill in the gaps.
	const pairs = validated.data.pairs.filter((p) => p.question.trim() || p.answer.trim());

	return json({ success: true, pairs });
};
