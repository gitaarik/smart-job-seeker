import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { dbDirect as db } from '$lib/server/db';
import { eq } from 'drizzle-orm';
import { user_feedback, feedback_replies } from '$lib/server/db/schema';

export const POST: RequestHandler = async ({ params, request, locals }) => {
	const user = locals.user;
	if (!user) error(401, 'Not authenticated');

	const feedbackId = parseInt(params.id);
	if (isNaN(feedbackId)) error(400, 'Invalid feedback ID');

	const body = await request.json();
	const message = body.message?.trim();
	if (!message) error(400, 'Message is required');

	const feedback = await db.query.user_feedback.findFirst({
		where: eq(user_feedback.id, feedbackId),
		with: { user_feedback_subscribers: { columns: { user_id: true } } }
	});
	if (!feedback) error(404, 'Feedback not found');

	if (feedback.merged_into_id) {
		error(400, `This ticket has been merged into #${feedback.merged_into_id}`);
	}

	// Check authorization: owner, subscriber, or admin
	const isOwner = feedback.user_id === user.id;
	const isSubscriber = feedback.user_feedback_subscribers.some((s) => s.user_id === user.id);
	const isAdmin = user.is_admin === true;

	if (!isOwner && !isSubscriber && !isAdmin) {
		error(403, 'Not authorized');
	}

	await db.insert(feedback_replies).values({
		feedback_id: feedbackId,
		user_id: user.id,
		is_admin: isAdmin,
		message
	});

	// Auto-update status based on who replied
	let newStatus: string | undefined;
	if (isAdmin && feedback.status === 'new') {
		newStatus = 'reviewed';
	} else if (!isAdmin && feedback.status === 'waiting') {
		newStatus = 'reviewed';
	}

	await db
		.update(user_feedback)
		.set({
			date_updated: new Date(),
			...(newStatus ? { status: newStatus } : {})
		})
		.where(eq(user_feedback.id, feedbackId));

	return json({ success: true });
};
