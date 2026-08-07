import type { PageServerLoad } from './$types';
import { dbDirect as db } from '$lib/server/db';
import { eq, and, desc, count, type SQL } from 'drizzle-orm';
import { sent_emails } from '$lib/server/db/schema';

export const load: PageServerLoad = async ({ url }) => {
	const typeFilter = url.searchParams.get('type') || '';
	const statusFilter = url.searchParams.get('status') || '';
	const page = Math.max(1, parseInt(url.searchParams.get('page') || '1'));
	const perPage = 25;

	const conditions: SQL[] = [];
	if (typeFilter) conditions.push(eq(sent_emails.type, typeFilter));
	if (statusFilter) conditions.push(eq(sent_emails.status, statusFilter));
	const whereCondition = conditions.length > 0 ? and(...conditions) : undefined;

	const [emails, [{ total }]] = await Promise.all([
		db.query.sent_emails.findMany({
			where: whereCondition,
			orderBy: desc(sent_emails.sent_at),
			offset: (page - 1) * perPage,
			limit: perPage
		}),
		db.select({ total: count() }).from(sent_emails).where(whereCondition)
	]);

	// Count by type
	const typeCountsRaw = await db
		.select({ type: sent_emails.type, count: count() })
		.from(sent_emails)
		.groupBy(sent_emails.type);

	const typeCounts: Record<string, number> = {};
	let allCount = 0;
	for (const row of typeCountsRaw) {
		typeCounts[row.type] = row.count;
		allCount += row.count;
	}

	// Count by status
	const [sentResult, failedResult] = await Promise.all([
		db.select({ count: count() }).from(sent_emails).where(eq(sent_emails.status, 'sent')),
		db.select({ count: count() }).from(sent_emails).where(eq(sent_emails.status, 'failed'))
	]);

	return {
		emails,
		total,
		page,
		perPage,
		totalPages: Math.ceil(total / perPage),
		typeFilter,
		statusFilter,
		typeCounts,
		allCount,
		sentCount: sentResult[0].count,
		failedCount: failedResult[0].count
	};
};
