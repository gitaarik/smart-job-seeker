/**
 * POST /api/ai/questions/[id]/revise
 *
 * Revises a draft answer per an optional instruction and returns the revised
 * text. Stateless and non-destructive: it takes the draft from the request
 * body (not the saved answer), so it works on a hand-written draft that was
 * never generated, and it never writes the `answer` column. The dedicated
 * question editor uses this as its "Refine" verb; committing is an explicit,
 * separate save.
 *
 * Body: { draft: string, instruction?: string }
 * Returns: { success: true, revisedText: string }
 */
import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { dbDirect as db } from '$lib/server/db';
import { eq } from 'drizzle-orm';
import { application_questions } from '$lib/server/db/schema';
import { requireAuth, parseIntParam } from '$lib/server/utils/api-helpers';
import { createAndGenerateAiChat } from '$lib/server/ai-chat/utils';
import { QUESTION_PROFILE_FIELDS } from '$lib/server/ai-chat/application-question';
import { reviseAnswerSchema } from '$lib/server/schemas/ai-prompt-schemas';
import { requireCredits } from '$lib/server/billing/require-credits';

const MAX_DRAFT_LENGTH = 20000;

export const POST: RequestHandler = async ({ params, request, locals }) => {
	const user = requireAuth(locals);
	const questionId = parseIntParam(params.id, 'question');

	const question = await db.query.application_questions.findFirst({
		where: eq(application_questions.id, questionId),
		with: {
			application: {
				with: {
					job: { columns: { job_description: true } },
					profile: { columns: { user_id: true } }
				}
			}
		}
	});

	if (!question || question.application.profile.user_id !== user.id) {
		return json({ success: false, message: 'Question not found' }, { status: 404 });
	}

	let body: unknown;
	try {
		body = await request.json();
	} catch {
		return json({ success: false, message: 'Invalid JSON body' }, { status: 400 });
	}

	const draft = (body as { draft?: unknown })?.draft;
	const instructionRaw = (body as { instruction?: unknown })?.instruction;
	const instruction = typeof instructionRaw === 'string' ? instructionRaw.trim() : '';

	if (typeof draft !== 'string' || !draft.trim()) {
		return json({ success: false, message: 'Write a draft to revise first' }, { status: 400 });
	}
	if (draft.length > MAX_DRAFT_LENGTH) {
		return json(
			{ success: false, message: `Draft is too long (max ${MAX_DRAFT_LENGTH} characters)` },
			{ status: 400 }
		);
	}

	await requireCredits(user.id, 5);

	const result = await createAndGenerateAiChat(
		question.application.profile_id,
		'revise_application_question',
		{
			question: question.question,
			draft,
			instruction: instruction || '(no specific instruction — improve clarity and impact)'
		},
		undefined,
		{
			profileDataFields: QUESTION_PROFILE_FIELDS,
			// The job, what has already happened on this application, and the files
			// attached to it — assembled from the application id.
			context: {
				entity: { type: 'application', id: question.application.id },
				sources: ['job', 'application_activity']
			}
		}
	);

	if (!result.success || !result.aiChat?.response) {
		return json({ success: false, message: result.message || 'Revision failed' }, { status: 422 });
	}

	let parsed: unknown;
	try {
		parsed = JSON.parse(result.aiChat.response);
	} catch {
		return json({ success: false, message: 'AI returned non-JSON response' }, { status: 502 });
	}

	const validated = reviseAnswerSchema.safeParse(parsed);
	if (!validated.success) {
		return json({ success: false, message: 'AI response failed validation' }, { status: 502 });
	}

	return json({ success: true, revisedText: validated.data.revisedText });
};
