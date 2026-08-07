import type { PageServerLoad } from './$types';
import { dbDirect as db } from '$lib/server/db';
import { eq, and, or, isNull, inArray, asc, desc } from 'drizzle-orm';
import {
	user_feedback,
	user_feedback_subscribers,
	users as usersTable,
	feedback_replies
} from '$lib/server/db/schema';

export const load: PageServerLoad = async ({ parent }) => {
	const { user } = await parent();

	// Get IDs of tickets the user is subscribed to (from merged tickets)
	const subscriptions = await db.query.user_feedback_subscribers.findMany({
		where: eq(user_feedback_subscribers.user_id, user.id),
		columns: { feedback_id: true }
	});
	const subscribedIds = subscriptions.map((s) => s.feedback_id);

	// Load tickets: owned by user OR subscribed to, excluding merged-away tickets
	const orConditions = [eq(user_feedback.user_id, user.id)];
	if (subscribedIds.length > 0) {
		orConditions.push(inArray(user_feedback.id, subscribedIds));
	}

	const feedback = await db.query.user_feedback.findMany({
		where: and(isNull(user_feedback.merged_into_id), or(...orConditions)),
		orderBy: desc(user_feedback.date_updated),
		with: {
			feedback_replies: {
				orderBy: asc(feedback_replies.created_at)
			},
			user_feedback_files: {
				with: {
					file: {
						columns: {
							id: true,
							filename_download: true,
							type: true,
							filesize: true
						}
					}
				}
			}
		}
	});

	// Get user info for reply authors
	const replyUserIds = new Set<string>();
	for (const f of feedback) {
		for (const r of f.feedback_replies) {
			replyUserIds.add(r.user_id);
		}
	}
	const users =
		replyUserIds.size > 0
			? await db.query.users.findMany({
					where: inArray(usersTable.id, [...replyUserIds]),
					columns: { id: true, name: true, email: true }
				})
			: [];
	const userMap = Object.fromEntries(users.map((u) => [u.id, u]));

	return {
		feedback: feedback.map((f) => ({
			...f,
			feedback_replies: f.feedback_replies.map((r) => ({
				...r,
				user: userMap[r.user_id] || { name: null, email: r.user_id }
			}))
		}))
	};
};
