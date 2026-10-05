/**
 * POST /api/jobs/[id]/match-explanation: the summary, strengths and gaps of the
 * selected profile's match with this job, written now when Jev scored it and
 * nobody has opened it since (ai-chat/match-explanation.ts).
 *
 * A POST because it may write them, and called by the job page once the page
 * is open, never from its `load`: the app runs `load` when a link is hovered.
 */
import { error, json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { ensureMatchExplanation } from '$lib/server/ai-chat/match-explanation';
import { requireCredits } from '$lib/server/billing/require-credits';
import { getSelectedProfileId } from '$lib/server/profile/selected-profile';
import { parseIntParam, requireAuth } from '$lib/server/utils/api-helpers';

export const POST: RequestHandler = async ({ params, locals, cookies }) => {
	const user = requireAuth(locals);
	const jobId = parseIntParam(params.id, 'job');
	const profileId = await getSelectedProfileId(cookies, user.id);
	if (!profileId) error(400, 'No profile selected');
	await requireCredits(user.id, 1);

	let explanation;
	try {
		explanation = await ensureMatchExplanation(profileId, jobId);
	} catch (cause) {
		console.error(`[match-explanation] profile ${profileId}, job ${jobId}:`, cause);
		error(502, 'The match analysis could not be written. Try again in a moment.');
	}
	if (!explanation) error(404, 'This job has no match for the selected profile');
	return json(explanation);
};
