/** One career-site board: its health, its postings, and "sweep now". */
import type { Actions, PageServerLoad } from './$types';
import { error, fail } from '@sveltejs/kit';
import { dbDirect as db } from '$lib/server/db';
import { desc, eq, sql } from 'drizzle-orm';
import { ats_boards, ats_postings, job_platforms } from '$lib/server/db/schema';
import { requireAdmin } from '$lib/server/auth/guards';
import { enqueueAtsBoard } from '$lib/server/queue';

const POSTINGS_LIMIT = 50;

export const load: PageServerLoad = async ({ params }) => {
	const boardId = parseInt(params.boardId, 10);
	if (isNaN(boardId)) error(400, 'Invalid board id');

	const board = await db.query.ats_boards.findFirst({ where: eq(ats_boards.id, boardId) });
	if (!board) error(404, 'Board not found');

	const [[counts], postings, platform] = await Promise.all([
		db
			.select({
				open: sql<number>`count(*) FILTER (WHERE ${ats_postings.closed_at} IS NULL)::int`,
				open_30d: sql<number>`count(*) FILTER (WHERE ${ats_postings.closed_at} IS NULL AND ${ats_postings.published_at} > now() - interval '30 days')::int`,
				closed: sql<number>`count(*) FILTER (WHERE ${ats_postings.closed_at} IS NOT NULL)::int`,
				promoted: sql<number>`count(*) FILTER (WHERE ${ats_postings.job_id} IS NOT NULL)::int`
			})
			.from(ats_postings)
			.where(eq(ats_postings.board_id, boardId)),
		db
			.select({
				id: ats_postings.id,
				title: ats_postings.title,
				location_text: ats_postings.location_text,
				country_codes: ats_postings.country_codes,
				work_location: ats_postings.work_location,
				published_at: ats_postings.published_at,
				first_seen_at: ats_postings.first_seen_at,
				closed_at: ats_postings.closed_at,
				source_url: ats_postings.source_url,
				job_id: ats_postings.job_id
			})
			.from(ats_postings)
			.where(eq(ats_postings.board_id, boardId))
			.orderBy(
				sql`${ats_postings.closed_at} IS NOT NULL`,
				desc(ats_postings.published_at),
				desc(ats_postings.id)
			)
			.limit(POSTINGS_LIMIT),
		db.query.job_platforms.findFirst({
			where: eq(job_platforms.key, board.provider),
			columns: { id: true, name: true }
		})
	]);

	return {
		board,
		counts: counts ?? { open: 0, open_30d: 0, closed: 0, promoted: 0 },
		postings,
		postingsLimit: POSTINGS_LIMIT,
		platform: platform ?? null
	};
};

export const actions: Actions = {
	sweep: async (event) => {
		requireAdmin(event);
		const boardId = parseInt(event.params.boardId, 10);
		const board = await db.query.ats_boards.findFirst({
			where: eq(ats_boards.id, boardId),
			columns: { id: true, provider: true, slug: true }
		});
		if (!board) return fail(404, { error: 'Board not found' });
		try {
			await enqueueAtsBoard(board, 'admin');
		} catch (err) {
			return fail(503, {
				error: `Could not queue the board: ${err instanceof Error ? err.message : String(err)}`
			});
		}
		return {
			message: `Queued ${board.provider}/${board.slug}. Reload in a few seconds to see the result.`
		};
	}
};
