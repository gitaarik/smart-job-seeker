import type { Actions, PageServerLoad } from './$types';
import { fail } from '@sveltejs/kit';
import { dbDirect as db } from '$lib/server/db';
import { eq, and, desc, count, type SQL } from 'drizzle-orm';
import { inbound_emails } from '$lib/server/db/schema';

export const load: PageServerLoad = async ({ url }) => {
	const statusFilter = url.searchParams.get('status') || '';
	const handlerFilter = url.searchParams.get('handler') || '';
	const page = Math.max(1, parseInt(url.searchParams.get('page') || '1'));
	const perPage = 25;

	const conditions: SQL[] = [];
	if (statusFilter) conditions.push(eq(inbound_emails.status, statusFilter));
	if (handlerFilter) conditions.push(eq(inbound_emails.handler, handlerFilter));
	const whereCondition = conditions.length > 0 ? and(...conditions) : undefined;

	const [emails, [{ total }]] = await Promise.all([
		db.query.inbound_emails.findMany({
			where: whereCondition,
			orderBy: desc(inbound_emails.received_at),
			offset: (page - 1) * perPage,
			limit: perPage,
			columns: {
				id: true,
				recipient: true,
				handler: true,
				from_address: true,
				subject: true,
				body_text: true,
				body_html: true,
				status: true,
				extracted_code: true,
				extracted_link: true,
				received_at: true,
				applied_at: true,
				run_id: true,
				verification_address_id: true
			}
		}),
		db.select({ total: count() }).from(inbound_emails).where(whereCondition)
	]);

	const [
		[{ allCount }],
		[{ receivedCount }],
		[{ matchedCount }],
		[{ appliedCount }],
		[{ droppedCount }]
	] = await Promise.all([
		db.select({ allCount: count() }).from(inbound_emails),
		db
			.select({ receivedCount: count() })
			.from(inbound_emails)
			.where(eq(inbound_emails.status, 'received')),
		db
			.select({ matchedCount: count() })
			.from(inbound_emails)
			.where(eq(inbound_emails.status, 'matched')),
		db
			.select({ appliedCount: count() })
			.from(inbound_emails)
			.where(eq(inbound_emails.status, 'applied')),
		db
			.select({ droppedCount: count() })
			.from(inbound_emails)
			.where(eq(inbound_emails.status, 'dropped'))
	]);

	const counts = {
		all: allCount,
		received: receivedCount,
		matched: matchedCount,
		applied: appliedCount,
		dropped: droppedCount
	};

	const handlerCountsRaw = await db
		.select({ handler: inbound_emails.handler, count: count() })
		.from(inbound_emails)
		.groupBy(inbound_emails.handler);

	return {
		emails,
		total,
		page,
		perPage,
		totalPages: Math.ceil(total / perPage),
		statusFilter,
		handlerFilter,
		counts,
		handlerCounts: Object.fromEntries(
			handlerCountsRaw.map((h) => [h.handler || 'unknown', h.count])
		)
	};
};

export const actions: Actions = {
	delete: async ({ request }) => {
		const formData = await request.formData();
		const id = parseInt(formData.get('id') as string);
		if (isNaN(id)) return fail(400, { error: 'Invalid request' });

		await db.delete(inbound_emails).where(eq(inbound_emails.id, id));
		return { success: true };
	}
};
